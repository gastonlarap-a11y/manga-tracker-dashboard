import { atom } from "jotai";
import { atomWithRefresh } from "jotai/utils";
import {
  getActivity,
  getCalibrations,
  getDismissals,
  getDuplicates,
  getExtensionConfig,
  getExtensionSettings,
  getLibraryPage,
  getLibrarySummary,
  getSiteRules,
  getSyncStatus,
} from "../api/client";
import type { LibrarySort, MangaStatus } from "../api/types";

export type { LibrarySort };

// What the grid asks the server for. All of it is applied by the server: the
// browser never holds the whole library, so it cannot filter it either.
// domain "" = every domain; sinceDays null = all time.
export const domainFilterAtom = atom("");
export const sinceDaysAtom = atom<number | null>(null);
export type StatusTab = MangaStatus | "all";
export const statusTabAtom = atom<StatusTab>("reading");
/** The search the grid shows — what was typed, once the typing paused. */
export const searchAtom = atom("");
/**
 * How long typing has to pause before a search reaches the server. Each
 * keystroke would otherwise be a request whose answer is stale on arrival.
 */
export const SEARCH_PAUSE_MS = 250;
export const tagFilterAtom = atom<string[]>([]);
export const sortAtom = atom<LibrarySort>("recent");

/** Everything that decides which cards the grid shows, and in what order. */
export interface GridQuery {
  readonly sort: LibrarySort;
  readonly status?: MangaStatus;
  readonly q?: string;
  readonly domain?: string;
  readonly sinceDays?: number;
  readonly tags: readonly string[];
}

export const gridQueryAtom = atom((get): GridQuery => {
  const status = get(statusTabAtom);
  const q = get(searchAtom).trim();
  const domain = get(domainFilterAtom);
  const sinceDays = get(sinceDaysAtom);
  return {
    sort: get(sortAtom),
    ...(status === "all" ? {} : { status }),
    ...(q === "" ? {} : { q }),
    ...(domain === "" ? {} : { domain }),
    ...(sinceDays === null ? {} : { sinceDays }),
    tags: get(tagFilterAtom),
  };
});

// SSE connection state, owned by LiveRefresh and shown by ConnectionBadge.
export type LiveStatus = "connecting" | "live" | "offline";
export const liveStatusAtom = atom<LiveStatus>("connecting");

/**
 * Moved by anything that may have changed what the library shows — a reading
 * arriving, an edit, a merge, a sync. The grid re-reads the pages it holds
 * when it moves (see libraryPages.ts).
 */
export const libraryRevisionAtom = atom(0);

// atomWithRefresh: writing to the atom re-runs the fetch (used by LiveRefresh
// and after mutations).

/** The totals, the counts per tab and the filter options, without the cards. */
export const librarySummaryAtom = atomWithRefresh(async () =>
  getLibrarySummary(),
);

/** The hero and the recents beside it: the next card is the hero's runner-up. */
export const CONTINUE_READING = 9;
export const continueReadingAtom = atomWithRefresh(async () =>
  getLibraryPage({
    sort: "recent",
    status: "reading",
    limit: CONTINUE_READING,
  }),
);

/** Everything the library shows, read again: after a mutation or a live change. */
export const refreshLibraryAtom = atom(null, (_get, set) => {
  set(libraryRevisionAtom, (revision) => revision + 1);
  set(librarySummaryAtom);
  set(continueReadingAtom);
});

// Chapters per day for the activity panel, in this browser's zone.
export const activityAtom = atomWithRefresh(async () =>
  getActivity(Intl.DateTimeFormat().resolvedOptions().timeZone),
);

export const duplicatesAtom = atomWithRefresh(async () => getDuplicates());

/** The pairs dismissed as "no son el mismo", which can be taken back. */
export const dismissalsAtom = atomWithRefresh(async () => getDismissals());

// Off-site sync state, shown by SyncBadge. Refreshed by LiveRefresh on the same
// SSE signal as the data, because a sync that pulls something from another
// machine publishes exactly that event.
export const syncStatusAtom = atomWithRefresh(async () => getSyncStatus());

/** When the browser extension counts a chapter as read. */
export const extensionSettingsAtom = atomWithRefresh(async () =>
  getExtensionSettings(),
);

/**
 * What the extension already knows: the site themes from its config, every
 * site with a curated rule, and the calibrations made from the extension.
 */
export const extensionKnowledgeAtom = atomWithRefresh(async () => {
  const [config, rules, calibrations] = await Promise.all([
    getExtensionConfig(),
    getSiteRules(),
    getCalibrations(),
  ]);
  return { config, rules, calibrations };
});
