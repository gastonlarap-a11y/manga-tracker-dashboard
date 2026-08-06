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
  readCount: number;
  sourceDomains: string[];
}

export interface MangaHistoryDto {
  manga: MangaDto;
  events: ReadingEventDto[];
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
}

export interface HealthResponse {
  status: "ok";
}

interface SyncMovedDto {
  mangas: number;
  events: number;
  adapters: number;
  covers: number;
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
