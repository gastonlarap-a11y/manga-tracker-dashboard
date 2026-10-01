import { act, screen, waitFor } from "@testing-library/react";
import { useAtomValue } from "jotai";
import { Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LibraryEntryDto } from "../api/types";
import { continueReadingAtom } from "../state/atoms";
import {
  fakeLibraryApi,
  jsonResponse,
  libraryEntry,
  renderWithProviders,
} from "../test-utils";
import { LibraryGrid } from "../views/library/LibraryGrid";
import { LiveRefresh } from "./LiveRefresh";

// Reads one of the library's refreshable atoms, so the test can observe
// refreshes end to end.
function LibraryProbe() {
  const result = useAtomValue(continueReadingAtom);
  return (
    <p>
      {result.ok ? (result.data.items[0]?.canonicalName ?? "vacío") : "error"}
    </p>
  );
}

function page(items: LibraryEntryDto[]): Response {
  return jsonResponse({ items, nextCursor: null });
}

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

type Handler = () => void;

// Minimal EventSource stub: records instances and lets the test push events.
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  closed = false;
  private handlers = new Map<string, Handler[]>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, handler: Handler): void {
    const existing = this.handlers.get(type) ?? [];
    this.handlers.set(type, [...existing, handler]);
  }

  emit(type: string): void {
    for (const handler of this.handlers.get(type) ?? []) {
      handler();
    }
  }

  close(): void {
    this.closed = true;
  }
}

vi.stubGlobal("EventSource", FakeEventSource);

beforeEach(() => {
  fetchMock.mockReset();
  FakeEventSource.instances = [];
  vi.useRealTimers();
});

describe("LiveRefresh", () => {
  it("subscribes to the stream and refreshes the library on changes", async () => {
    let libraryCalls = 0;
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (String(input).startsWith("/api/library/page")) {
        libraryCalls += 1;
        return Promise.resolve(
          page([libraryEntry({ canonicalName: `Snapshot ${libraryCalls}` })]),
        );
      }
      return Promise.resolve(jsonResponse([]));
    });

    await renderWithProviders(
      <>
        <LiveRefresh />
        <LibraryProbe />
      </>,
    );
    await screen.findByText(/Snapshot/);

    const source = FakeEventSource.instances[0];
    expect(source?.url).toBe("/api/events/stream");
    const callsBefore = fetchMock.mock.calls.length;

    await act(async () => {
      source?.emit("library-changed");
      // Wait past the 300ms debounce.
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it("keeps the page on screen while a refresh loads, not the fallback", async () => {
    // The regression: each chapter read elsewhere suspended the library back
    // to its skeleton, unmounting the grid and reloading every cover.
    let release: () => void = () => {};
    let libraryCalls = 0;
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (!String(input).startsWith("/api/library/page")) {
        return Promise.resolve(jsonResponse([]));
      }
      libraryCalls += 1;
      if (libraryCalls === 1) {
        return Promise.resolve(
          page([libraryEntry({ canonicalName: "Antes" })]),
        );
      }
      return new Promise<Response>((resolve) => {
        release = () =>
          resolve(page([libraryEntry({ canonicalName: "Después" })]));
      });
    });

    await renderWithProviders(
      <>
        <LiveRefresh />
        <Suspense fallback={<p>cargando</p>}>
          <LibraryProbe />
        </Suspense>
      </>,
    );
    await screen.findByText("Antes");

    await act(async () => {
      FakeEventSource.instances[0]?.emit("library-changed");
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    expect(screen.queryByText("cargando")).toBeNull();
    expect(screen.getByText("Antes")).toBeDefined();

    await act(async () => {
      release();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(await screen.findByText("Después")).toBeDefined();
  });

  it("refreshes immediately when the stream (re)opens", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(page([])));

    // The probe mounts a library atom: refreshing an unmounted one is a no-op.
    await renderWithProviders(
      <>
        <LiveRefresh />
        <LibraryProbe />
      </>,
    );
    const source = FakeEventSource.instances[0];
    const callsBefore = fetchMock.mock.calls.length;

    await act(async () => {
      source?.emit("open");
      await Promise.resolve();
    });

    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it("refreshes when the tab becomes visible again", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(page([])));

    await renderWithProviders(
      <>
        <LiveRefresh />
        <LibraryProbe />
      </>,
    );
    const callsBefore = fetchMock.mock.calls.length;

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });

    // happy-dom tabs are always "visible", so the handler must refetch.
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it("re-reads every card the grid holds, not just its first page", async () => {
    // Someone scrolled deep into the grid when a chapter arrived: starting
    // over at one page would shrink the grid under them.
    const many = Array.from({ length: 130 }, (_, index) =>
      libraryEntry({
        id: `m${String(index).padStart(3, "0")}`,
        canonicalName: `Serie ${index}`,
      }),
    );
    const api = fakeLibraryApi(many);
    fetchMock.mockImplementation(
      (input: RequestInfo | URL) =>
        api(input) ?? Promise.resolve(jsonResponse([])),
    );
    await renderWithProviders(
      <>
        <LiveRefresh />
        <LibraryGrid />
      </>,
    );
    await waitFor(() =>
      expect(screen.getAllByRole("listitem")).toHaveLength(130),
    );
    fetchMock.mockClear();

    await act(async () => {
      FakeEventSource.instances[0]?.emit("library-changed");
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    const pageRequests = fetchMock.mock.calls
      .map((call) => new URL(String(call[0]), "http://dashboard.test"))
      .filter((url) => url.pathname === "/api/library/page");
    expect(
      pageRequests.map((url) => [
        url.searchParams.get("limit"),
        url.searchParams.get("cursor"),
      ]),
    ).toEqual([["130", null]]);
    expect(screen.getAllByRole("listitem")).toHaveLength(130);
  });

  it("closes the connection on unmount", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse([])));

    const view = await renderWithProviders(<LiveRefresh />);
    view.unmount();

    expect(FakeEventSource.instances[0]?.closed).toBe(true);
  });
});
