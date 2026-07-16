import { atom } from "jotai";
import { atomWithRefresh } from "jotai/utils";
import { getDuplicates, getLibrary } from "../api/client";

// Library filters, shared between the filter bar and the table.
// domain "" = every domain; sinceDays null = all time.
export const domainFilterAtom = atom("");
export const sinceDaysAtom = atom<number | null>(null);

const DAY_MS = 86_400_000;

// atomWithRefresh: writing to the atom re-runs the fetch (used after renames).
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

// Unfiltered fetch so the domain <select> keeps every option while a domain
// filter is active (the filtered projection only contains the chosen one).
export const knownDomainsAtom = atom(async () => {
  const result = await getLibrary();
  if (!result.ok) {
    return [];
  }
  const domains = result.data.flatMap((entry) => entry.sourceDomains);
  return [...new Set(domains)].sort();
});

export const duplicatesAtom = atomWithRefresh(async () => getDuplicates());
