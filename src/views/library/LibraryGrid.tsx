import { useAtomValue } from "jotai";
import { BookOpen, Play, SearchX } from "lucide-react";
import { Link } from "react-router";
import type { LibraryEntryDto, MangaStatus } from "../../api/types";
import { CoverImage } from "../../components/CoverImage";
import { markCoverForTransition } from "../../components/coverTransition";
import { relativeDate } from "../../lib/dates";
import {
  type LibrarySort,
  libraryAtom,
  searchAtom,
  sortAtom,
  statusTabAtom,
  tagFilterAtom,
} from "../../state/atoms";

const STATUS_LABELS: Record<MangaStatus, string> = {
  reading: "Leyendo",
  completed: "Terminado",
  dropped: "Abandonado",
};

// Accent-insensitive matching: "invocacion" finds "Invocación".
function normalizeText(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const collator = new Intl.Collator("es", { sensitivity: "base" });

function sorted(
  entries: LibraryEntryDto[],
  sort: LibrarySort,
): LibraryEntryDto[] {
  switch (sort) {
    case "recent":
      return entries;
    case "title":
      return entries.toSorted((a, b) =>
        collator.compare(a.canonicalName, b.canonicalName),
      );
    case "chapters":
      return entries.toSorted((a, b) => b.readCount - a.readCount);
  }
}

export function LibraryGrid() {
  const result = useAtomValue(libraryAtom);
  const statusTab = useAtomValue(statusTabAtom);
  const search = useAtomValue(searchAtom);
  const tagFilter = useAtomValue(tagFilterAtom);
  const sort = useAtomValue(sortAtom);

  if (!result.ok) {
    return (
      <p className="status error" role="alert">
        No se pudo cargar la biblioteca: {result.error}
      </p>
    );
  }
  if (result.data.length === 0) {
    return (
      <div className="empty">
        <BookOpen aria-hidden="true" />
        <p>
          Sin lecturas todavía. Abrí un capítulo en un sitio trackeado y va a
          aparecer acá.
        </p>
      </div>
    );
  }

  const needle = normalizeText(search.trim());
  const entries = result.data.filter((entry) => {
    if (statusTab !== "all" && entry.status !== statusTab) {
      return false;
    }
    if (needle && !normalizeText(entry.canonicalName).includes(needle)) {
      return false;
    }
    if (
      tagFilter.length > 0 &&
      !tagFilter.every((tag) => entry.tags.includes(tag))
    ) {
      return false;
    }
    return true;
  });

  if (entries.length === 0) {
    return (
      <div className="empty">
        <SearchX aria-hidden="true" />
        <p>Nada coincide con los filtros en esta pestaña.</p>
      </div>
    );
  }

  return (
    <ul className="grid" aria-label="Mangas">
      {sorted(entries, sort).map((entry) => (
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
