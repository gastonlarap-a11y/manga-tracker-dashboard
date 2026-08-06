import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SyncStatusDto } from "../api/types";
import { actAsync, jsonResponse, renderWithProviders } from "../test-utils";
import { SyncBadge } from "./SyncBadge";

const status = (over: Partial<SyncStatusDto> = {}): SyncStatusDto => ({
  enabled: true,
  connected: true,
  lastSyncAt: new Date(Date.now() - 2 * 60_000).toISOString(),
  lastResult: null,
  lastError: null,
  ...over,
});

function mockStatus(body: SyncStatusDto): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => jsonResponse(body)),
  );
}

/**
 * Answers the status GET and the sync POST separately, so a test can let the
 * status succeed while the sync fails — which is the interesting case, and the
 * one a single blanket stub cannot express.
 */
function mockStatusAndSync(
  body: SyncStatusDto,
  syncResponse: () => Response,
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: string) =>
    input.startsWith("/api/sync/now") ? syncResponse() : jsonResponse(body),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const moved = { mangas: 0, events: 0, adapters: 0, covers: 0 };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SyncBadge", () => {
  it("reports how long ago the last sync ran", async () => {
    mockStatus(status());

    await renderWithProviders(<SyncBadge />);

    expect(screen.getByText(/Sincronizado/)).toBeTruthy();
  });

  it("renders nothing when this install never configured the off-site store", async () => {
    // An empty header beats a badge reporting on a feature nobody turned on.
    mockStatus(status({ enabled: false }));

    const { container } = await renderWithProviders(<SyncBadge />);

    expect(container.textContent).toBe("");
  });

  it("reports a disconnection instead of a reassuring timestamp", async () => {
    // "Synced 2 min ago" next to a dead connection is true and misleading.
    mockStatus(status({ connected: false }));

    await renderWithProviders(<SyncBadge />);

    expect(screen.getByText("Sin sincronizar")).toBeTruthy();
  });

  it("prefers the error over the last successful sync", async () => {
    mockStatus(
      status({
        lastError: { message: "ECONNREFUSED", at: new Date().toISOString() },
      }),
    );

    await renderWithProviders(<SyncBadge />);

    const badge = screen.getByText("Sin sincronizar");
    expect(badge.getAttribute("title")).toBe("ECONNREFUSED");
  });

  it("says it is working when nothing has synced yet", async () => {
    mockStatus(status({ lastSyncAt: null }));

    await renderWithProviders(<SyncBadge />);

    expect(screen.getByText("Sincronizando…")).toBeTruthy();
  });

  it("stays silent when the status request itself fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "boom" }, 500)),
    );

    const { container } = await renderWithProviders(<SyncBadge />);

    expect(container.textContent).toBe("");
  });

  it("syncs on click, covers included", async () => {
    // The automatic schedule only pulls at boot and every 6 h, and covers move
    // on the 6 h pass alone — a manual sync that skipped them would leave the
    // artwork missing on the machine that just asked for it.
    const fetchMock = mockStatusAndSync(status(), () =>
      jsonResponse({ pulled: moved, pushed: moved }),
    );

    await renderWithProviders(<SyncBadge />);
    await actAsync(() => screen.getByRole("button").click());

    const call = fetchMock.mock.calls.find((args) =>
      String(args[0]).startsWith("/api/sync/now"),
    );
    expect(call?.[0]).toBe("/api/sync/now?covers=true");
    expect(call?.[1]).toEqual({ method: "POST" });
  });

  it("surfaces a failed sync instead of leaving the old timestamp up", async () => {
    // 502 is the backend's expected answer when the shared store is
    // unreachable, not a bug — but the badge must stop claiming it is synced.
    mockStatusAndSync(status(), () =>
      jsonResponse({ error: "querySrv ECONNREFUSED" }, 502),
    );

    await renderWithProviders(<SyncBadge />);
    await actAsync(() => screen.getByRole("button").click());

    const badge = screen.getByText("Sin sincronizar");
    expect(badge.getAttribute("title")).toBe("querySrv ECONNREFUSED");
  });
});
