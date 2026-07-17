import { useSetAtom } from "jotai";
import { useEffect } from "react";
import {
  baseLibraryAtom,
  duplicatesAtom,
  libraryAtom,
  liveStatusAtom,
} from "../state/atoms";

const DEBOUNCE_MS = 300;

// One idle SSE connection to the backend; whenever the library changes
// (new reading, cover, edit, delete) every data atom refreshes, so an open
// dashboard always shows the real state without reloading.
//
// Two belt-and-braces refreshes cover every way events can be missed:
// - on `open` (first connect AND every automatic reconnection: events that
//   fired while the connection was down were never delivered), and
// - on the tab becoming visible again (Chrome/Brave throttle or freeze
//   background tabs, which can pause timers and drop the connection).
export function LiveRefresh() {
  const refreshLibrary = useSetAtom(libraryAtom);
  const refreshBase = useSetAtom(baseLibraryAtom);
  const refreshDuplicates = useSetAtom(duplicatesAtom);
  const setLiveStatus = useSetAtom(liveStatusAtom);

  useEffect(() => {
    const source = new EventSource("/api/events/stream");
    let timer: number | undefined;

    function refreshAll(): void {
      refreshLibrary();
      refreshBase();
      refreshDuplicates();
    }

    function onLibraryChanged(): void {
      window.clearTimeout(timer);
      timer = window.setTimeout(refreshAll, DEBOUNCE_MS);
    }

    function onOpen(): void {
      setLiveStatus("live");
      refreshAll();
    }

    function onError(): void {
      // EventSource retries on its own; the badge just reports the truth.
      setLiveStatus("offline");
    }

    function onVisibilityChange(): void {
      if (document.visibilityState === "visible") {
        refreshAll();
      }
    }

    source.addEventListener("library-changed", onLibraryChanged);
    source.addEventListener("open", onOpen);
    source.addEventListener("error", onError);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      source.close();
    };
  }, [refreshLibrary, refreshBase, refreshDuplicates, setLiveStatus]);

  return null;
}
