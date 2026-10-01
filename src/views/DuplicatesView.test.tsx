import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DismissalDto, DuplicatePairDto } from "../api/types";
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

const dismissal: DismissalDto = {
  slugA: "berserk",
  slugB: "berserk-of-gluttony",
  dismissedAt: "2026-09-01T10:00:00.000Z",
  a: mangaDto({
    id: "m3",
    canonicalName: "Berserk",
    normalizedSlug: "berserk",
  }),
  // Dismissed on another machine, before this one synced the title.
  b: null,
};

/** Each endpoint the view reads answered with its own shape. */
function serve({
  pairs = [pair],
  dismissals = [],
}: {
  pairs?: DuplicatePairDto[];
  dismissals?: DismissalDto[];
} = {}) {
  fetchMock.mockImplementation((path: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      return Promise.resolve(
        path === "/api/duplicates/merge"
          ? jsonResponse({ canonical: pair.b, alias: pair.a })
          : new Response(null, { status: 204 }),
      );
    }
    if (path === "/api/duplicates/dismissals") {
      return Promise.resolve(jsonResponse(dismissals));
    }
    return Promise.resolve(jsonResponse(pairs));
  });
}

function postTo(path: string): unknown[] | undefined {
  return fetchMock.mock.calls.find(
    ([called, init]) =>
      called === path && (init as RequestInit | undefined)?.method === "POST",
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  serve();
});

describe("DuplicatesView", () => {
  it("renders suspected pairs with their similarity and why they matched", async () => {
    await renderWithProviders(<DuplicatesView />);

    expect(await screen.findByText("Solo Leveling")).toBeDefined();
    expect(screen.getByText("Solo Levelling")).toBeDefined();
    expect(screen.getByText("87 %")).toBeDefined();
    expect(screen.getByText("títulos casi idénticos")).toBeDefined();
  });

  it("shows the empty state when nothing looks duplicated", async () => {
    serve({ pairs: [] });

    await renderWithProviders(<DuplicatesView />);

    expect(await screen.findByText("Todo en orden")).toBeDefined();
  });

  it("merges the pair into the side the user picked", async () => {
    await renderWithProviders(<DuplicatesView />);
    const button = await screen.findByText("Unir en «Solo Levelling»");
    await actAsync(() => button.click());

    // The clicked side is the one that survives.
    expect(requestBody(postTo("/api/duplicates/merge"))).toEqual({
      canonicalId: "m2",
      aliasId: "m1",
    });
  });

  it("dismisses a pair the user says is not a duplicate", async () => {
    await renderWithProviders(<DuplicatesView />);
    const button = await screen.findByText("No son el mismo");
    await actAsync(() => button.click());

    expect(requestBody(postTo("/api/duplicates/dismiss"))).toEqual({
      idA: "m1",
      idB: "m2",
    });
  });

  it("warns when the pair looks like a sequel", async () => {
    serve({
      pairs: [{ ...pair, sequelSuspicion: true, reasons: ["containment"] }],
    });

    await renderWithProviders(<DuplicatesView />);

    expect(
      await screen.findByText(
        "Puede ser una temporada o spin-off, no la misma obra.",
      ),
    ).toBeDefined();
  });
});

describe("DuplicatesView: dismissed pairs", () => {
  it("lists them, folded away, a missing side by its slug", async () => {
    serve({ pairs: [], dismissals: [dismissal] });

    await renderWithProviders(<DuplicatesView />);

    expect(await screen.findByText("Descartados")).toBeDefined();
    const list = within(
      screen.getByRole("list", { name: "Pares descartados", hidden: true }),
    );
    expect(list.getByText("Berserk")).toBeDefined();
    expect(list.getByText("berserk-of-gluttony")).toBeDefined();
  });

  it("takes a dismissal back by its pair of slugs", async () => {
    serve({ dismissals: [dismissal] });
    await renderWithProviders(<DuplicatesView />);
    const button = await screen.findByText("Volver a sugerir");

    await actAsync(() => button.click());

    expect(requestBody(postTo("/api/duplicates/undismiss"))).toEqual({
      slugA: "berserk",
      slugB: "berserk-of-gluttony",
    });
  });

  it("says nothing when no pair was ever dismissed", async () => {
    await renderWithProviders(<DuplicatesView />);
    await screen.findByText("Solo Leveling");

    expect(screen.queryByText("Descartados")).toBeNull();
  });
});
