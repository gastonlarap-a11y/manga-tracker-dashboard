import { atom } from "jotai";
import { getLibraryPage } from "../api/client";
import type { LibraryEntryDto, LibraryPageQuery } from "../api/types";
import { type GridQuery, gridQueryAtom, libraryRevisionAtom } from "./atoms";

/** Cards per request: a few screens of the grid at any window size. */
export const PAGE_SIZE = 60;
/** The most the API returns in one page. */
const MAX_PAGE = 200;

const DAY_MS = 86_400_000;

/** The pages of the grid read so far, and what they are an answer to. */
export interface LibraryPages {
  /** The query these pages answer, as a key: another one starts over. */
  readonly key: string;
  readonly query: GridQuery;
  /** The library revision they were read at: another one re-reads them. */
  readonly revision: number;
  readonly items: readonly LibraryEntryDto[];
  readonly nextCursor: string | null;
  /** A request is on its way. The items stay on screen meanwhile. */
  readonly loading: boolean;
  readonly error: string | null;
}

/**
 * In the store rather than in the grid's own state, so leaving the library and
 * coming back — or any remount — finds the pages already read instead of
 * starting from an empty grid.
 */
export const libraryPagesAtom = atom<LibraryPages | null>(null);

export function queryKey(query: GridQuery): string {
  return JSON.stringify(query);
}

export const gridQueryKeyAtom = atom((get) => queryKey(get(gridQueryAtom)));

/** The API's form of a grid query. `since` is an instant, taken now. */
export function toPageQuery(
  query: GridQuery,
  now: number = Date.now(),
): LibraryPageQuery {
  return {
    sort: query.sort,
    status: query.status,
    q: query.q,
    domain: query.domain,
    since:
      query.sinceDays === undefined
        ? undefined
        : new Date(now - query.sinceDays * DAY_MS).toISOString(),
    tags: [...query.tags],
  };
}

/**
 * The cards of the next page added after those already held. A card already
 * held is not added twice: a reading that arrives between two pages moves its
 * card to the front, and the second page can then repeat one the first had.
 */
export function appendPage(
  held: readonly LibraryEntryDto[],
  page: readonly LibraryEntryDto[],
): LibraryEntryDto[] {
  const known = new Set(held.map((entry) => entry.id));
  return [...held, ...page.filter((entry) => !known.has(entry.id))];
}

type PagesRead =
  | { ok: true; items: LibraryEntryDto[]; nextCursor: string | null }
  | { ok: false; error: string };

/** At least `wanted` cards from the start, or every card there is. */
async function readFromStart(
  query: GridQuery,
  wanted: number,
): Promise<PagesRead> {
  const request = toPageQuery(query);
  let items: LibraryEntryDto[] = [];
  let cursor: string | undefined;
  do {
    const result = await getLibraryPage({
      ...request,
      limit: Math.min(MAX_PAGE, Math.max(1, wanted - items.length)),
      cursor,
    });
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    items = appendPage(items, result.data.items);
    cursor = result.data.nextCursor ?? undefined;
  } while (cursor !== undefined && items.length < wanted);
  return { ok: true, items, nextCursor: cursor ?? null };
}

// Each request takes a number; only the newest one may write its answer. A
// search typed while a page loads must not be overwritten by the old page.
let newestRequest = 0;

/**
 * Brings the pages up to date with the current query and revision: a new
 * query reads its first page, a new revision re-reads every card already
 * held — so the grid neither shrinks nor jumps under someone scrolled deep
 * into it — and pages that are current are left alone.
 */
export const syncLibraryPagesAtom = atom(null, async (get, set) => {
  const query = get(gridQueryAtom);
  const key = queryKey(query);
  const revision = get(libraryRevisionAtom);
  const held = get(libraryPagesAtom);
  const sameQuery = held !== null && held.key === key;
  if (sameQuery && held.revision === revision && held.error === null) {
    return;
  }

  const request = ++newestRequest;
  set(
    libraryPagesAtom,
    held === null
      ? {
          key,
          query,
          revision,
          items: [],
          nextCursor: null,
          loading: true,
          error: null,
        }
      : { ...held, loading: true },
  );
  const wanted = sameQuery ? Math.max(PAGE_SIZE, held.items.length) : PAGE_SIZE;
  const result = await readFromStart(query, wanted);
  if (request !== newestRequest) {
    return;
  }
  set(
    libraryPagesAtom,
    result.ok
      ? {
          key,
          query,
          revision,
          items: result.items,
          nextCursor: result.nextCursor,
          loading: false,
          error: null,
        }
      : {
          key,
          query,
          revision,
          // A refresh that failed keeps what was on screen; a new query that
          // failed has nothing of its own to show.
          items: sameQuery ? held.items : [],
          nextCursor: sameQuery ? held.nextCursor : null,
          loading: false,
          error: result.error,
        },
  );
});

/** The next page of the current query, after the cards already held. */
export const loadMoreLibraryAtom = atom(null, async (get, set) => {
  const held = get(libraryPagesAtom);
  if (
    held === null ||
    held.loading ||
    held.nextCursor === null ||
    held.key !== get(gridQueryKeyAtom)
  ) {
    return;
  }
  const request = ++newestRequest;
  set(libraryPagesAtom, { ...held, loading: true });
  const result = await getLibraryPage({
    ...toPageQuery(held.query),
    limit: PAGE_SIZE,
    cursor: held.nextCursor,
  });
  if (request !== newestRequest) {
    return;
  }
  set(
    libraryPagesAtom,
    result.ok
      ? {
          ...held,
          items: appendPage(held.items, result.data.items),
          nextCursor: result.data.nextCursor,
          loading: false,
          error: null,
        }
      : { ...held, loading: false, error: result.error },
  );
});
