import { type Atom, atom, type PrimitiveAtom, type WritableAtom } from "jotai";
import { getLibraryPage } from "../api/client";
import type { LibraryEntryDto, LibraryPageQuery } from "../api/types";
import { instantDaysBefore } from "../lib/dates";
import {
  followUpQueryAtom,
  type GridQuery,
  gridQueryAtom,
  libraryRevisionAtom,
} from "./atoms";

/** Cards per request: a few screens of the grid at any window size. */
export const PAGE_SIZE = 60;
/** The most the API returns in one page. */
const MAX_PAGE = 200;

/** The pages of a list read so far, and what they are an answer to. */
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

export function queryKey(query: GridQuery): string {
  return JSON.stringify(query);
}

/** The API's form of a list's query. `since` and `before` are instants, taken now. */
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
        : instantDaysBefore(query.sinceDays, now),
    before:
      query.beforeDays === undefined
        ? undefined
        : instantDaysBefore(query.beforeDays, now),
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

/** A list of cards read a page at a time, following its query and the revision. */
export interface PagedList {
  /**
   * In the store rather than in a component's own state, so leaving the list
   * and coming back — or any remount — finds the pages already read instead of
   * starting from nothing.
   */
  readonly pagesAtom: PrimitiveAtom<LibraryPages | null>;
  readonly keyAtom: Atom<string>;
  /**
   * Brings the pages up to date with the current query and revision: a new
   * query reads its first page, a new revision re-reads every card already
   * held — so the list neither shrinks nor jumps under someone scrolled deep
   * into it — and pages that are current are left alone.
   */
  readonly syncAtom: WritableAtom<null, [], Promise<void>>;
  /** The next page of the current query, after the cards already held. */
  readonly loadMoreAtom: WritableAtom<null, [], Promise<void>>;
}

/**
 * One paged list over `queryAtom`. A factory because the grid and the
 * follow-up list need exactly the same behaviour, each with its own pages and
 * its own idea of which request is the newest.
 */
export function createPagedList(queryAtom: Atom<GridQuery>): PagedList {
  const pagesAtom = atom<LibraryPages | null>(null);
  const keyAtom = atom((get) => queryKey(get(queryAtom)));

  // Each request takes a number; only the newest one may write its answer. A
  // search typed while a page loads must not be overwritten by the old page.
  // Per list: one list's request must never discard the other's answer.
  let newestRequest = 0;

  const syncAtom = atom(null, async (get, set) => {
    const query = get(queryAtom);
    const key = queryKey(query);
    const revision = get(libraryRevisionAtom);
    const held = get(pagesAtom);
    const sameQuery = held !== null && held.key === key;
    if (sameQuery && held.revision === revision && held.error === null) {
      return;
    }

    const request = ++newestRequest;
    set(
      pagesAtom,
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
    const wanted = sameQuery
      ? Math.max(PAGE_SIZE, held.items.length)
      : PAGE_SIZE;
    const result = await readFromStart(query, wanted);
    if (request !== newestRequest) {
      return;
    }
    set(
      pagesAtom,
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

  const loadMoreAtom = atom(null, async (get, set) => {
    const held = get(pagesAtom);
    if (
      held === null ||
      held.loading ||
      held.nextCursor === null ||
      held.key !== get(keyAtom)
    ) {
      return;
    }
    const request = ++newestRequest;
    set(pagesAtom, { ...held, loading: true });
    const result = await getLibraryPage({
      ...toPageQuery(held.query),
      limit: PAGE_SIZE,
      cursor: held.nextCursor,
    });
    if (request !== newestRequest) {
      return;
    }
    set(
      pagesAtom,
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

  return { pagesAtom, keyAtom, syncAtom, loadMoreAtom };
}

/** The library's grid. */
export const {
  pagesAtom: libraryPagesAtom,
  keyAtom: gridQueryKeyAtom,
  syncAtom: syncLibraryPagesAtom,
  loadMoreAtom: loadMoreLibraryAtom,
} = createPagedList(gridQueryAtom);

/** The follow-up list: series gone quiet, and series on hold. */
export const followUpPages = createPagedList(followUpQueryAtom);
