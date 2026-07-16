import type {
  DuplicatePairDto,
  ErrorResponse,
  HealthResponse,
  LibraryEntryDto,
  MangaDto,
  MangaHistoryDto,
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

export function updateMangaName(
  id: string,
  canonicalName: string,
): Promise<ApiResult<MangaDto>> {
  return request(`/api/mangas/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ canonicalName }),
  });
}

export function getDuplicates(): Promise<ApiResult<DuplicatePairDto[]>> {
  return request("/api/duplicates");
}

export function pingHealth(): Promise<ApiResult<HealthResponse>> {
  return request("/health");
}
