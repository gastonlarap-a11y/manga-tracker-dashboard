import { Suspense } from "react";
import { LibrarySkeleton } from "../components/Skeleton";
import { ActivityPanel } from "./library/ActivityPanel";
import { ContinueReading } from "./library/ContinueReading";
import { LibraryGrid } from "./library/LibraryGrid";
import { LibraryToolbar } from "./library/LibraryToolbar";
import { StatsTiles } from "./library/StatsTiles";

/**
 * The library: what you were reading and how much, on top (a bento that fills
 * the width the window has), then the whole collection as a grid of covers.
 */
export function LibraryView() {
  return (
    <section className="library">
      {/* The other views open with a heading; the library had none, so a
          screen reader landing here had nothing to navigate by. */}
      <h1 className="visually-hidden">Biblioteca</h1>
      <Suspense fallback={<LibrarySkeleton />}>
        <div className="bento">
          <ContinueReading />
          <ActivityPanel />
          <StatsTiles />
        </div>
        <LibraryToolbar />
        <LibraryGrid />
      </Suspense>
    </section>
  );
}
