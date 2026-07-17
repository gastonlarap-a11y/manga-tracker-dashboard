import { useSetAtom } from "jotai";
import { useEffect } from "react";
import { baseLibraryAtom, duplicatesAtom, libraryAtom } from "../state/atoms";

const DEBOUNCE_MS = 300;

// One idle SSE connection to the backend; whenever the library changes
// (new reading, rename, status/tags edit, delete) every data atom refreshes,
// so an open dashboard always shows the real state without reloading.
// EventSource reconnects on its own after network hiccups.
export function LiveRefresh() {
  const refreshLibrary = useSetAtom(libraryAtom);
  const refreshBase = useSetAtom(baseLibraryAtom);
  const refreshDuplicates = useSetAtom(duplicatesAtom);

  useEffect(() => {
    const source = new EventSource("/api/events/stream");
    let timer: number | undefined;

    function onLibraryChanged(): void {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        refreshLibrary();
        refreshBase();
        refreshDuplicates();
      }, DEBOUNCE_MS);
    }

    source.addEventListener("library-changed", onLibraryChanged);
    return () => {
      window.clearTimeout(timer);
      source.close();
    };
  }, [refreshLibrary, refreshBase, refreshDuplicates]);

  return null;
}
