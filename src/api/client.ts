import type {
  CalibrationDto,
  DismissalDto,
  DuplicatePairDto,
  ErrorResponse,
  ExtensionConfigDto,
  ExtensionSettingsDto,
  LibraryActivityDto,
  LibraryPageDto,
  LibraryPageQuery,
  LibrarySummaryDto,
  MangaDto,
  MangaHistoryDto,
  MergeResultDto,
  SiteRuleDto,
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

/**
 * One page of the library. The dashboard never asks for the whole list: at ten
 * thousand cards that is megabytes of JSON for a screen that shows thirty.
 * Empty values are left out rather than sent as `q=`, so a filter that is off
 * is not a filter the server applies.
 */
export function getLibraryPage(
  query: LibraryPageQuery = {},
): Promise<ApiResult<LibraryPageDto>> {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries({
    sort: query.sort,
    limit: query.limit === undefined ? undefined : String(query.limit),
    cursor: query.cursor,
    status: query.status,
    q: query.q?.trim(),
    domain: query.domain,
    since: query.since,
    tags: query.tags?.length ? query.tags.join(",") : undefined,
  })) {
    if (value) {
      params.set(name, value);
    }
  }
  const search = params.size > 0 ? `?${params.toString()}` : "";
  return request(`/api/library/page${search}`);
}

export function getLibrarySummary(): Promise<ApiResult<LibrarySummaryDto>> {
  return request("/api/library/summary");
}

// The zone is this browser's: the backend counts days as the reader lived
// them, and it has no way to know which zone that is on its own.
export function getActivity(
  timeZone: string,
  days = 84,
): Promise<ApiResult<LibraryActivityDto>> {
  const params = new URLSearchParams({ days: String(days), tz: timeZone });
  return request(`/api/library/activity?${params.toString()}`);
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

export function getDismissals(): Promise<ApiResult<DismissalDto[]>> {
  return request("/api/duplicates/dismissals");
}

// "Volver a sugerir": the pair is a suggestion again, here and on every other
// machine after the next sync. By slugs, which is what a dismissal holds — a
// side may not even be on this machine.
export function undismissDuplicate(
  slugA: string,
  slugB: string,
): Promise<ApiResult<null>> {
  return request("/api/duplicates/undismiss", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slugA, slugB }),
  });
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

export function getExtensionSettings(): Promise<
  ApiResult<ExtensionSettingsDto>
> {
  return request("/api/extension-settings");
}

// Replaces all three values; the extension picks them up within minutes, and
// at once the next time its popup is opened.
export function saveExtensionSettings(
  settings: ExtensionSettingsDto,
): Promise<ApiResult<ExtensionSettingsDto>> {
  return request("/api/extension-settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
}

export function getExtensionConfig(): Promise<ApiResult<ExtensionConfigDto>> {
  return request("/api/extension-config");
}

export function getSiteRules(): Promise<ApiResult<SiteRuleDto[]>> {
  return request("/api/site-rules");
}

export function getCalibrations(): Promise<ApiResult<CalibrationDto[]>> {
  return request("/api/adapters");
}

// Takes a calibration back, here and on every machine after the next sync;
// the site goes back to its curated rule and the generic detection.
export function removeCalibration(domain: string): Promise<ApiResult<null>> {
  return request(`/api/adapters/${encodeURIComponent(domain)}`, {
    method: "DELETE",
  });
}
