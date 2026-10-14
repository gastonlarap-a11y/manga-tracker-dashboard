import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LibraryEntryDto, MangaStatus } from "../api/types";
import {
  actAsync,
  fakeLibraryApi,
  jsonResponse,
  libraryEntry,
  mangaDto,
  renderWithProviders,
  requestBody,
} from "../test-utils";
import { FollowUpView } from "./FollowUpView";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const DAY_MS = 86_400_000;

/** A series last read `days` ago, in `status`. */
function series(
  id: string,
  name: string,
  days: number | null,
  status: MangaStatus = "reading",
): LibraryEntryDto {
  return libraryEntry({
    id,
    canonicalName: name,
    normalizedSlug: id,
    status,
    lastActivity:
      days === null
        ? null
        : {
            readAt: new Date(Date.now() - days * DAY_MS).toISOString(),
            chapterLabel: `Cap. ${id}`,
          },
    lastSourceUrl: days === null ? null : `https://lector.example/${id}/1`,
  });
}

/**
 * Answers the library endpoints over `library`, and applies a status change
 * to it the way the API would — so a changed series leaves the list on the
 * next read. `failPut` answers every change with an error instead.
 */
function serve(library: LibraryEntryDto[], failPut = false) {
  const api = fakeLibraryApi(library);
  fetchMock.mockImplementation(
    (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://dashboard.test");
      const put = url.pathname.match(/^\/api\/mangas\/([^/]+)$/);
      if (put !== null && init?.method === "PUT") {
        if (failPut) {
          return Promise.resolve(jsonResponse({ error: "No se guardó" }, 500));
        }
        const id = decodeURIComponent(put[1] ?? "");
        // Cast justified: the view sends UpdateMangaBody, read back here.
        const { status } = JSON.parse(String(init.body)) as {
          status: MangaStatus;
        };
        const index = library.findIndex((entry) => entry.id === id);
        const current = library[index];
        if (current !== undefined) {
          library[index] = { ...current, status };
        }
        return Promise.resolve(jsonResponse(mangaDto({ id, status })));
      }
      return (
        api(input) ??
        Promise.resolve(jsonResponse({ error: "unexpected" }, 500))
      );
    },
  );
}

function requested(): URL[] {
  return fetchMock.mock.calls.map(
    (call) => new URL(String(call[0]), "http://dashboard.test"),
  );
}

/** The names in a list, in the order shown. */
function names(list: HTMLElement): string[] {
  return within(list)
    .getAllByRole("listitem")
    .map(
      (row) =>
        within(row)
          .getAllByRole("link")
          .find((link) => link.getAttribute("aria-hidden") !== "true")
          ?.textContent ?? "",
    );
}

const staleList = () => screen.findByRole("list", { name: "Series sin leer" });
const pausedList = () => screen.findByRole("list", { name: "Series en pausa" });

let library: LibraryEntryDto[];

beforeEach(() => {
  fetchMock.mockReset();
  library = [
    series("hace-un-ano", "Hace un año", 365),
    series("dos-anos", "Hace dos años", 730),
    series("hace-un-mes", "Hace un mes", 40),
    series("ayer", "Ayer", 1),
    series("nunca", "Nunca leída", null),
    series("terminada", "Terminada vieja", 1000, "completed"),
    series("pausada", "Pausada", 300, "on_hold"),
  ];
  serve(library);
});

describe("FollowUpView", () => {
  it("lists the series in Leyendo not read for 3 months, the most forgotten first", async () => {
    await renderWithProviders(<FollowUpView />);

    expect(names(await staleList())).toEqual(["Hace dos años", "Hace un año"]);
    const page = requested().find(
      (url) => url.pathname === "/api/library/page",
    );
    expect(page?.searchParams.get("sort")).toBe("oldest");
    expect(page?.searchParams.get("status")).toBe("reading");
    const before = Date.parse(page?.searchParams.get("before") ?? "");
    expect(Math.round((Date.now() - before) / DAY_MS)).toBe(90);
  });

  it("says when each series was read last, and where", async () => {
    await renderWithProviders(<FollowUpView />);

    const row = within(
      within(await staleList()).getAllByRole("listitem")[0] as HTMLElement,
    );
    expect(row.getByText("Cap. dos-anos")).toBeDefined();
    expect(row.getByText("hace 2 años")).toBeDefined();
    expect(row.getByText("lector.example")).toBeDefined();
  });

  it("counts both halves on the tabs", async () => {
    await renderWithProviders(<FollowUpView />);
    await staleList();

    expect(
      await screen.findByRole("button", { name: "Sin leer 2" }),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "En pausa 1" })).toBeDefined();
  });

  it("widens or narrows the window with the threshold", async () => {
    await renderWithProviders(<FollowUpView />);
    await staleList();

    await actAsync(() => {
      fireEvent.change(screen.getByLabelText(/Sin leer hace más de/), {
        target: { value: "30" },
      });
    });

    await waitFor(async () =>
      expect(names(await staleList())).toEqual([
        "Hace dos años",
        "Hace un año",
        "Hace un mes",
      ]),
    );
    expect(
      await screen.findByRole("button", { name: "Sin leer 3" }),
    ).toBeDefined();
  });

  it("pauses a series in one click and takes it off the list", async () => {
    await renderWithProviders(<FollowUpView />);
    await staleList();

    await actAsync(() => {
      fireEvent.click(
        screen.getByRole("button", { name: "Pausar: Hace dos años" }),
      );
    });

    await waitFor(async () =>
      expect(names(await staleList())).toEqual(["Hace un año"]),
    );
    const put = fetchMock.mock.calls.find(
      (call) => (call[1] as RequestInit | undefined)?.method === "PUT",
    );
    expect(String(put?.[0])).toBe("/api/mangas/dos-anos");
    expect(requestBody(put)).toEqual({ status: "on_hold" });
    expect(
      await screen.findByRole("button", { name: "En pausa 2" }),
    ).toBeDefined();
  });

  it("marks it finished or dropped", async () => {
    await renderWithProviders(<FollowUpView />);
    await staleList();

    await actAsync(() => {
      fireEvent.click(
        screen.getByRole("button", { name: "Marcar terminada: Hace un año" }),
      );
    });
    await waitFor(async () =>
      expect(names(await staleList())).toEqual(["Hace dos años"]),
    );
    await actAsync(() => {
      fireEvent.click(
        screen.getByRole("button", { name: "Abandonar: Hace dos años" }),
      );
    });

    expect(await screen.findByText("Al día")).toBeDefined();
    const bodies = fetchMock.mock.calls
      .filter((call) => (call[1] as RequestInit | undefined)?.method === "PUT")
      .map((call) => requestBody(call));
    expect(bodies).toEqual([{ status: "completed" }, { status: "dropped" }]);
  });

  it("offers to keep reading from the last chapter", async () => {
    await renderWithProviders(<FollowUpView />);
    await staleList();

    const link = screen.getByRole("link", { name: "Continuar Hace un año" });
    expect(link.getAttribute("href")).toBe(
      "https://lector.example/hace-un-ano/1",
    );
  });

  it("lists paused series most recently read first, one click from Leyendo", async () => {
    library.push(series("retomada", "Retomada hace poco", 2, "on_hold"));
    await renderWithProviders(<FollowUpView />);
    await staleList();

    await actAsync(() => {
      fireEvent.click(screen.getByRole("button", { name: /^En pausa/ }));
    });

    const list = await pausedList();
    expect(names(list)).toEqual(["Retomada hace poco", "Pausada"]);
    // Read while paused: it stands out, since reading never unpauses it.
    expect(within(list).getAllByText("Leída esta semana")).toHaveLength(1);
    const page = requested().findLast(
      (url) => url.pathname === "/api/library/page",
    );
    expect(page?.searchParams.get("status")).toBe("on_hold");
    expect(page?.searchParams.get("sort")).toBe("recent");
    expect(page?.searchParams.has("before")).toBe(false);

    await actAsync(() => {
      fireEvent.click(
        screen.getByRole("button", { name: "Retomar: Retomada hace poco" }),
      );
    });
    await waitFor(async () =>
      expect(names(await pausedList())).toEqual(["Pausada"]),
    );
  });

  it("says so when nothing has gone quiet", async () => {
    serve([series("ayer", "Ayer", 1)]);
    await renderWithProviders(<FollowUpView />);

    expect(await screen.findByText("Al día")).toBeDefined();
    expect(
      screen.getByText(
        "Ninguna serie en Leyendo lleva más de 3 meses sin leerse.",
      ),
    ).toBeDefined();
  });

  it("says so when nothing is paused", async () => {
    serve([series("ayer", "Ayer", 1)]);
    await renderWithProviders(<FollowUpView />);
    await screen.findByText("Al día");

    await actAsync(() => {
      fireEvent.click(screen.getByRole("button", { name: /^En pausa/ }));
    });

    expect(await screen.findByText("No hay series en pausa")).toBeDefined();
  });

  it("keeps the row and says why when a change fails", async () => {
    serve(library, true);
    await renderWithProviders(<FollowUpView />);
    await staleList();

    await actAsync(() => {
      fireEvent.click(
        screen.getByRole("button", { name: "Pausar: Hace un año" }),
      );
    });

    expect((await screen.findByRole("alert")).textContent).toBe("No se guardó");
    expect(names(await staleList())).toEqual(["Hace dos años", "Hace un año"]);
  });

  it("loads the next page on request", async () => {
    serve(
      Array.from({ length: 70 }, (_, index) =>
        series(
          `s${String(index).padStart(2, "0")}`,
          `Serie ${index}`,
          100 + index,
        ),
      ),
    );
    await renderWithProviders(<FollowUpView />);
    expect(names(await staleList())).toHaveLength(60);
    expect(screen.getByText("60 de 70")).toBeDefined();

    await actAsync(() => {
      fireEvent.click(screen.getByRole("button", { name: "Cargar más" }));
    });

    await waitFor(async () =>
      expect(names(await staleList())).toHaveLength(70),
    );
    expect(screen.queryByRole("button", { name: "Cargar más" })).toBeNull();
  });

  it("never asks for the whole library", async () => {
    await renderWithProviders(<FollowUpView />);
    await staleList();

    expect(requested().map((url) => url.pathname)).not.toContain(
      "/api/library",
    );
  });
});
