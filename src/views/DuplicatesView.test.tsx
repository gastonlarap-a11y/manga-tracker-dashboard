import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DuplicatePairDto } from "../api/types";
import {
  actAsync,
  jsonResponse,
  mangaDto,
  renderWithProviders,
  requestBody,
} from "../test-utils";
import { DuplicatesView } from "./DuplicatesView";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const pair: DuplicatePairDto = {
  a: mangaDto({
    id: "m1",
    canonicalName: "Solo Leveling",
    normalizedSlug: "solo-leveling",
  }),
  b: mangaDto({
    id: "m2",
    canonicalName: "Solo Levelling",
    normalizedSlug: "solo-levelling",
  }),
  similarity: 0.87,
  reasons: ["edit-distance"],
  sequelSuspicion: false,
};

beforeEach(() => {
  fetchMock.mockReset();
});

describe("DuplicatesView", () => {
  it("renders suspected pairs with their similarity and why they matched", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse([pair])));

    await renderWithProviders(<DuplicatesView />);

    expect(await screen.findByText("Solo Leveling")).toBeDefined();
    expect(screen.getByText("Solo Levelling")).toBeDefined();
    expect(screen.getByText("87 %")).toBeDefined();
    expect(screen.getByText("títulos casi idénticos")).toBeDefined();
  });

  it("shows the empty state when nothing looks duplicated", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse([])));

    await renderWithProviders(<DuplicatesView />);

    expect(await screen.findByText("Todo en orden")).toBeDefined();
  });

  it("merges the pair into the side the user picked", async () => {
    fetchMock.mockImplementation((_path: string, init?: RequestInit) =>
      Promise.resolve(
        init?.method === "POST"
          ? jsonResponse({ canonical: pair.b, alias: pair.a })
          : jsonResponse([pair]),
      ),
    );

    await renderWithProviders(<DuplicatesView />);
    const button = await screen.findByText("Unir en «Solo Levelling»");
    await actAsync(() => button.click());

    const call = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === "POST",
    );
    expect(call?.[0]).toBe("/api/duplicates/merge");
    // The clicked side is the one that survives.
    expect(requestBody(call)).toEqual({ canonicalId: "m2", aliasId: "m1" });
  });

  it("dismisses a pair the user says is not a duplicate", async () => {
    fetchMock.mockImplementation((_path: string, init?: RequestInit) =>
      Promise.resolve(
        init?.method === "POST"
          ? new Response(null, { status: 204 })
          : jsonResponse([pair]),
      ),
    );

    await renderWithProviders(<DuplicatesView />);
    const button = await screen.findByText("No son el mismo");
    await actAsync(() => button.click());

    const call = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === "POST",
    );
    expect(call?.[0]).toBe("/api/duplicates/dismiss");
  });

  it("warns when the pair looks like a sequel", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        jsonResponse([
          { ...pair, sequelSuspicion: true, reasons: ["containment"] },
        ]),
      ),
    );

    await renderWithProviders(<DuplicatesView />);

    expect(
      await screen.findByText(
        "Puede ser una temporada o spin-off, no la misma obra.",
      ),
    ).toBeDefined();
  });
});
