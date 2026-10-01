import { useAtomValue, useSetAtom } from "jotai";
import { unwrap } from "jotai/utils";
import { BookOpen, Play, SearchX } from "lucide-react";
import { useEffect, useLayoutEffect, useState } from "react";
import { Link } from "react-router";
import type { LibraryEntryDto, MangaStatus } from "../../api/types";
import { CoverImage } from "../../components/CoverImage";
import { markCoverForTransition } from "../../components/coverTransition";
import { GridSkeleton } from "../../components/Skeleton";
import { relativeDate } from "../../lib/dates";
import { type RowWindow, visibleRows } from "../../lib/virtualRows";
import {
  libraryRevisionAtom,
  librarySummaryAtom,
  statusTabAtom,
} from "../../state/atoms";
import {
  gridQueryKeyAtom,
  libraryPagesAtom,
  loadMoreLibraryAtom,
  syncLibraryPagesAtom,
} from "../../state/libraryPages";

// Without suspending: an empty grid only needs it to tell "nothing read yet"
// from "nothing matches", and the bento above suspends on it already.
const summaryAtom = unwrap(librarySummaryAtom, (previous) => previous ?? null);

const STATUS_LABELS: Record<MangaStatus, string> = {
  reading: "Leyendo",
  completed: "Terminado",
  dropped: "Abandonado",
};

/** Rows kept in the page beyond each edge of the window. */
const OVERSCAN_ROWS = 3;
/** How close to the last loaded row the next page is asked for. */
const PREFETCH_ROWS = 4;

/** What the grid's own CSS resolved to — the source of truth for its shape. */
interface GridShape {
  readonly columns: number;
  /** One card's height plus the row gap; 0 while there is no card to measure. */
  readonly rowStride: number;
}

interface Viewport {
  readonly listTop: number;
  readonly scrollTop: number;
  readonly height: number;
}

function measureShape(list: HTMLElement): GridShape {
  const style = getComputedStyle(list);
  // A computed grid-template-columns lists one length per track, so its count
  // is the column count auto-fill arrived at for this width.
  const tracks = style.gridTemplateColumns
    .split(" ")
    .filter((track) => track.endsWith("px")).length;
  const card = list.querySelector<HTMLElement>(":scope > .card");
  const height = card?.getBoundingClientRect().height ?? 0;
  const gap = Number.parseFloat(style.rowGap) || 0;
  return {
    columns: Math.max(1, tracks),
    rowStride: height > 0 ? height + gap : 0,
  };
}

function readViewport(list: HTMLElement): Viewport {
  return {
    listTop: list.getBoundingClientRect().top + window.scrollY,
    scrollTop: window.scrollY,
    height: window.innerHeight,
  };
}

function sameShape(a: GridShape, b: GridShape): boolean {
  return a.columns === b.columns && a.rowStride === b.rowStride;
}

function sameViewport(a: Viewport, b: Viewport): boolean {
  return (
    a.listTop === b.listTop &&
    a.scrollTop === b.scrollTop &&
    a.height === b.height
  );
}

/**
 * The library as a grid of covers, a page at a time and only the rows near the
 * window in the page: a library of ten thousand cards costs what thirty do.
 */
export function LibraryGrid() {
  const pages = useAtomValue(libraryPagesAtom);
  const queryKey = useAtomValue(gridQueryKeyAtom);
  const revision = useAtomValue(libraryRevisionAtom);
  const statusTab = useAtomValue(statusTabAtom);
  const summary = useAtomValue(summaryAtom);
  const syncPages = useSetAtom(syncLibraryPagesAtom);
  const loadMore = useSetAtom(loadMoreLibraryAtom);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the key and the revision are what the pages must follow; syncPages reads both from the store.
  useEffect(() => {
    void syncPages();
  }, [syncPages, queryKey, revision]);

  // In state rather than a ref: the list is not in the page while the first
  // page loads, and the effects below have to start once it is.
  const [list, setList] = useState<HTMLUListElement | null>(null);
  const [shape, setShape] = useState<GridShape>({ columns: 1, rowStride: 0 });
  // Where the list starts is unknown until it is in the page; taken as the
  // top of the document, the first window errs towards too many rows.
  const [viewport, setViewport] = useState<Viewport>(() => ({
    listTop: 0,
    scrollTop: window.scrollY,
    height: window.innerHeight,
  }));

  const items = pages?.items ?? [];
  const rowCount = Math.ceil(items.length / shape.columns);
  const rows: RowWindow = visibleRows({
    rowCount,
    rowStride: shape.rowStride,
    listTop: viewport.listTop,
    scrollTop: viewport.scrollTop,
    viewportHeight: viewport.height,
    overscan: OVERSCAN_ROWS,
  });

  // The shape and the window are read after every render that could change
  // them — a card appearing for the first time, the page coming back from
  // hidden — and before paint, so a wrong guess is never on screen. Setting
  // the same values again does not render again.
  useLayoutEffect(() => {
    if (list === null) {
      return;
    }
    const next = measureShape(list);
    setShape((current) => (sameShape(current, next) ? current : next));
    const view = readViewport(list);
    setViewport((current) => (sameViewport(current, view) ? current : view));
  });

  useEffect(() => {
    if (list === null) {
      return;
    }
    let frame = 0;
    // One read per frame, however many scroll events the frame had.
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const view = readViewport(list);
        setViewport((current) =>
          sameViewport(current, view) ? current : view,
        );
        const next = measureShape(list);
        setShape((current) => (sameShape(current, next) ? current : next));
      });
    };
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    // The bento above can grow after the grid has rendered — the hero's cover
    // arriving — and that moves where the first row starts.
    const observer = new ResizeObserver(update);
    observer.observe(list);
    if (list.parentElement !== null) {
      observer.observe(list.parentElement);
    }
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, [list]);

  const nextCursor = pages?.nextCursor ?? null;
  const nearTheEnd =
    rows.last >= rowCount - 1 - PREFETCH_ROWS && nextCursor !== null;
  // On the cursor too: a page that arrives and still leaves the end in view
  // keeps nearTheEnd true, and the next one must still be asked for.
  // biome-ignore lint/correctness/useExhaustiveDependencies: nextCursor is a trigger; loadMore reads the cursor from the store.
  useEffect(() => {
    if (nearTheEnd) {
      void loadMore();
    }
  }, [nearTheEnd, nextCursor, loadMore]);

  if (pages === null || (pages.loading && items.length === 0)) {
    return <GridSkeleton />;
  }
  if (pages.error !== null && items.length === 0) {
    return (
      <p className="status error" role="alert">
        No se pudo cargar la biblioteca: {pages.error}
      </p>
    );
  }
  if (items.length === 0) {
    return summary?.ok && summary.data.counts.all === 0 ? (
      <div className="empty">
        <BookOpen aria-hidden="true" />
        <p>
          Sin lecturas todavía. Abrí un capítulo en un sitio trackeado y va a
          aparecer acá.
        </p>
      </div>
    ) : (
      <div className="empty">
        <SearchX aria-hidden="true" />
        <p>Nada coincide con los filtros en esta pestaña.</p>
      </div>
    );
  }

  const shown = items.slice(
    rows.first * shape.columns,
    (rows.last + 1) * shape.columns,
  );
  return (
    <ul
      ref={setList}
      className="grid"
      aria-label="Mangas"
      aria-busy={pages.loading}
      style={{
        paddingTop: rows.first * shape.rowStride,
        paddingBottom: (rowCount - 1 - rows.last) * shape.rowStride,
      }}
    >
      {shown.map((entry) => (
        <MangaCard
          key={entry.id}
          entry={entry}
          showStatus={statusTab === "all"}
        />
      ))}
    </ul>
  );
}

function MangaCard({
  entry,
  showStatus,
}: {
  entry: LibraryEntryDto;
  showStatus: boolean;
}) {
  return (
    <li className="card" data-cover-root>
      <div className="card-media">
        {/* The same destination as the title below, which carries the name.
            Out of the tab order and the accessibility tree, so each card is
            one link to a screen reader instead of an unnamed one followed by
            a named one. */}
        <Link
          to={`/manga/${entry.id}`}
          className="card-cover"
          aria-hidden="true"
          tabIndex={-1}
          viewTransition
          onClick={markCoverForTransition}
        >
          <CoverImage
            mangaId={entry.id}
            name={entry.canonicalName}
            coverUrl={entry.coverUrl}
            coverVersion={entry.coverVersion}
          />
        </Link>
        {entry.reachedChapter && (
          <span className="pill on-cover card-chapter">
            {entry.reachedChapter.label}
          </span>
        )}
        {showStatus && entry.status !== "reading" && (
          <span className={`pill on-cover card-status ${entry.status}`}>
            {STATUS_LABELS[entry.status]}
          </span>
        )}
        {entry.lastSourceUrl && (
          <a
            className="card-play"
            href={entry.lastSourceUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Seguir leyendo ${entry.canonicalName}`}
            title="Seguir leyendo"
          >
            <Play aria-hidden="true" />
          </a>
        )}
      </div>
      <div className="card-body">
        <Link
          to={`/manga/${entry.id}`}
          className="card-title"
          viewTransition
          onClick={markCoverForTransition}
        >
          {entry.canonicalName}
        </Link>
        <span className="card-meta">
          {entry.lastActivity
            ? relativeDate(entry.lastActivity.readAt)
            : "sin lecturas"}
          {/* One card, several sites: the series was read on more than one. */}
          {entry.sourceDomains.length > 1 && (
            <span title={entry.sourceDomains.join(", ")}>
              {" · "}
              {entry.sourceDomains.length} sitios
            </span>
          )}
        </span>
      </div>
    </li>
  );
}
