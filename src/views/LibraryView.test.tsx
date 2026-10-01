import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LibraryActivityDto, LibraryEntryDto } from "../api/types";
import {
  actAsync,
  fakeLibraryApi,
  jsonResponse,
  libraryEntry,
  renderWithProviders,
} from "../test-utils";
import { LibraryView } from "./LibraryView";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const reading = libraryEntry();
const completed = libraryEntry({
  id: "m2",
  canonicalName: "Solo Leveling",
  normalizedSlug: "solo-leveling",
  status: "completed",
  tags: ["accion"],
  reachedChapter: { number: 179, label: "Cap. 179" },
  lastSourceUrl: "https://olympusxyz.com/solo-leveling/capitulo/179",
  readCount: 179,
});

/** Fourteen days ending on a Thursday: 3 chapters a day this week, 1 before. */
const activity: LibraryActivityDto = {
  timeZone: "America/Santiago",
  days: Array.from({ length: 14 }, (_, index) => ({
    date: new Date(Date.UTC(2026, 8, 18 + index)).toISOString().slice(0, 10),
    chapters: index < 7 ? 1 : 3,
  })),
};

/** Answers each endpoint the library page reads the way the API would. */
function serve(library: LibraryEntryDto[]) {
  const api = fakeLibraryApi(library, activity);
  fetchMock.mockImplementation(
    (input: RequestInfo | URL) =>
      api(input) ?? Promise.resolve(jsonResponse({ error: "unexpected" }, 500)),
  );
}

/** Every URL the page asked for, in order. */
function requested(): URL[] {
  return fetchMock.mock.calls.map(
    (call) => new URL(String(call[0]), "http://dashboard.test"),
  );
}

/** The collection itself — the hero and the recents above repeat titles. */
async function grid() {
  return within(await screen.findByRole("list", { name: "Mangas" }));
}

beforeEach(() => {
  fetchMock.mockReset();
  serve([reading, completed]);
});

describe("LibraryView", () => {
  it("shows reading entries as cards and hides finished ones by default", async () => {
    await renderWithProviders(<LibraryView />);

    const cards = await grid();
    expect(cards.getByText("One Piece")).toBeDefined();
    expect(cards.queryByText("Solo Leveling")).toBeNull();
    expect(cards.getByText("Cap. 1100")).toBeDefined();
  });

  it("shows finished mangas under their own tab", async () => {
    await renderWithProviders(<LibraryView />);
    await grid();

    await actAsync(() => {
      fireEvent.click(screen.getByRole("button", { name: /^Terminados/ }));
    });

    const cards = await grid();
    expect(cards.getByText("Solo Leveling")).toBeDefined();
    expect(cards.queryByText("One Piece")).toBeNull();
  });

  it("says how many cards each tab holds", async () => {
    await renderWithProviders(<LibraryView />);
    await grid();

    expect(
      await screen.findByRole("button", { name: "Leyendo 1" }),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "Terminados 1" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Todos 2" })).toBeDefined();
  });

  it("asks the server to search once the typing pauses", async () => {
    serve([
      reading,
      libraryEntry({ id: "m3", canonicalName: "Invocación de la villana" }),
    ]);
    await renderWithProviders(<LibraryView />);
    await grid();

    await actAsync(() => {
      fireEvent.change(screen.getByLabelText("Buscar"), {
        target: { value: "invocacion" },
      });
    });
    // What was typed shows at once; the request waits for the pause.
    expect((screen.getByLabelText("Buscar") as HTMLInputElement).value).toBe(
      "invocacion",
    );
    expect(requested().some((url) => url.searchParams.has("q"))).toBe(false);

    await waitFor(async () =>
      expect((await grid()).queryByText("One Piece")).toBeNull(),
    );
    expect((await grid()).getByText("Invocación de la villana")).toBeDefined();
    const searches = requested().filter((url) => url.searchParams.has("q"));
    expect(searches.map((url) => url.searchParams.get("q"))).toEqual([
      "invocacion",
    ]);
  });

  it("says when nothing matches the search", async () => {
    await renderWithProviders(<LibraryView />);
    await grid();

    await actAsync(() => {
      fireEvent.change(screen.getByLabelText("Buscar"), {
        target: { value: "zzz" },
      });
    });

    expect(
      await screen.findByText("Nada coincide con los filtros en esta pestaña."),
    ).toBeDefined();
    expect(screen.queryByRole("list", { name: "Mangas" })).toBeNull();
  });

  it("loads the next page as the end of the grid comes near", async () => {
    const many = Array.from({ length: 130 }, (_, index) =>
      libraryEntry({
        id: `m${String(index).padStart(3, "0")}`,
        canonicalName: `Serie ${index}`,
        lastActivity: {
          readAt: new Date(Date.UTC(2026, 6, 1) - index * 60_000).toISOString(),
          chapterLabel: "Cap. 1",
        },
      }),
    );
    serve(many);
    await renderWithProviders(<LibraryView />);

    // Without a layout to measure, every loaded row is "near the end", so
    // the pages follow one another until the last.
    await waitFor(async () =>
      expect((await grid()).getAllByRole("listitem")).toHaveLength(130),
    );
    const pages = requested().filter(
      (url) =>
        url.pathname === "/api/library/page" &&
        url.searchParams.get("limit") === "60",
    );
    expect(pages.map((url) => url.searchParams.get("cursor"))).toEqual([
      null,
      "60",
      "120",
    ]);
  });

  it("filters by tag chips", async () => {
    await renderWithProviders(<LibraryView />);
    await grid();

    await actAsync(() => {
      fireEvent.click(screen.getByRole("button", { name: /^Todos/ }));
    });
    await actAsync(() => {
      fireEvent.click(screen.getByRole("button", { name: "accion" }));
    });

    const cards = await grid();
    expect(cards.getByText("Solo Leveling")).toBeDefined();
    expect(cards.queryByText("One Piece")).toBeNull();
  });

  it("says which tag chips are on, the way the status tabs already did", async () => {
    await renderWithProviders(<LibraryView />);
    await grid();
    await actAsync(() => {
      fireEvent.click(screen.getByRole("button", { name: /^Todos/ }));
    });

    const chip = () => screen.getByRole("button", { name: "accion" });
    expect(chip().getAttribute("aria-pressed")).toBe("false");
    await actAsync(() => {
      fireEvent.click(chip());
    });
    expect(chip().getAttribute("aria-pressed")).toBe("true");
  });

  it("sorts the grid by title when asked", async () => {
    serve([
      libraryEntry({ id: "z", canonicalName: "Zetman" }),
      libraryEntry({ id: "a", canonicalName: "Ásura" }),
    ]);
    await renderWithProviders(<LibraryView />);
    await grid();

    await actAsync(() => {
      fireEvent.change(screen.getByLabelText(/Orden/), {
        target: { value: "title" },
      });
    });

    const titles = (await grid())
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("/manga/"))
      .map((link) => link.textContent);
    expect(titles).toEqual(["Ásura", "Zetman"]);
  });

  it("gives each card one link, named after its manga", async () => {
    // The cover used to be a second, unnamed link to the same page.
    await renderWithProviders(<LibraryView />);

    const links = (await grid())
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href") === "/manga/m1");
    expect(links.map((link) => link.textContent)).toEqual(["One Piece"]);
  });

  it("opens with a heading a screen reader can land on", async () => {
    await renderWithProviders(<LibraryView />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Biblioteca" }),
    ).toBeDefined();
  });

  it("offers to keep reading each card from its last chapter", async () => {
    await renderWithProviders(<LibraryView />);

    const link = (await grid()).getByRole("link", {
      name: "Seguir leyendo One Piece",
    });
    expect(link.getAttribute("href")).toBe(
      "https://olympusxyz.com/one-piece/capitulo/1100",
    );
  });

  it("puts the manga read last up top, one click from its chapter", async () => {
    await renderWithProviders(<LibraryView />);
    await grid();

    const hero = within(screen.getByRole("region", { name: "One Piece" }));
    expect(
      hero.getByRole("link", { name: "Seguir leyendo" }).getAttribute("href"),
    ).toBe("https://olympusxyz.com/one-piece/capitulo/1100");
  });

  it("derives the stats row from the unfiltered library", async () => {
    await renderWithProviders(<LibraryView />);
    await grid();

    expect(screen.getByText("En lectura").previousSibling?.textContent).toBe(
      "1",
    );
    expect(
      screen.getByText("Capítulos leídos").previousSibling?.textContent,
    ).toBe("182");
  });

  it("sums the last seven days and compares them with the seven before", async () => {
    await renderWithProviders(<LibraryView />);

    const panel = within(
      await screen.findByRole("region", { name: "Actividad" }),
    );
    expect(
      (await panel.findByText("capítulos en los últimos 7 días"))
        .previousSibling?.textContent,
    ).toBe("21");
    expect(panel.getByText(/\+200 % vs\. los 7 anteriores/)).toBeDefined();
    expect(panel.getByText(/Racha de 14 días/)).toBeDefined();
  });

  it("asks for the activity in this browser's time zone", async () => {
    await renderWithProviders(<LibraryView />);
    await grid();

    const url = requested().find(
      (called) => called.pathname === "/api/library/activity",
    );
    expect(url?.searchParams.get("tz")).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  });

  it("asks the server for the selected site", async () => {
    await renderWithProviders(<LibraryView />);
    await grid();
    await screen.findByRole("option", { name: "olympusxyz.com" });

    await actAsync(() => {
      fireEvent.change(screen.getByLabelText(/Sitio/), {
        target: { value: "olympusxyz.com" },
      });
    });

    await waitFor(() =>
      expect(
        requested().some(
          (url) =>
            url.pathname === "/api/library/page" &&
            url.searchParams.get("domain") === "olympusxyz.com",
        ),
      ).toBe(true),
    );
  });

  it("never asks for the whole library", async () => {
    await renderWithProviders(<LibraryView />);
    await grid();

    expect(requested().map((url) => url.pathname)).not.toContain(
      "/api/library",
    );
  });

  it("shows the empty state when there are no readings", async () => {
    serve([]);

    await renderWithProviders(<LibraryView />);

    expect(await screen.findByText(/Sin lecturas todavía/)).toBeDefined();
  });
});
