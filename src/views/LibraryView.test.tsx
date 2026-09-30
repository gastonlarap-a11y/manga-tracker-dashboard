import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  actAsync,
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
});

beforeEach(() => {
  fetchMock.mockReset();
  // A Response body is single-use: build a fresh one per fetch call.
  fetchMock.mockImplementation(() =>
    Promise.resolve(jsonResponse([reading, completed])),
  );
});

describe("LibraryView", () => {
  it("shows reading entries as cards and hides finished ones by default", async () => {
    await renderWithProviders(<LibraryView />);

    expect(await screen.findByText("One Piece")).toBeDefined();
    expect(screen.queryByText("Solo Leveling")).toBeNull();
    expect(screen.getByText("Cap. 1100")).toBeDefined();
  });

  it("shows finished mangas under their own tab", async () => {
    await renderWithProviders(<LibraryView />);
    await screen.findByText("One Piece");

    await actAsync(() => {
      fireEvent.click(screen.getByRole("button", { name: "Terminados" }));
    });

    expect(screen.getByText("Solo Leveling")).toBeDefined();
    expect(screen.queryByText("One Piece")).toBeNull();
  });

  it("filters by accent-insensitive search", async () => {
    await renderWithProviders(<LibraryView />);
    await screen.findByText("One Piece");

    await actAsync(() => {
      fireEvent.change(screen.getByLabelText("Buscar"), {
        target: { value: "one piece" },
      });
    });

    expect(screen.getByText("One Piece")).toBeDefined();

    await actAsync(() => {
      fireEvent.change(screen.getByLabelText("Buscar"), {
        target: { value: "zzz" },
      });
    });

    expect(screen.queryByText("One Piece")).toBeNull();
    expect(
      screen.getByText("Nada coincide con los filtros en esta pestaña."),
    ).toBeDefined();
  });

  it("filters by tag chips", async () => {
    await renderWithProviders(<LibraryView />);
    await screen.findByText("One Piece");

    await actAsync(() => {
      fireEvent.click(screen.getByRole("button", { name: "Todos" }));
    });
    await actAsync(() => {
      fireEvent.click(screen.getByRole("button", { name: "accion" }));
    });

    expect(screen.getByText("Solo Leveling")).toBeDefined();
    expect(screen.queryByText("One Piece")).toBeNull();
  });

  it("says which tag chips are on, the way the status tabs already did", async () => {
    await renderWithProviders(<LibraryView />);
    await screen.findByText("One Piece");
    await actAsync(() => {
      fireEvent.click(screen.getByRole("button", { name: "Todos" }));
    });

    const chip = () => screen.getByRole("button", { name: "accion" });
    expect(chip().getAttribute("aria-pressed")).toBe("false");
    await actAsync(() => {
      fireEvent.click(chip());
    });
    expect(chip().getAttribute("aria-pressed")).toBe("true");
  });

  it("gives each card one link, named after its manga", async () => {
    // The cover used to be a second, unnamed link to the same page.
    await renderWithProviders(<LibraryView />);
    await screen.findByText("One Piece");

    const links = screen
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

  it("links continue-reading to the last chapter url", async () => {
    await renderWithProviders(<LibraryView />);
    await screen.findByText("One Piece");

    const link = screen.getByRole("link", { name: "Seguir leyendo ↗" });
    expect(link.getAttribute("href")).toBe(
      "https://olympusxyz.com/one-piece/capitulo/1100",
    );
  });

  it("derives the stats row from the unfiltered library", async () => {
    await renderWithProviders(<LibraryView />);
    await screen.findByText("One Piece");

    expect(screen.getByText("En lectura").previousSibling?.textContent).toBe(
      "1",
    );
    expect(
      screen.getByText("Capítulos leídos").previousSibling?.textContent,
    ).toBe("6");
  });

  it("refetches with the selected domain filter", async () => {
    await renderWithProviders(<LibraryView />);
    await screen.findByText("One Piece");
    await screen.findByRole("option", { name: "olympusxyz.com" });

    await actAsync(() => {
      fireEvent.change(screen.getByLabelText(/Sitio/), {
        target: { value: "olympusxyz.com" },
      });
    });

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls).toContain("/api/library?domain=olympusxyz.com");
  });

  it("shows the empty state when there are no readings", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse([])));

    await renderWithProviders(<LibraryView />);

    expect(await screen.findByText(/Sin lecturas todavía/)).toBeDefined();
  });
});
