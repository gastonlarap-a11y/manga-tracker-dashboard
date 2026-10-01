import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonResponse } from "../test-utils";
import {
  deleteManga,
  getDuplicates,
  getLibraryPage,
  getLibrarySummary,
  getMangaHistory,
  updateManga,
} from "./client";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

beforeEach(() => {
  fetchMock.mockReset();
});

describe("getLibraryPage", () => {
  it("asks for the first page with the server's defaults when nothing is set", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [], nextCursor: null }));

    const result = await getLibraryPage();

    expect(fetchMock).toHaveBeenCalledWith("/api/library/page", undefined);
    expect(result).toEqual({ ok: true, data: { items: [], nextCursor: null } });
  });

  it("sends every filter that is on, and the tags as one list", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [], nextCursor: null }));

    await getLibraryPage({
      sort: "title",
      limit: 60,
      cursor: "abc",
      status: "completed",
      q: "  invocación ",
      domain: "olympusxyz.com",
      since: "2026-07-01T00:00:00.000Z",
      tags: ["accion", "seinen"],
    });

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]), "http://x");
    expect(url.pathname).toBe("/api/library/page");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      sort: "title",
      limit: "60",
      cursor: "abc",
      status: "completed",
      q: "invocación",
      domain: "olympusxyz.com",
      since: "2026-07-01T00:00:00.000Z",
      tags: "accion,seinen",
    });
  });

  it("leaves out a filter that is off instead of sending it empty", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [], nextCursor: null }));

    await getLibraryPage({ q: "   ", domain: "", tags: [] });

    expect(fetchMock).toHaveBeenCalledWith("/api/library/page", undefined);
  });
});

describe("getLibrarySummary", () => {
  it("reads the totals endpoint", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ counts: {} }));

    await getLibrarySummary();

    expect(fetchMock).toHaveBeenCalledWith("/api/library/summary", undefined);
  });
});

describe("updateManga", () => {
  it("sends a PUT with the provided fields only", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "m1" }));

    await updateManga("m1", { status: "completed", tags: ["accion"] });

    expect(fetchMock).toHaveBeenCalledWith("/api/mangas/m1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed", tags: ["accion"] }),
    });
  });
});

describe("deleteManga", () => {
  it("maps the empty 204 response to ok null", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    const result = await deleteManga("m1");

    expect(fetchMock).toHaveBeenCalledWith("/api/mangas/m1", {
      method: "DELETE",
    });
    expect(result).toEqual({ ok: true, data: null });
  });
});

describe("error handling", () => {
  it("maps API error bodies with their status", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: "Manga not found" }, 404),
    );

    const result = await getMangaHistory("nope");

    expect(result).toEqual({
      ok: false,
      error: "Manga not found",
      status: 404,
    });
  });

  it("falls back to the HTTP status when the body is not JSON", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }));

    const result = await getDuplicates();

    expect(result).toEqual({ ok: false, error: "HTTP 500", status: 500 });
  });

  it("reports network failures", async () => {
    fetchMock.mockRejectedValue(new Error("connection refused"));

    const result = await getDuplicates();

    expect(result).toEqual({ ok: false, error: "connection refused" });
  });
});
