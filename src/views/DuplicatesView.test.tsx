import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DuplicatePairDto } from "../api/types";
import { jsonResponse, mangaDto, renderWithProviders } from "../test-utils";
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
};

beforeEach(() => {
  fetchMock.mockReset();
});

describe("DuplicatesView", () => {
  it("renders suspected pairs with their similarity", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse([pair])));

    await renderWithProviders(<DuplicatesView />);

    expect(await screen.findByText("Solo Leveling")).toBeDefined();
    expect(screen.getByText("Solo Levelling")).toBeDefined();
    expect(screen.getByText("87 %")).toBeDefined();
  });

  it("shows the empty state when nothing looks duplicated", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse([])));

    await renderWithProviders(<DuplicatesView />);

    expect(
      await screen.findByText("Sin duplicados sospechosos."),
    ).toBeDefined();
  });
});
