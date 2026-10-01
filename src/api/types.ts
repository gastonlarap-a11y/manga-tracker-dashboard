// Hand-duplicated DTOs from manga-tracker-api (Zod schemas in
// src/lib/schemas.ts and src/modules/*/**.routes.ts are the source of truth).
// Contract rule: any change there updates this file in the same commit.

export type MangaStatus = "reading" | "completed" | "dropped";

export interface MangaDto {
  id: string;
  canonicalName: string;
  normalizedSlug: string;
  coverUrl: string | null;
  // Bumped on every cover mutation; cache-busts /cover.
  coverVersion: number;
  hasStoredCover: boolean;
  status: MangaStatus;
  tags: string[];
  createdAt: string;
  // Non-null means this manga was merged into another one and no longer owns a
  // card; the value is the canonical's normalizedSlug.
  mergedIntoSlug: string | null;
}

export interface ReadingEventDto {
  id: string;
  mangaId: string;
  chapterLabel: string;
  chapterNumber: number | null;
  sourceUrl: string;
  sourceDomain: string;
  readAt: string;
}

export interface HistoryEventDto extends ReadingEventDto {
  // Other domains where this same chapter was read. Only non-empty after a
  // merge: the chapter is listed once and this says where else it was read.
  alsoReadOn: string[];
}

export interface LibraryEntryDto {
  id: string;
  canonicalName: string;
  normalizedSlug: string;
  coverUrl: string | null;
  coverVersion: number;
  hasStoredCover: boolean;
  status: MangaStatus;
  tags: string[];
  reachedChapter: { number: number; label: string } | null;
  lastActivity: { readAt: string; chapterLabel: string } | null;
  lastSourceUrl: string | null;
  // Distinct chapters read, not event rows: a chapter read on two merged sites
  // counts once.
  readCount: number;
  sourceDomains: string[];
  // How many other mangas were merged into this card; 0 for an untouched one.
  aliasCount: number;
}

// GET /api/library/page: one page of cards, filtered, searched and ordered by
// the server. `nextCursor` is opaque — passed back as `cursor` — and null on
// the last page.
export interface LibraryPageDto {
  items: LibraryEntryDto[];
  nextCursor: string | null;
}

export type LibrarySort = "recent" | "title" | "chapters";

export interface LibraryPageQuery {
  sort?: LibrarySort;
  // 1..200; the server defaults to 60.
  limit?: number;
  cursor?: string;
  status?: MangaStatus;
  // Accent- and case-insensitive substring of the title.
  q?: string;
  domain?: string;
  // ISO instant: only cards read since then.
  since?: string;
  // A card must carry every one of them.
  tags?: string[];
}

// GET /api/library/summary: the totals and filter options, without the cards.
export interface LibrarySummaryDto {
  counts: { reading: number; completed: number; dropped: number; all: number };
  chapters: number;
  sites: number;
  activeThisWeek: number;
  domains: string[];
  tags: string[];
}

export interface MangaHistoryDto {
  manga: MangaDto;
  // The mangas merged into this one. Empty for an untouched card; each can be
  // detached again from the detail view.
  aliases: MangaDto[];
  events: HistoryEventDto[];
}

// GET /api/library/activity: distinct chapters read per calendar day of the
// reader's time zone, oldest first, every day of the window present (zeros
// included).
export interface ActivityDayDto {
  // `YYYY-MM-DD`, a calendar day in `timeZone` — not an instant.
  date: string;
  chapters: number;
}

export interface LibraryActivityDto {
  timeZone: string;
  days: ActivityDayDto[];
}

export interface UpdateMangaBody {
  canonicalName?: string;
  status?: MangaStatus;
  tags?: string[];
  // string = set a manual cover; null = clear it (next reading may refill)
  coverUrl?: string | null;
}

export interface DuplicatePairDto {
  a: MangaDto;
  b: MangaDto;
  similarity: number;
  // Why the pair was flagged: "tokens", "edit-distance", "containment", "cover".
  reasons: string[];
  // The leftover words look like a season or a spin-off — merging it is a call
  // only the user can make.
  sequelSuspicion: boolean;
}

export interface MergeResultDto {
  canonical: MangaDto;
  // Null when the two ids already belonged to the same card.
  alias: MangaDto | null;
}

interface SyncMovedDto {
  mangas: number;
  events: number;
  adapters: number;
  covers: number;
  dismissals: number;
}

// What one sync moved, in each direction. Returned by POST /api/sync/now and
// remembered in the status as `lastResult`.
export interface SyncResultDto {
  pulled: SyncMovedDto;
  pushed: SyncMovedDto;
}

// State of the two-way sync with the store the other machines share.
// enabled=false just means this install never configured MONGODB_URL.
export interface SyncStatusDto {
  enabled: boolean;
  connected: boolean;
  lastSyncAt: string | null;
  lastResult: SyncResultDto | null;
  lastError: { message: string; at: string } | null;
}

export interface ErrorResponse {
  error: string;
}
