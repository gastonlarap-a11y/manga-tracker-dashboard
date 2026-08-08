import type {
  DuplicatePairDto,
  ErrorResponse,
  HealthResponse,
  LibraryEntryDto,
  MangaDto,
  MangaHistoryDto,
  MergeResultDto,
  SyncResultDto,
  SyncStatusDto,
  UpdateMangaBody,
} from "./types";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

// Paths are relative: in production the API serves this app same-origin, in
// dev the vite proxy forwards /api and /health to localhost:5150.
async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, init);
    if (!response.ok) {
      const body = (await response
        .json()
        .catch(() => null)) as ErrorResponse | null;
      return {
        ok: false,
        error: body?.error ?? `HTTP ${response.status}`,
        status: response.status,
      };
    }
    if (response.status === 204) {
      // Cast justified: 204 responses (DELETE) are only requested as
      // ApiResult<null>; there is no body to parse.
      return { ok: true, data: null as T };
    }
    return { ok: true, data: (await response.json()) as T };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Request failed",
    };
  }
}

export interface LibraryFilters {
  domain?: string;
  since?: string;
}

export function getLibrary(
  filters: LibraryFilters = {},
): Promise<ApiResult<LibraryEntryDto[]>> {
  const params = new URLSearchParams();
  if (filters.domain) {
    params.set("domain", filters.domain);
  }
  if (filters.since) {
    params.set("since", filters.since);
  }
  const query = params.size > 0 ? `?${params.toString()}` : "";
  return request(`/api/library${query}`);
}

export function getMangaHistory(
  id: string,
): Promise<ApiResult<MangaHistoryDto>> {
  return request(`/api/mangas/${encodeURIComponent(id)}/history`);
}

export function updateManga(
  id: string,
  body: UpdateMangaBody,
): Promise<ApiResult<MangaDto>> {
  return request(`/api/mangas/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function deleteManga(id: string): Promise<ApiResult<null>> {
  return request(`/api/mangas/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function getDuplicates(): Promise<ApiResult<DuplicatePairDto[]>> {
  return request("/api/duplicates");
}

// Declares two mangas to be the same series. The canonical keeps the card, its
// name and its status; the other becomes an alias. No reading is moved or lost
// on either side — which is why unmerge below can undo it exactly.
export function mergeMangas(
  canonicalId: string,
  aliasId: string,
): Promise<ApiResult<MergeResultDto>> {
  return request("/api/duplicates/merge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ canonicalId, aliasId }),
  });
}

export function unmergeManga(id: string): Promise<ApiResult<MangaDto>> {
  return request("/api/duplicates/unmerge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
}

// "These two are not the same manga": the pair stops being suggested, here and
// on every other machine after the next sync.
export function dismissDuplicate(
  idA: string,
  idB: string,
): Promise<ApiResult<null>> {
  return request("/api/duplicates/dismiss", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idA, idB }),
  });
}

export function pingHealth(): Promise<ApiResult<HealthResponse>> {
  return request("/health");
}

// Local-only on the backend: it reports the last sync, never dials the cluster,
// so calling it is as cheap as any other read.
export function getSyncStatus(): Promise<ApiResult<SyncStatusDto>> {
  return request("/api/sync/status");
}

// Unlike getSyncStatus this one really does dial the shared store, so it is as
// slow as the network and answers 502 when the cluster is unreachable.
//
// Covers are included because this only runs when you ask for it: the automatic
// schedule moves cover bytes just once every 6 h (they are slow), and a manual
// "sync now" that left the artwork behind would look broken.
export function syncNow(): Promise<ApiResult<SyncResultDto>> {
  return request("/api/sync/now?covers=true", { method: "POST" });
}
