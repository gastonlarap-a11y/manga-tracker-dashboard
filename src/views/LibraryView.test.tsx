import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LibraryEntryDto } from "../api/types";
import { actAsync, jsonResponse, renderWithProviders } from "../test-utils";
import { LibraryView } from "./LibraryView";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const entry: LibraryEntryDto = {
  id: "m1",
  canonicalName: "One Piece",
  normalizedSlug: "one-piece",
  reachedChapter: { number: 1100, label: "Cap. 1100" },
  lastActivity: {
    readAt: "2026-07-16T10:00:00.000Z",
    chapterLabel: "Cap. 1100",
  },
  readCount: 3,
  sourceDomains: ["olympusxyz.com"],
};

beforeEach(() => {
  fetchMock.mockReset();
  // A Response body is single-use: build a fresh one per fetch call.
  fetchMock.mockImplementation(() => Promise.resolve(jsonResponse([entry])));
});

describe("LibraryView", () => {
  it("renders the library entries", async () => {
    await renderWithProviders(<LibraryView />);

    expect(await screen.findByText("One Piece")).toBeDefined();
    expect(screen.getByText("Cap. 1100")).toBeDefined();
    expect(
      screen.getByText("olympusxyz.com", { selector: "span.chip" }),
    ).toBeDefined();
    expect(screen.getByRole("link", { name: "One Piece" })).toBeDefined();
  });

  it("refetches with the selected domain filter", async () => {
    await renderWithProviders(<LibraryView />);
    await screen.findByRole("option", { name: "olympusxyz.com" });

    await actAsync(() => {
      fireEvent.change(screen.getByLabelText("Sitio"), {
        target: { value: "olympusxyz.com" },
      });
    });

    await screen.findByText("One Piece");
    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls).toContain("/api/library?domain=olympusxyz.com");
  });

  it("shows the empty state when there are no readings", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse([])));

    await renderWithProviders(<LibraryView />);

    expect(await screen.findByText(/Sin lecturas todavía/)).toBeDefined();
  });
});
