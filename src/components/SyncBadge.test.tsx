import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SyncStatusDto } from "../api/types";
import { jsonResponse, renderWithProviders } from "../test-utils";
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
});
