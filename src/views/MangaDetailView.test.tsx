import { fireEvent, screen } from "@testing-library/react";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MangaHistoryDto } from "../api/types";
import {
  actAsync,
  jsonResponse,
  libraryEntry,
  mangaDto,
  renderWithProviders,
  requestBody,
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
  aliases: [],
  events: [
    {
      id: "e1",
      mangaId: "m1",
      chapterLabel: "Cap. 122",
      chapterNumber: 122,
      sourceUrl: "https://olympusxyz.com/capitulo/130729/",
      sourceDomain: "olympusxyz.com",
      readAt: "2026-07-15T10:00:00.000Z",
      alsoReadOn: [],
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

  it("sets a manual cover through the cover editor", async () => {
    await renderDetail();
    await screen.findByRole("heading", { name: "El Genio entrenador" });

    fireEvent.click(screen.getByText("Cambiar imagen…"));
    fireEvent.change(screen.getByLabelText("URL de la imagen"), {
      target: { value: "https://cdn.example.com/portada.jpg" },
    });
    await actAsync(() => {
      fireEvent.click(screen.getByText("Guardar"));
    });

    expect(lastPutBody).toEqual({
      coverUrl: "https://cdn.example.com/portada.jpg",
    });
    expect(screen.getByText("Quitar imagen")).toBeDefined();
  });

  it("clears the manual cover", async () => {
    fetchMock.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/mangas/m1/history") {
          return Promise.resolve(
            jsonResponse({
              ...history,
              manga: { ...manga, coverUrl: "https://cdn.example.com/x.jpg" },
            }),
          );
        }
        if (url === "/api/mangas/m1" && init?.method === "PUT") {
          lastPutBody = JSON.parse(String(init.body));
          return Promise.resolve(jsonResponse({ ...manga, coverUrl: null }));
        }
        if (url.startsWith("/api/library")) {
          return Promise.resolve(jsonResponse([]));
        }
        return Promise.resolve(jsonResponse({ error: "unexpected" }, 500));
      },
    );

    await renderDetail();
    await screen.findByRole("heading", { name: "El Genio entrenador" });

    await actAsync(() => {
      fireEvent.click(screen.getByText("Quitar imagen"));
    });

    expect(lastPutBody).toEqual({ coverUrl: null });
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

describe("MangaDetailView: joining two titles by hand", () => {
  const other = libraryEntry({ id: "m2", canonicalName: "Genius Trainer" });

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/mangas/m1/history") {
          return Promise.resolve(jsonResponse(history));
        }
        if (url === "/api/library") {
          return Promise.resolve(jsonResponse([libraryEntry(), other]));
        }
        if (url === "/api/duplicates/merge" && init?.method === "POST") {
          return Promise.resolve(
            jsonResponse({ canonical: manga, alias: mangaDto({ id: "m2" }) }),
          );
        }
        return Promise.resolve(jsonResponse({}));
      },
    );
  });

  it("merges a manga picked from the library, keeping the one on screen", async () => {
    // The case no heuristic can solve: two titles in different languages.
    await renderDetail();
    await screen.findByRole("heading", { name: "El Genio entrenador" });

    await actAsync(() => {
      fireEvent.click(screen.getByText("Es el mismo que…"));
    });
    await actAsync(() => {
      fireEvent.click(screen.getByText("Genius Trainer"));
    });

    const mergeCall = fetchMock.mock.calls.find(
      (call) => String(call[0]) === "/api/duplicates/merge",
    );
    expect(requestBody(mergeCall)).toEqual({
      canonicalId: "m1",
      aliasId: "m2",
    });
  });

  it("lists the merged-in titles and can detach one again", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/mangas/m1/history") {
        return Promise.resolve(
          jsonResponse({
            ...history,
            aliases: [mangaDto({ id: "m2", canonicalName: "Genius Trainer" })],
          }),
        );
      }
      return Promise.resolve(jsonResponse(mangaDto({ id: "m2" })));
    });

    await renderDetail();
    await screen.findByRole("heading", { name: "El Genio entrenador" });
    expect(screen.getByText("Genius Trainer")).toBeDefined();

    await actAsync(() => {
      fireEvent.click(screen.getByText("Separar"));
    });

    const call = fetchMock.mock.calls.find(
      (entry) => String(entry[0]) === "/api/duplicates/unmerge",
    );
    expect(requestBody(call)).toEqual({ id: "m2" });
  });
});
