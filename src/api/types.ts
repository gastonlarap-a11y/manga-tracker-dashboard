// Hand-duplicated DTOs from manga-tracker-api (Zod schemas in
// src/lib/schemas.ts and src/modules/*/**.routes.ts are the source of truth).
// Contract rule: any change there updates this file in the same commit.

export interface MangaDto {
  id: string;
  canonicalName: string;
  normalizedSlug: string;
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
  reachedChapter: { number: number; label: string } | null;
  lastActivity: { readAt: string; chapterLabel: string } | null;
  readCount: number;
  sourceDomains: string[];
}

export interface MangaHistoryDto {
  manga: MangaDto;
  events: ReadingEventDto[];
}

export interface DuplicatePairDto {
  a: MangaDto;
  b: MangaDto;
  similarity: number;
}

export interface HealthResponse {
  status: "ok";
}

export interface ErrorResponse {
  error: string;
}
