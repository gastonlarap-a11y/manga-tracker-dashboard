import { Suspense } from "react";
import { TileSkeleton } from "../components/Skeleton";
import { ActivityPanel } from "./library/ActivityPanel";
import { ContinueReading } from "./library/ContinueReading";
import { LibraryGrid } from "./library/LibraryGrid";
import { LibraryToolbar } from "./library/LibraryToolbar";
import { StatsTiles } from "./library/StatsTiles";

/**
 * The library: what you were reading and how much, on top (a bento that fills
 * the width the window has), then the whole collection as a grid of covers.
 *
 * A boundary per tile, and none around the grid: one boundary for all of it
 * made the grid's first page wait for the activity panel, which at a large
 * library is the slowest question the page asks. The grid does not suspend —
 * it shows its own placeholder until its first page is in.
 */
export function LibraryView() {
  return (
    <section className="library">
      {/* The other views open with a heading; the library had none, so a
          screen reader landing here had nothing to navigate by. */}
      <h1 className="visually-hidden">Biblioteca</h1>
      <div className="bento">
        <Suspense fallback={<TileSkeleton area="continue" />}>
          <ContinueReading />
        </Suspense>
        <Suspense fallback={<TileSkeleton area="activity" />}>
          <ActivityPanel />
        </Suspense>
        <Suspense fallback={<TileSkeleton area="stats" />}>
          <StatsTiles />
        </Suspense>
      </div>
      <LibraryToolbar />
      <LibraryGrid />
    </section>
  );
}
