import { act, render } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import type {
  LibraryActivityDto,
  LibraryEntryDto,
  LibrarySummaryDto,
  MangaDto,
  MangaStatus,
} from "./api/types";

// React 19 requires awaiting `act` when a component suspends during render
// (async jotai atoms do); a plain sync render() leaves the retry queued and
// the tree stuck on the Suspense fallback.
export async function renderWithProviders(
  ui: ReactNode,
  options: { route?: string } = {},
): Promise<ReturnType<typeof render>> {
  let result: ReturnType<typeof render> | undefined;
  await act(async () => {
    result = render(
      <Provider store={createStore()}>
        <MemoryRouter initialEntries={[options.route ?? "/"]}>
          {ui}
        </MemoryRouter>
      </Provider>,
    );
  });
  if (!result) {
    throw new Error("render did not run inside act");
  }
  return result;
}

// Wraps an interaction that triggers async updates (suspending atoms, fetch
// continuations) so React flushes them before the next assertion.
export async function actAsync(interaction: () => void): Promise<void> {
  await act(async () => {
    interaction();
  });
}

/**
 * The parsed JSON body of a recorded fetch call. Fails loudly when the call was
 * never made, which is the assertion a test actually wants — reaching into
 * `call?.[1]` would silently read `undefined` instead.
 */
export function requestBody(call: unknown[] | undefined): unknown {
  if (call === undefined) {
    throw new Error("expected a matching fetch call, found none");
  }
  const init = call[1] as RequestInit | undefined;
  return JSON.parse(String(init?.body));
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// The API's search key: lowercase, accents stripped.
function searchKey(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

const WEEK_MS = 7 * 86_400_000;

function compare(a: string | number, b: string | number): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The library endpoints answered the way the API answers them — filtered,
 * searched, ordered and paged — over cards held in memory. The dashboard does
 * none of that itself any more, so a test serving the whole list for every
 * question would test nothing. Returns undefined for any other URL, for the
 * test to answer.
 */
export function fakeLibraryApi(
  entries: readonly LibraryEntryDto[],
  activity: LibraryActivityDto = { timeZone: "UTC", days: [] },
  now: number = Date.now(),
): (input: RequestInfo | URL) => Promise<Response> | undefined {
  return (input) => {
    const url = new URL(String(input), "http://dashboard.test");
    if (url.pathname === "/api/library/activity") {
      return Promise.resolve(jsonResponse(activity));
    }
    const lastRead = (entry: LibraryEntryDto) =>
      entry.lastActivity === null ? 0 : Date.parse(entry.lastActivity.readAt);
    // Read at least once, last before then — what the API's `before` means.
    const quietSince = (entry: LibraryEntryDto, instant: string) =>
      lastRead(entry) > 0 && lastRead(entry) < Date.parse(instant);
    const withStatus = (status: MangaStatus) =>
      entries.filter((entry) => entry.status === status).length;
    if (url.pathname === "/api/library/summary") {
      const staleBefore = url.searchParams.get("staleBefore");
      const summary: LibrarySummaryDto = {
        counts: {
          reading: withStatus("reading"),
          on_hold: withStatus("on_hold"),
          completed: withStatus("completed"),
          dropped: withStatus("dropped"),
          all: entries.length,
        },
        stale:
          staleBefore === null
            ? null
            : entries.filter(
                (entry) =>
                  entry.status === "reading" && quietSince(entry, staleBefore),
              ).length,
        chapters: entries.reduce((sum, entry) => sum + entry.readCount, 0),
        sites: new Set(entries.flatMap((entry) => entry.sourceDomains)).size,
        activeThisWeek: entries.filter(
          (entry) =>
            entry.lastActivity !== null &&
            Date.parse(entry.lastActivity.readAt) >= now - WEEK_MS,
        ).length,
        domains: [
          ...new Set(entries.flatMap((entry) => entry.sourceDomains)),
        ].toSorted(),
        tags: [...new Set(entries.flatMap((entry) => entry.tags))].toSorted(),
      };
      return Promise.resolve(jsonResponse(summary));
    }
    if (url.pathname !== "/api/library/page") {
      return undefined;
    }
    const params = url.searchParams;
    const status = params.get("status");
    const q = searchKey(params.get("q") ?? "");
    const domain = params.get("domain");
    const since = params.get("since");
    const before = params.get("before");
    const tags = params.get("tags")?.split(",") ?? [];
    const matching = entries
      .filter(
        (entry) =>
          (status === null || entry.status === status) &&
          searchKey(entry.canonicalName).includes(q) &&
          (domain === null || entry.sourceDomains.includes(domain)) &&
          (since === null || lastRead(entry) >= Date.parse(since)) &&
          (before === null || quietSince(entry, before)) &&
          tags.every((tag) => entry.tags.includes(tag)),
      )
      .toSorted((a, b) => {
        switch (params.get("sort") ?? "recent") {
          case "title":
            return (
              compare(searchKey(a.canonicalName), searchKey(b.canonicalName)) ||
              compare(a.id, b.id)
            );
          case "chapters":
            return compare(b.readCount, a.readCount) || compare(a.id, b.id);
          // The exact reverse of recent, tie-break included, as the API does.
          case "oldest":
            return compare(lastRead(a), lastRead(b)) || compare(b.id, a.id);
          default:
            return compare(lastRead(b), lastRead(a)) || compare(a.id, b.id);
        }
      });
    // The cursor is opaque to the dashboard; here it is just the offset.
    const offset = Number(params.get("cursor") ?? 0);
    const limit = Number(params.get("limit") ?? 60);
    const items = matching.slice(offset, offset + limit);
    const next = offset + limit;
    return Promise.resolve(
      jsonResponse({
        items,
        nextCursor: next < matching.length ? String(next) : null,
      }),
    );
  };
}

export function mangaDto(overrides: Partial<MangaDto> = {}): MangaDto {
  return {
    id: "m1",
    canonicalName: "One Piece",
    normalizedSlug: "one-piece",
    coverUrl: null,
    coverVersion: 0,
    hasStoredCover: false,
    status: "reading",
    tags: [],
    createdAt: "2026-07-01T00:00:00.000Z",
    mergedIntoSlug: null,
    ...overrides,
  };
}

export function libraryEntry(
  overrides: Partial<LibraryEntryDto> = {},
): LibraryEntryDto {
  return {
    id: "m1",
    canonicalName: "One Piece",
    normalizedSlug: "one-piece",
    coverUrl: null,
    coverVersion: 0,
    hasStoredCover: false,
    status: "reading",
    tags: [],
    reachedChapter: { number: 1100, label: "Cap. 1100" },
    lastActivity: {
      readAt: "2026-07-16T10:00:00.000Z",
      chapterLabel: "Cap. 1100",
    },
    lastSourceUrl: "https://olympusxyz.com/one-piece/capitulo/1100",
    readCount: 3,
    sourceDomains: ["olympusxyz.com"],
    aliasCount: 0,
    ...overrides,
  };
}
