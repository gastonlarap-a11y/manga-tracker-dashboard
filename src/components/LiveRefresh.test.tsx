import { act, screen } from "@testing-library/react";
import { useAtomValue } from "jotai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { libraryAtom } from "../state/atoms";
import { jsonResponse, libraryEntry, renderWithProviders } from "../test-utils";
import { LiveRefresh } from "./LiveRefresh";

// Reads the library atom so the test can observe refreshes end-to-end.
function LibraryProbe() {
  const result = useAtomValue(libraryAtom);
  return (
    <p>{result.ok ? (result.data[0]?.canonicalName ?? "vacío") : "error"}</p>
  );
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
      if (String(input).startsWith("/api/library")) {
        libraryCalls += 1;
        return Promise.resolve(
          jsonResponse([
            libraryEntry({ canonicalName: `Snapshot ${libraryCalls}` }),
          ]),
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

  it("refreshes immediately when the stream (re)opens", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse([])));

    // The probe mounts libraryAtom: refreshing an unmounted atom is a no-op.
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
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse([])));

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

  it("closes the connection on unmount", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse([])));

    const view = await renderWithProviders(<LiveRefresh />);
    view.unmount();

    expect(FakeEventSource.instances[0]?.closed).toBe(true);
  });
});
