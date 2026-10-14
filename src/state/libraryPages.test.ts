import { createStore } from "jotai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LibraryEntryDto } from "../api/types";
import { jsonResponse, libraryEntry } from "../test-utils";
import { searchAtom, statusTabAtom } from "./atoms";
import {
  appendPage,
  followUpPages,
  libraryPagesAtom,
  syncLibraryPagesAtom,
  toPageQuery,
} from "./libraryPages";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

beforeEach(() => {
  fetchMock.mockReset();
});

function page(items: LibraryEntryDto[]): Response {
  return jsonResponse({ items, nextCursor: null });
}

describe("appendPage", () => {
  it("adds the next page after what is held, without repeating a card", () => {
    // A reading between two pages moves its card to the front, and the
    // second page can then repeat one the first already had.
    const a = libraryEntry({ id: "a" });
    const b = libraryEntry({ id: "b" });
    const c = libraryEntry({ id: "c" });

    expect(appendPage([a, b], [b, c]).map((entry) => entry.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});

describe("toPageQuery", () => {
  it("turns a period in days into the instant it starts at", () => {
    const now = Date.UTC(2026, 9, 1, 12);

    expect(
      toPageQuery({ sort: "recent", sinceDays: 7, tags: [] }, now).since,
    ).toBe("2026-09-24T12:00:00.000Z");
    expect(
      toPageQuery({ sort: "recent", tags: [] }, now).since,
    ).toBeUndefined();
  });

  it("turns how long a series went unread into the instant before which it was", () => {
    const now = Date.UTC(2026, 9, 13, 12);

    expect(
      toPageQuery({ sort: "oldest", beforeDays: 90, tags: [] }, now).before,
    ).toBe("2026-07-15T12:00:00.000Z");
    expect(
      toPageQuery({ sort: "oldest", tags: [] }, now).before,
    ).toBeUndefined();
  });
});

describe("two paged lists", () => {
  it("never let a request of one discard the other's answer", async () => {
    // The newest-request counter used to be one for the whole module: the
    // follow-up list loading while the grid's page was on its way made the
    // grid throw its own answer away.
    let releaseGrid: () => void = () => {};
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://x");
      if (url.searchParams.get("sort") === "oldest") {
        return Promise.resolve(page([libraryEntry({ id: "quiet" })]));
      }
      return new Promise<Response>((resolve) => {
        releaseGrid = () => resolve(page([libraryEntry({ id: "grid" })]));
      });
    });
    const store = createStore();

    const grid = store.set(syncLibraryPagesAtom);
    await store.set(followUpPages.syncAtom);
    releaseGrid();
    await grid;

    expect(store.get(libraryPagesAtom)?.items.map((entry) => entry.id)).toEqual(
      ["grid"],
    );
    expect(
      store.get(followUpPages.pagesAtom)?.items.map((entry) => entry.id),
    ).toEqual(["quiet"]);
  });
});

describe("syncLibraryPagesAtom", () => {
  it("lets the newest query win over an older one still on its way", async () => {
    let releaseOld: () => void = () => {};
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const q = new URL(String(input), "http://x").searchParams.get("q");
      if (q === "vieja") {
        return new Promise<Response>((resolve) => {
          releaseOld = () =>
            resolve(
              page([libraryEntry({ id: "old", canonicalName: "Vieja" })]),
            );
        });
      }
      return Promise.resolve(
        page([libraryEntry({ id: "new", canonicalName: "Nueva" })]),
      );
    });
    const store = createStore();

    store.set(searchAtom, "vieja");
    const slow = store.set(syncLibraryPagesAtom);
    store.set(searchAtom, "nueva");
    await store.set(syncLibraryPagesAtom);
    releaseOld();
    await slow;

    expect(store.get(libraryPagesAtom)?.items.map((entry) => entry.id)).toEqual(
      ["new"],
    );
  });

  it("keeps the cards on screen while another query loads", async () => {
    let release: () => void = () => {};
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(page([libraryEntry({ id: "reading" })])),
    );
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          release = () => resolve(page([libraryEntry({ id: "done" })]));
        }),
    );
    const store = createStore();
    await store.set(syncLibraryPagesAtom);

    store.set(statusTabAtom, "completed");
    const loading = store.set(syncLibraryPagesAtom);

    expect(store.get(libraryPagesAtom)).toMatchObject({
      loading: true,
      items: [{ id: "reading" }],
    });
    release();
    await loading;
    expect(store.get(libraryPagesAtom)).toMatchObject({
      loading: false,
      items: [{ id: "done" }],
    });
  });

  it("does not ask again for pages that are current", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(page([])));
    const store = createStore();

    await store.set(syncLibraryPagesAtom);
    await store.set(syncLibraryPagesAtom);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
