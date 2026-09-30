import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonResponse } from "../test-utils";
import {
  deleteManga,
  getDuplicates,
  getLibrary,
  getMangaHistory,
  updateManga,
} from "./client";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

beforeEach(() => {
  fetchMock.mockReset();
});

describe("getLibrary", () => {
  it("requests the plain library when no filters are set", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    const result = await getLibrary();

    expect(fetchMock).toHaveBeenCalledWith("/api/library", undefined);
    expect(result).toEqual({ ok: true, data: [] });
  });

  it("passes domain and since as query params", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await getLibrary({
      domain: "olympusxyz.com",
      since: "2026-07-01T00:00:00.000Z",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/library?domain=olympusxyz.com&since=2026-07-01T00%3A00%3A00.000Z",
      undefined,
    );
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
