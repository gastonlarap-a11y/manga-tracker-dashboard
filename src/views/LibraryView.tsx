import { useAtom, useAtomValue } from "jotai";
import { unwrap } from "jotai/utils";
import { Suspense } from "react";
import { Link } from "react-router";
import type { LibraryEntryDto, MangaStatus } from "../api/types";
import { CoverImage } from "../components/CoverImage";
import { relativeDate } from "../lib/dates";
import {
  baseLibraryAtom,
  domainFilterAtom,
  knownDomainsAtom,
  knownTagsAtom,
  libraryAtom,
  type StatusTab,
  searchAtom,
  sinceDaysAtom,
  statusTabAtom,
  tagFilterAtom,
} from "../state/atoms";

const SINCE_OPTIONS = [
  { label: "Todo", days: null },
  { label: "Última semana", days: 7 },
  { label: "Último mes", days: 30 },
  { label: "Últimos 3 meses", days: 90 },
];

const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: "reading", label: "Leyendo" },
  { value: "completed", label: "Terminados" },
  { value: "dropped", label: "Abandonados" },
  { value: "all", label: "Todos" },
];

export const STATUS_LABELS: Record<MangaStatus, string> = {
  reading: "Leyendo",
  completed: "Terminado",
  dropped: "Abandonado",
};

// unwrap() keeps the toolbar from suspending: empty options while loading.
const domainOptionsAtom = unwrap(
  knownDomainsAtom,
  (previous) => previous ?? [],
);
const tagOptionsAtom = unwrap(knownTagsAtom, (previous) => previous ?? []);

const DAY_MS = 86_400_000;

// Accent-insensitive matching: "invocacion" finds "Invocación".
function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function LibraryView() {
  return (
    <section>
      {/* The other views open with a heading; the library had none, so a
          screen reader landing here had nothing to navigate by. */}
      <h1 className="visually-hidden">Biblioteca</h1>
      <Suspense fallback={<p className="status">Cargando biblioteca…</p>}>
        <StatsRow />
        <LibraryToolbar />
        <LibraryGrid />
      </Suspense>
    </section>
  );
}

function StatsRow() {
  const result = useAtomValue(baseLibraryAtom);
  if (!result.ok) {
    return null;
  }
  const entries = result.data;
  const weekAgo = Date.now() - 7 * DAY_MS;
  const tiles = [
    {
      label: "En lectura",
      value: entries.filter((entry) => entry.status === "reading").length,
    },
    {
      label: "Capítulos leídos",
      value: entries.reduce((sum, entry) => sum + entry.readCount, 0),
    },
    {
      label: "Sitios",
      value: new Set(entries.flatMap((entry) => entry.sourceDomains)).size,
    },
    {
      label: "Activos esta semana",
      value: entries.filter(
        (entry) =>
          entry.lastActivity &&
          new Date(entry.lastActivity.readAt).getTime() >= weekAgo,
      ).length,
    },
  ];

  return (
    <div className="stats">
      {tiles.map((tile) => (
        <div key={tile.label} className="stat-tile">
          <span className="stat-value">{tile.value}</span>
          <span className="stat-label">{tile.label}</span>
        </div>
      ))}
    </div>
  );
}

function LibraryToolbar() {
  const [search, setSearch] = useAtom(searchAtom);
  const [statusTab, setStatusTab] = useAtom(statusTabAtom);
  const [domain, setDomain] = useAtom(domainFilterAtom);
  const [sinceDays, setSinceDays] = useAtom(sinceDaysAtom);
  const [tagFilter, setTagFilter] = useAtom(tagFilterAtom);
  const domainOptions = useAtomValue(domainOptionsAtom);
  const tagOptions = useAtomValue(tagOptionsAtom);

  function toggleTag(tag: string): void {
    setTagFilter((current) =>
      current.includes(tag)
        ? current.filter((existing) => existing !== tag)
        : [...current, tag],
    );
  }

  return (
    <div className="toolbar">
      <div className="toolbar-row">
        <input
          type="search"
          className="search"
          placeholder="Buscar manga…"
          aria-label="Buscar"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="segmented">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              aria-pressed={statusTab === tab.value}
              className={statusTab === tab.value ? "active" : ""}
              onClick={() => setStatusTab(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="toolbar-row secondary">
        <label>
          Sitio
          <select
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
          >
            <option value="">Todos</option>
            {domainOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label>
          Actividad
          <select
            value={sinceDays === null ? "" : String(sinceDays)}
            onChange={(event) =>
              setSinceDays(
                event.target.value === "" ? null : Number(event.target.value),
              )
            }
          >
            {SINCE_OPTIONS.map((option) => (
              <option
                key={option.label}
                value={option.days === null ? "" : String(option.days)}
              >
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {tagOptions.length > 0 && (
          <div className="tag-filter">
            {tagOptions.map((tag) => (
              <button
                key={tag}
                type="button"
                aria-pressed={tagFilter.includes(tag)}
                className={`chip selectable ${
                  tagFilter.includes(tag) ? "active" : ""
                }`}
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LibraryGrid() {
  const result = useAtomValue(libraryAtom);
  const statusTab = useAtomValue(statusTabAtom);
  const search = useAtomValue(searchAtom);
  const tagFilter = useAtomValue(tagFilterAtom);

  if (!result.ok) {
    return (
      <p className="status error">
        No se pudo cargar la biblioteca: {result.error}
      </p>
    );
  }
  if (result.data.length === 0) {
    return (
      <p className="status">
        Sin lecturas todavía. Abrí un capítulo en un sitio trackeado y va a
        aparecer acá.
      </p>
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
      <p className="status">Nada coincide con los filtros en esta pestaña.</p>
    );
  }

  return (
    <div className="grid">
      {entries.map((entry) => (
        <MangaCard
          key={entry.id}
          entry={entry}
          showStatus={statusTab === "all"}
        />
      ))}
    </div>
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
    <article className="card">
      {/* The same destination as the title below, which carries the name.
          Out of the tab order and the accessibility tree, so each card is one
          link to a screen reader instead of an unnamed one followed by a
          named one. */}
      <Link
        to={`/manga/${entry.id}`}
        className="card-cover"
        aria-hidden="true"
        tabIndex={-1}
      >
        <CoverImage
          mangaId={entry.id}
          name={entry.canonicalName}
          coverUrl={entry.coverUrl}
          coverVersion={entry.coverVersion}
        />
        {entry.reachedChapter && (
          <span className="card-chapter">{entry.reachedChapter.label}</span>
        )}
        {showStatus && entry.status !== "reading" && (
          <span className={`card-status ${entry.status}`}>
            {STATUS_LABELS[entry.status]}
          </span>
        )}
      </Link>
      <div className="card-body">
        <Link to={`/manga/${entry.id}`} className="card-title">
          {entry.canonicalName}
        </Link>
        <span className="card-meta">
          {entry.lastActivity
            ? relativeDate(entry.lastActivity.readAt)
            : "sin lecturas"}
          {/* One card, several sites: the series was read on more than one. */}
          {entry.sourceDomains.length > 1 && (
            <span
              className="card-sources"
              title={entry.sourceDomains.join(", ")}
            >
              {" · "}
              {entry.sourceDomains.length} sitios
            </span>
          )}
        </span>
        {entry.lastSourceUrl && (
          <a
            className="card-continue"
            href={entry.lastSourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            Seguir leyendo ↗
          </a>
        )}
      </div>
    </article>
  );
}
