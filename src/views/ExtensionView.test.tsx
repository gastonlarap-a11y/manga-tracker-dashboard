import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionSettingsDto } from "../api/types";
import {
  actAsync,
  jsonResponse,
  renderWithProviders,
  requestBody,
} from "../test-utils";
import { ExtensionView } from "./ExtensionView";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const OFF: ExtensionSettingsDto = {
  readingRequired: false,
  readMinSeconds: 30,
  readMinScrollPercent: 80,
};

/** Each endpoint the view reads answered with its own shape. */
function serve(settings: ExtensionSettingsDto = OFF): void {
  let stored = settings;
  let calibrated = ["leercapitulo.com", "lectorxd.com"];
  fetchMock.mockImplementation((path: string, init?: RequestInit) => {
    if (path === "/api/extension-settings") {
      if (init?.method === "PUT") {
        stored = JSON.parse(String(init.body)) as ExtensionSettingsDto;
      }
      return Promise.resolve(jsonResponse(stored));
    }
    if (path === "/api/adapters") {
      return Promise.resolve(
        jsonResponse(
          calibrated.map((domain) => ({
            domain,
            titleSelector: "h1",
            chapterSelector: null,
            updatedAt: "2026-10-02T00:44:54.112Z",
          })),
        ),
      );
    }
    if (path.startsWith("/api/adapters/") && init?.method === "DELETE") {
      const domain = decodeURIComponent(path.slice("/api/adapters/".length));
      calibrated = calibrated.filter((item) => item !== domain);
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    if (path === "/api/extension-config") {
      return Promise.resolve(
        jsonResponse({
          minExtensionVersion: "0.2.0",
          themes: [{ name: "madara" }, { name: "mangathemesia" }],
        }),
      );
    }
    if (path === "/api/site-rules") {
      return Promise.resolve(
        jsonResponse([
          { domain: "manhwaweb.com", series: {}, titleSelector: null },
          // A calibrated site shows up here too; the list of calibrations
          // comes from /api/adapters, never from this.
          { domain: "leercapitulo.com", series: null, titleSelector: "h1" },
        ]),
      );
    }
    return Promise.resolve(jsonResponse({ error: "Not Found" }, 404));
  });
}

function input(label: RegExp): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement;
}

function saveButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: "Guardar" }) as HTMLButtonElement;
}

const SWITCH = { name: /Contar un capítulo recién cuando lo leíste/ };

beforeEach(() => {
  fetchMock.mockReset();
});

describe("ExtensionView", () => {
  it("shows the stored setting, off, with its thresholds disabled", async () => {
    serve();
    await renderWithProviders(<ExtensionView />, { route: "/extension" });

    const toggle = (await screen.findByRole(
      "switch",
      SWITCH,
    )) as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    expect(input(/Tiempo en la página/).closest("fieldset")?.disabled).toBe(
      true,
    );
    // Nothing changed yet, so nothing to save.
    expect(saveButton().disabled).toBe(true);
  });

  it("saves the whole form when it is turned on", async () => {
    serve();
    await renderWithProviders(<ExtensionView />, { route: "/extension" });
    const toggle = await screen.findByRole("switch", SWITCH);

    await actAsync(() => fireEvent.click(toggle));
    await actAsync(() =>
      fireEvent.change(input(/Tiempo en la página/), {
        target: { value: "45" },
      }),
    );
    await actAsync(() => fireEvent.click(saveButton()));

    const put = fetchMock.mock.calls.find(
      ([path, init]) =>
        path === "/api/extension-settings" &&
        (init as RequestInit | undefined)?.method === "PUT",
    );
    expect(requestBody(put)).toEqual({
      readingRequired: true,
      readMinSeconds: 45,
      readMinScrollPercent: 80,
    });
    expect(await screen.findByText("Guardado")).toBeTruthy();
  });

  it("refuses a value no reader could mean before sending it", async () => {
    serve({ ...OFF, readingRequired: true });
    await renderWithProviders(<ExtensionView />, { route: "/extension" });
    const scroll = await screen.findByLabelText(/Hasta dónde bajar/);

    await actAsync(() =>
      fireEvent.change(scroll, { target: { value: "150" } }),
    );

    expect(saveButton().disabled).toBe(true);
    expect(screen.getByText(/el porcentaje de 0 a 100/)).toBeTruthy();
  });

  it("lists the themes, curated sites and calibrations the backend knows", async () => {
    serve();
    await renderWithProviders(<ExtensionView />, { route: "/extension" });

    expect(await screen.findByText("Madara")).toBeTruthy();
    expect(screen.getByText("MangaThemesia")).toBeTruthy();
    expect(screen.getByText("manhwaweb.com")).toBeTruthy();
    expect(screen.getByText("leercapitulo.com")).toBeTruthy();
    expect(screen.getByText("lectorxd.com")).toBeTruthy();
  });

  it("removes a calibration and takes it off the list", async () => {
    serve();
    await renderWithProviders(<ExtensionView />, { route: "/extension" });
    const remove = await screen.findByRole("button", {
      name: "Quitar la calibración de lectorxd.com",
    });

    await actAsync(() => fireEvent.click(remove));

    expect(
      fetchMock.mock.calls.some(
        ([path, init]) =>
          path === "/api/adapters/lectorxd.com" &&
          (init as RequestInit | undefined)?.method === "DELETE",
      ),
    ).toBe(true);
    await waitFor(() => expect(screen.queryByText("lectorxd.com")).toBeNull());
    expect(screen.getByText("leercapitulo.com")).toBeTruthy();
  });

  it("says so when a removal fails, and keeps the calibration listed", async () => {
    serve();
    const served = fetchMock.getMockImplementation();
    fetchMock.mockImplementation((path: string, init?: RequestInit) =>
      init?.method === "DELETE"
        ? Promise.resolve(jsonResponse({ error: "Adapter not found" }, 404))
        : served?.(path, init),
    );
    await renderWithProviders(<ExtensionView />, { route: "/extension" });

    await actAsync(async () =>
      fireEvent.click(
        await screen.findByRole("button", {
          name: "Quitar la calibración de lectorxd.com",
        }),
      ),
    );

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Adapter not found",
    );
    expect(screen.getByText("lectorxd.com")).toBeTruthy();
  });

  it("says so when the settings cannot be read", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "boom" }, 500));
    await renderWithProviders(<ExtensionView />, { route: "/extension" });

    expect(
      (await screen.findAllByRole("alert")).some((alert) =>
        alert.textContent?.includes("boom"),
      ),
    ).toBe(true);
  });
});
