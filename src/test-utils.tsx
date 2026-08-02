import { act, render } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import type { LibraryEntryDto, MangaDto } from "./api/types";

// React 19 requires awaiting `act` when a component suspends during render
// (async jotai atoms do); a plain sync render() leaves the retry queued and
// the tree stuck on the Suspense fallback.
export async function renderWithProviders(
  ui: ReactNode,
  options: { route?: string } = {},
): Promise<ReturnType<typeof render>> {
  let result: ReturnType<typeof render> | undefined;
  await act(async () => {
    result = render(
      <Provider store={createStore()}>
        <MemoryRouter initialEntries={[options.route ?? "/"]}>
          {ui}
        </MemoryRouter>
      </Provider>,
    );
  });
  if (!result) {
    throw new Error("render did not run inside act");
  }
  return result;
}

// Wraps an interaction that triggers async updates (suspending atoms, fetch
// continuations) so React flushes them before the next assertion.
export async function actAsync(interaction: () => void): Promise<void> {
  await act(async () => {
    interaction();
  });
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function mangaDto(overrides: Partial<MangaDto> = {}): MangaDto {
  return {
    id: "m1",
    canonicalName: "One Piece",
    normalizedSlug: "one-piece",
    coverUrl: null,
    coverVersion: 0,
    hasStoredCover: false,
    status: "reading",
    tags: [],
    createdAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

export function libraryEntry(
  overrides: Partial<LibraryEntryDto> = {},
): LibraryEntryDto {
  return {
    id: "m1",
    canonicalName: "One Piece",
    normalizedSlug: "one-piece",
    coverUrl: null,
    coverVersion: 0,
    hasStoredCover: false,
    status: "reading",
    tags: [],
    reachedChapter: { number: 1100, label: "Cap. 1100" },
    lastActivity: {
      readAt: "2026-07-16T10:00:00.000Z",
      chapterLabel: "Cap. 1100",
    },
    lastSourceUrl: "https://olympusxyz.com/one-piece/capitulo/1100",
    readCount: 3,
    sourceDomains: ["olympusxyz.com"],
    ...overrides,
  };
}
