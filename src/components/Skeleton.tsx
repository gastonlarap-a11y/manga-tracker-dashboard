import type { LibraryEntryDto } from "../api/types";
import { CoverImage } from "./CoverImage";

/**
 * Placeholders shaped like what is about to appear, so the page does not jump
 * when it arrives. Announced once as a status; the shapes themselves are
 * decoration.
 */

const GRID_PLACEHOLDERS = Array.from({ length: 12 }, (_, index) => index);

export function LibrarySkeleton() {
  return (
    <div className="library-skeleton" role="status">
      <span className="visually-hidden">Cargando biblioteca…</span>
      <div className="bento" aria-hidden="true">
        <div className="tile skeleton bento-continue" />
        <div className="tile skeleton bento-activity" />
        <div className="tile skeleton bento-stats" />
      </div>
      <ul className="grid" aria-hidden="true">
        {GRID_PLACEHOLDERS.map((index) => (
          <li key={index} className="card">
            <div className="card-media skeleton" />
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line short" />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The detail page while its history loads. When the library already knows
 * this manga — always, coming from a card — its real cover and name are shown
 * at once: the cover the click morphed lands on the cover itself, not on a
 * grey box that is then swapped for it.
 */
export function DetailSkeleton({ entry }: { entry?: LibraryEntryDto }) {
  return (
    <div className="detail-layout detail-loading" role="status">
      <span className="visually-hidden">Cargando historial…</span>
      <div className="detail-side" aria-hidden="true">
        {entry ? (
          <CoverImage
            mangaId={entry.id}
            name={entry.canonicalName}
            coverUrl={entry.coverUrl}
            coverVersion={entry.coverVersion}
            className="detail-cover"
            priority
          />
        ) : (
          <div className="detail-cover skeleton" />
        )}
      </div>
      <div className="detail-main" aria-hidden="true">
        {entry ? (
          <p className="detail-loading-title">{entry.canonicalName}</p>
        ) : (
          <div className="skeleton skeleton-title" />
        )}
        <div className="skeleton skeleton-line short" />
        <div className="tile skeleton skeleton-block" />
      </div>
    </div>
  );
}
