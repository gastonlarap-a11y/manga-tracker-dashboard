import { fireEvent, screen } from "@testing-library/react";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MangaHistoryDto } from "../api/types";
import { actAsync, jsonResponse, renderWithProviders } from "../test-utils";
import { MangaDetailView } from "./MangaDetailView";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const history: MangaHistoryDto = {
  manga: {
    id: "m1",
    canonicalName: "El Genio entrenador",
    normalizedSlug: "el-genio-entrenador",
    createdAt: "2026-07-01T00:00:00.000Z",
  },
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
    </Routes>,
    { route: "/manga/m1" },
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(
    (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/mangas/m1/history") {
        return Promise.resolve(jsonResponse(history));
      }
      if (url === "/api/mangas/m1" && init?.method === "PUT") {
        return Promise.resolve(
          jsonResponse({ ...history.manga, canonicalName: "El Genio" }),
        );
      }
      if (url.startsWith("/api/library")) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse({ error: "unexpected" }, 500));
    },
  );
});

describe("MangaDetailView", () => {
  it("renders the manga header and its full history", async () => {
    await renderDetail();

    expect(
      await screen.findByRole("heading", { name: "El Genio entrenador" }),
    ).toBeDefined();
    expect(screen.getByText("Cap. 122")).toBeDefined();
    expect(screen.getByRole("link", { name: "Abrir" })).toBeDefined();
    expect(screen.getByText("el-genio-entrenador")).toBeDefined();
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
    const putCall = fetchMock.mock.calls.find(
      (call) => (call[1] as RequestInit | undefined)?.method === "PUT",
    );
    expect(putCall?.[0]).toBe("/api/mangas/m1");
  });

  it("shows the API error when the manga does not exist", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse({ error: "Manga not found" }, 404)),
    );

    await renderDetail();

    expect(await screen.findByText(/Manga not found/)).toBeDefined();
  });
});
