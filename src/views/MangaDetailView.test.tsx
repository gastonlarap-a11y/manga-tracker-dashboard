import { fireEvent, screen } from "@testing-library/react";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MangaHistoryDto } from "../api/types";
import {
  actAsync,
  jsonResponse,
  mangaDto,
  renderWithProviders,
} from "../test-utils";
import { MangaDetailView } from "./MangaDetailView";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const manga = mangaDto({
  id: "m1",
  canonicalName: "El Genio entrenador",
  normalizedSlug: "el-genio-entrenador",
  tags: ["accion"],
});

const history: MangaHistoryDto = {
  manga,
  events: [
    {
      id: "e1",
      mangaId: "m1",
      chapterLabel: "Cap. 122",
      chapterNumber: 122,
      sourceUrl: "https://olympusxyz.com/capitulo/130729/",
      sourceDomain: "olympusxyz.com",
      readAt: "2026-07-15T10:00:00.000Z",
    },
  ],
};

function renderDetail() {
  return renderWithProviders(
    <Routes>
      <Route path="/manga/:id" element={<MangaDetailView />} />
      <Route path="/" element={<p>biblioteca-home</p>} />
    </Routes>,
    { route: "/manga/m1" },
  );
}

let lastPutBody: unknown = null;

beforeEach(() => {
  fetchMock.mockReset();
  lastPutBody = null;
  fetchMock.mockImplementation(
    (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/mangas/m1/history") {
        return Promise.resolve(jsonResponse(history));
      }
      if (url === "/api/mangas/m1" && init?.method === "PUT") {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        lastPutBody = body;
        return Promise.resolve(jsonResponse({ ...manga, ...body }));
      }
      if (url === "/api/mangas/m1" && init?.method === "DELETE") {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url.startsWith("/api/library")) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse({ error: "unexpected" }, 500));
    },
  );
});

describe("MangaDetailView", () => {
  it("renders the header, tags and full history", async () => {
    await renderDetail();

    expect(
      await screen.findByRole("heading", { name: "El Genio entrenador" }),
    ).toBeDefined();
    expect(screen.getByText("Cap. 122")).toBeDefined();
    expect(screen.getByText("accion")).toBeDefined();
    expect(
      screen
        .getByRole("link", { name: "Seguir leyendo ↗" })
        .getAttribute("href"),
    ).toBe("https://olympusxyz.com/capitulo/130729/");
  });

  it("renames the manga through the inline form", async () => {
    await renderDetail();
    await screen.findByRole("heading", { name: "El Genio entrenador" });

    fireEvent.click(screen.getByText("Renombrar"));
    fireEvent.change(screen.getByLabelText("Nuevo nombre"), {
      target: { value: "El Genio" },
    });
    await actAsync(() => {
      fireEvent.click(screen.getByText("Guardar"));
    });

    expect(
      await screen.findByRole("heading", { name: "El Genio" }),
    ).toBeDefined();
    expect(lastPutBody).toEqual({ canonicalName: "El Genio" });
  });

  it("changes the reading status from the segmented control", async () => {
    await renderDetail();
    await screen.findByRole("heading", { name: "El Genio entrenador" });

    await actAsync(() => {
      fireEvent.click(screen.getByRole("button", { name: "Terminado" }));
    });

    expect(lastPutBody).toEqual({ status: "completed" });
    const button = screen.getByRole("button", { name: "Terminado" });
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  it("adds and removes tags through the editor", async () => {
    await renderDetail();
    await screen.findByRole("heading", { name: "El Genio entrenador" });

    fireEvent.change(screen.getByLabelText("Nuevo tag"), {
      target: { value: "Reencarnación" },
    });
    await actAsync(() => {
      fireEvent.submit(screen.getByLabelText("Nuevo tag"));
    });
    expect(lastPutBody).toEqual({ tags: ["accion", "reencarnación"] });

    await actAsync(() => {
      fireEvent.click(screen.getByLabelText("Quitar reencarnación"));
    });
    expect(lastPutBody).toEqual({ tags: ["accion"] });
  });

  it("deletes the manga after an explicit confirmation", async () => {
    await renderDetail();
    await screen.findByRole("heading", { name: "El Genio entrenador" });

    fireEvent.click(screen.getByText("Borrar manga…"));
    await actAsync(() => {
      fireEvent.click(screen.getByText("Sí, borrar"));
    });

    const deleteCall = fetchMock.mock.calls.find(
      (call) => (call[1] as RequestInit | undefined)?.method === "DELETE",
    );
    expect(deleteCall?.[0]).toBe("/api/mangas/m1");
    expect(await screen.findByText("biblioteca-home")).toBeDefined();
  });

  it("shows the API error when the manga does not exist", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse({ error: "Manga not found" }, 404)),
    );

    await renderDetail();

    expect(await screen.findByText(/Manga not found/)).toBeDefined();
  });
});
