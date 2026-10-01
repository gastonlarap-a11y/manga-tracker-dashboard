import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LibraryEntryDto, MangaHistoryDto } from "../api/types";
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
      if (url.startsWith("/api/library/page")) {
        return Promise.resolve(page([]));
      }
      return Promise.resolve(jsonResponse({ error: "unexpected" }, 500));
    },
  );
});

function page(items: LibraryEntryDto[]): Response {
  return jsonResponse({ items, nextCursor: null });
}

describe("MangaDetailView", () => {
  it("renders the header, tags and full history", async () => {
    await renderDetail();

    expect(
      await screen.findByRole("heading", { name: "El Genio entrenador" }),
    ).toBeDefined();
    const history = within(screen.getByRole("region", { name: "Historial" }));
    expect(history.getByText("Cap. 122")).toBeDefined();
    expect(
      history
        .getByRole("link", { name: "Abrir Cap. 122" })
        .getAttribute("href"),
    ).toBe("https://olympusxyz.com/capitulo/130729/");
    expect(screen.getByText("accion")).toBeDefined();
    expect(
      screen.getByRole("link", { name: "Seguir leyendo" }).getAttribute("href"),
    ).toBe("https://olympusxyz.com/capitulo/130729/");
  });

  it("keeps the slug out of the way, under the technical details", async () => {
    await renderDetail();
    await screen.findByRole("heading", { name: "El Genio entrenador" });

    const slug = screen.getByText("el-genio-entrenador");
    expect(slug.closest("details")?.querySelector("summary")?.textContent).toBe(
      "Detalles técnicos",
    );
  });

  it("shows what the library already knows while the history loads", async () => {
    let releaseHistory: () => void = () => {};
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/mangas/m1/history") {
        return new Promise<Response>((resolve) => {
          releaseHistory = () => resolve(jsonResponse(history));
        });
      }
      if (url.startsWith("/api/library/page")) {
        return Promise.resolve(
          page([
            libraryEntry({ id: "m1", canonicalName: "El Genio entrenador" }),
          ]),
        );
      }
      return Promise.resolve(jsonResponse({ error: "unexpected" }, 500));
    });

    await renderDetail();

    expect(await screen.findByText("El Genio entrenador")).toBeDefined();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    await actAsync(() => releaseHistory());
    expect(
      await screen.findByRole("heading", { name: "El Genio entrenador" }),
    ).toBeDefined();
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
        if (url.startsWith("/api/library/page")) {
          return Promise.resolve(page([]));
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

  it("shows the latest readings first and the rest on request", async () => {
    const events = Array.from({ length: 400 }, (_, index) => ({
      ...history.events[0],
      id: `e${index}`,
      chapterLabel: `Cap. ${400 - index}`,
      chapterNumber: 400 - index,
      readAt: new Date(Date.UTC(2026, 6, 15) - index * 3_600_000).toISOString(),
    })) as MangaHistoryDto["events"];
    fetchMock.mockImplementation((input: RequestInfo | URL) =>
      String(input) === "/api/mangas/m1/history"
        ? Promise.resolve(jsonResponse({ ...history, events }))
        : Promise.resolve(page([])),
    );

    await renderDetail();
    const region = within(
      await screen.findByRole("region", { name: "Historial" }),
    );
    expect(region.getAllByRole("link", { name: /^Abrir Cap/ })).toHaveLength(
      150,
    );

    await actAsync(() => {
      fireEvent.click(
        region.getByRole("button", {
          name: "Mostrar 150 más · quedan 250 capítulos",
        }),
      );
    });

    expect(region.getAllByRole("link", { name: /^Abrir Cap/ })).toHaveLength(
      300,
    );
    expect(
      region.getByRole("button", {
        name: "Mostrar 100 más · quedan 100 capítulos",
      }),
    ).toBeDefined();
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
        if (url.startsWith("/api/library/page")) {
          return Promise.resolve(page([libraryEntry(), other]));
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
    const option = await screen.findByText("Genius Trainer");
    await actAsync(() => {
      fireEvent.click(option);
    });

    const mergeCall = fetchMock.mock.calls.find(
      (call) => String(call[0]) === "/api/duplicates/merge",
    );
    expect(requestBody(mergeCall)).toEqual({
      canonicalId: "m1",
      aliasId: "m2",
    });
  });

  it("searches the whole library for the other title, not a list in hand", async () => {
    await renderDetail();
    await screen.findByRole("heading", { name: "El Genio entrenador" });
    await actAsync(() => {
      fireEvent.click(screen.getByText("Es el mismo que…"));
    });
    await screen.findByText("Genius Trainer");
    // The server's answer includes m1 — the manga on screen, under the
    // fixture's default name — and it is never offered as its own duplicate.
    expect(screen.queryByText("One Piece")).toBeNull();

    await actAsync(() => {
      fireEvent.change(screen.getByLabelText("Buscar el manga a unir"), {
        target: { value: "genius" },
      });
    });

    await waitFor(() =>
      expect(
        fetchMock.mock.calls
          .map((call) => new URL(String(call[0]), "http://dashboard.test"))
          .some(
            (url) =>
              url.pathname === "/api/library/page" &&
              url.searchParams.get("q") === "genius",
          ),
      ).toBe(true),
    );
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
      if (url.startsWith("/api/library/page")) {
        return Promise.resolve(page([]));
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
