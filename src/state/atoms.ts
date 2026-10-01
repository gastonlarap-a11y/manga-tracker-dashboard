import { atom } from "jotai";
import { atomWithRefresh } from "jotai/utils";
import {
  getActivity,
  getDuplicates,
  getLibrary,
  getSyncStatus,
} from "../api/client";
import type { MangaStatus } from "../api/types";

// Library filters, shared between the toolbar and the grid.
// domain "" = every domain; sinceDays null = all time.
export const domainFilterAtom = atom("");
export const sinceDaysAtom = atom<number | null>(null);

// Client-side refinements (the dataset is small, so these never refetch).
export type StatusTab = MangaStatus | "all";
export const statusTabAtom = atom<StatusTab>("reading");
export const searchAtom = atom("");
export const tagFilterAtom = atom<string[]>([]);

// "recent" is the order the API already sends (most recently read first), so
// it costs no sorting at all.
export type LibrarySort = "recent" | "title" | "chapters";
export const sortAtom = atom<LibrarySort>("recent");

// SSE connection state, owned by LiveRefresh and shown by ConnectionBadge.
export type LiveStatus = "connecting" | "live" | "offline";
export const liveStatusAtom = atom<LiveStatus>("connecting");

const DAY_MS = 86_400_000;

// atomWithRefresh: writing to the atom re-runs the fetch (used by LiveRefresh
// and after mutations).
export const libraryAtom = atomWithRefresh(async (get) => {
  const domain = get(domainFilterAtom);
  const sinceDays = get(sinceDaysAtom);
  return getLibrary({
    domain: domain === "" ? undefined : domain,
    since:
      sinceDays === null
        ? undefined
        : new Date(Date.now() - sinceDays * DAY_MS).toISOString(),
  });
});

// Unfiltered snapshot: feeds the stats row and the domain/tag options, so the
// selects keep every option while a filter is active.
export const baseLibraryAtom = atomWithRefresh(async () => getLibrary());

export const knownDomainsAtom = atom(async (get) => {
  const result = await get(baseLibraryAtom);
  if (!result.ok) {
    return [];
  }
  const domains = result.data.flatMap((entry) => entry.sourceDomains);
  return [...new Set(domains)].sort();
});

export const knownTagsAtom = atom(async (get) => {
  const result = await get(baseLibraryAtom);
  if (!result.ok) {
    return [];
  }
  const tags = result.data.flatMap((entry) => entry.tags);
  return [...new Set(tags)].sort();
});

// How many cards each status tab holds, from the unfiltered snapshot: the
// counts say what is in the library, not what the current filters let through.
export const statusCountsAtom = atom(async (get) => {
  const result = await get(baseLibraryAtom);
  const counts: Record<StatusTab, number> = {
    reading: 0,
    completed: 0,
    dropped: 0,
    all: 0,
  };
  if (result.ok) {
    for (const entry of result.data) {
      counts[entry.status] += 1;
      counts.all += 1;
    }
  }
  return counts;
});

// Chapters per day for the activity panel, in this browser's zone.
export const activityAtom = atomWithRefresh(async () =>
  getActivity(Intl.DateTimeFormat().resolvedOptions().timeZone),
);

export const duplicatesAtom = atomWithRefresh(async () => getDuplicates());

// Off-site sync state, shown by SyncBadge. Refreshed by LiveRefresh on the same
// SSE signal as the data, because a sync that pulls something from another
// machine publishes exactly that event.
export const syncStatusAtom = atomWithRefresh(async () => getSyncStatus());
