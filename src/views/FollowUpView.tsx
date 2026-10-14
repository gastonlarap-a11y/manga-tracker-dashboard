import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { unwrap } from "jotai/utils";
import { CircleCheck, CirclePause, Play } from "lucide-react";
import { startTransition, useEffect, useState } from "react";
import { Link } from "react-router";
import { type ApiResult, updateManga } from "../api/client";
import type {
  LibraryEntryDto,
  LibrarySummaryDto,
  MangaStatus,
} from "../api/types";
import { CoverImage } from "../components/CoverImage";
import { formatDate, relativeDate } from "../lib/dates";
import {
  type FollowUpTab,
  followUpTabAtom,
  libraryRevisionAtom,
  librarySummaryAtom,
  refreshLibraryAtom,
  staleDaysAtom,
} from "../state/atoms";
import { followUpPages } from "../state/libraryPages";
import { STALE_WINDOWS, staleWindowLabel } from "./follow-up/staleWindows";

// Without suspending: the tab counts are a hint, never a reason to blank the
// page while the summary reloads.
const summaryAtom = unwrap(librarySummaryAtom, (previous) => previous ?? null);

/** What each status button does, said as the action rather than the state. */
const ACTIONS: Record<MangaStatus, string> = {
  reading: "Retomar",
  on_hold: "Pausar",
  completed: "Marcar terminada",
  dropped: "Abandonar",
};

/** What a row offers, besides opening its last chapter. */
const CHOICES: Record<FollowUpTab, readonly MangaStatus[]> = {
  stale: ["on_hold", "completed", "dropped"],
  on_hold: ["reading", "completed", "dropped"],
};

const WEEK_MS = 7 * 86_400_000;

/**
 * Series to follow up on: the ones still in Leyendo that went unread for a
 * while, the most forgotten first, and the ones set aside as En pausa. Each
 * row says when it was last read and settles it in one click — reading a
 * chapter never changes a status, so this is where it gets decided.
 */
export function FollowUpView() {
  return (
    <section className="follow-up">
      <header className="page-head">
        <h1>Seguimiento</h1>
        <p className="lede">
          Las series que tenés en Leyendo y hace tiempo que no abrís, de la más
          olvidada a la más reciente, y las que dejaste en pausa. Leer un
          capítulo no cambia el estado de una serie: lo decidís vos, acá o en su
          página.
        </p>
      </header>
      <FollowUpControls />
      <FollowUpList />
    </section>
  );
}

function FollowUpControls() {
  const [tab, setTab] = useAtom(followUpTabAtom);
  const [staleDays, setStaleDays] = useAtom(staleDaysAtom);
  const summary = useAtomValue(summaryAtom);
  const counts: Record<FollowUpTab, number | null> = {
    stale: summary?.ok ? summary.data.stale : null,
    on_hold: summary?.ok ? summary.data.counts.on_hold : null,
  };
  const tabs: { value: FollowUpTab; label: string }[] = [
    { value: "stale", label: "Sin leer" },
    { value: "on_hold", label: "En pausa" },
  ];

  return (
    <div className="follow-controls">
      <div className="segmented">
        {tabs.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={tab === value}
            className={tab === value ? "active" : ""}
            onClick={() => setTab(value)}
          >
            {label}
            {counts[value] !== null && (
              <>
                {" "}
                <span className="count">{counts[value]}</span>
              </>
            )}
          </button>
        ))}
      </div>
      {tab === "stale" && (
        <label className="select">
          <span>Sin leer hace más de</span>
          <select
            value={String(staleDays)}
            onChange={(event) => {
              const days = Number(event.target.value);
              // The summary behind the counts reloads with the window; inside
              // a transition the library behind this page keeps its tiles.
              startTransition(() => setStaleDays(days));
            }}
          >
            {STALE_WINDOWS.map((window) => (
              <option key={window.days} value={String(window.days)}>
                {window.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

function FollowUpList() {
  const tab = useAtomValue(followUpTabAtom);
  const staleDays = useAtomValue(staleDaysAtom);
  const pages = useAtomValue(followUpPages.pagesAtom);
  const key = useAtomValue(followUpPages.keyAtom);
  const revision = useAtomValue(libraryRevisionAtom);
  const summary = useAtomValue(summaryAtom);
  const sync = useSetAtom(followUpPages.syncAtom);
  const loadMore = useSetAtom(followUpPages.loadMoreAtom);
  const refreshLibrary = useSetAtom(refreshLibraryAtom);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the key and the revision are what the pages must follow; sync reads both from the store.
  useEffect(() => {
    void sync();
  }, [sync, key, revision]);

  // A change moves the revision: the pages are read again and the row leaves.
  // In a transition, so the rows still there stay on screen meanwhile.
  function refresh(): void {
    startTransition(() => refreshLibrary());
  }

  // Pages of the other tab are not shown under this one: their rows would
  // offer the other tab's actions.
  if (pages === null || pages.key !== key) {
    return (
      <div className="follow-skeleton" role="status">
        <span className="visually-hidden">Buscando series…</span>
        <div className="tile skeleton skeleton-block" aria-hidden="true" />
      </div>
    );
  }
  if (pages.error !== null && pages.items.length === 0) {
    return (
      <p className="status error" role="alert">
        No se pudo cargar la lista: {pages.error}
      </p>
    );
  }
  if (pages.items.length === 0) {
    return <EmptyList tab={tab} staleDays={staleDays} summary={summary} />;
  }

  const total =
    summary?.ok === true
      ? tab === "stale"
        ? summary.data.stale
        : summary.data.counts.on_hold
      : null;
  return (
    <>
      {pages.error !== null && (
        <p className="status error" role="alert">
          No se pudo actualizar la lista: {pages.error}
        </p>
      )}
      <ul
        className="follow-rows"
        aria-label={tab === "stale" ? "Series sin leer" : "Series en pausa"}
        aria-busy={pages.loading}
      >
        {pages.items.map((entry) => (
          <FollowUpRow
            key={entry.id}
            entry={entry}
            tab={tab}
            onChanged={refresh}
          />
        ))}
      </ul>
      <div className="follow-more">
        {total !== null && (
          <span className="meta">
            {pages.items.length} de {total}
          </span>
        )}
        {pages.nextCursor !== null && (
          <button
            type="button"
            className="ghost"
            disabled={pages.loading}
            onClick={() => void loadMore()}
          >
            {pages.loading ? "Cargando…" : "Cargar más"}
          </button>
        )}
      </div>
    </>
  );
}

function EmptyList({
  tab,
  staleDays,
  summary,
}: {
  tab: FollowUpTab;
  staleDays: number;
  summary: ApiResult<LibrarySummaryDto> | null;
}) {
  if (tab === "on_hold") {
    return (
      <div className="empty">
        <CirclePause aria-hidden="true" />
        <p className="empty-title">No hay series en pausa</p>
        <p>
          Podés pausar una desde la pestaña Sin leer o desde su página, y
          retomarla desde acá cuando vuelva.
        </p>
      </div>
    );
  }
  if (summary?.ok === true && summary.data.counts.reading === 0) {
    return (
      <div className="empty">
        <CircleCheck aria-hidden="true" />
        <p className="empty-title">No tenés series en Leyendo</p>
      </div>
    );
  }
  return (
    <div className="empty">
      <CircleCheck aria-hidden="true" />
      <p className="empty-title">Al día</p>
      <p>
        Ninguna serie en Leyendo lleva más de {staleWindowLabel(staleDays)} sin
        leerse.
      </p>
    </div>
  );
}

type RowState =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "error"; error: string };

/** The site a URL is on, or null for one that does not parse. */
function siteOf(url: string | null): string | null {
  if (url === null) {
    return null;
  }
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function FollowUpRow({
  entry,
  tab,
  onChanged,
}: {
  entry: LibraryEntryDto;
  tab: FollowUpTab;
  onChanged: () => void;
}) {
  const [state, setState] = useState<RowState>({ kind: "idle" });
  const busy = state.kind === "working";
  const readAt = entry.lastActivity?.readAt ?? null;
  const site = siteOf(entry.lastSourceUrl) ?? entry.sourceDomains[0] ?? null;
  const readThisWeek =
    readAt !== null && Date.now() - Date.parse(readAt) < WEEK_MS;

  async function setStatus(status: MangaStatus): Promise<void> {
    setState({ kind: "working" });
    const result = await updateManga(entry.id, { status });
    if (result.ok) {
      // The row leaves with the refresh, so its state is not reset.
      onChanged();
    } else {
      setState({ kind: "error", error: result.error });
    }
  }

  return (
    <li className="tile follow-row">
      {/* Same destination as the name beside it, which carries the name. */}
      <Link
        to={`/manga/${entry.id}`}
        className="follow-cover"
        aria-hidden="true"
        tabIndex={-1}
      >
        <CoverImage
          mangaId={entry.id}
          name={entry.canonicalName}
          coverUrl={entry.coverUrl}
          coverVersion={entry.coverVersion}
        />
      </Link>
      <div className="follow-info">
        <Link to={`/manga/${entry.id}`} className="follow-name">
          {entry.canonicalName}
        </Link>
        <p className="meta follow-meta">
          {entry.lastActivity !== null && readAt !== null ? (
            <>
              <span>{entry.lastActivity.chapterLabel}</span>
              <span aria-hidden="true">·</span>
              <time dateTime={readAt} title={formatDate(readAt)}>
                {relativeDate(readAt)}
              </time>
            </>
          ) : (
            <span>sin lecturas</span>
          )}
          {site !== null && (
            <>
              <span aria-hidden="true">·</span>
              <span>{site}</span>
            </>
          )}
          {tab === "on_hold" && readThisWeek && (
            <span className="chip chip-good">Leída esta semana</span>
          )}
        </p>
      </div>
      <div className="follow-actions">
        {entry.lastSourceUrl !== null && (
          <a
            className="button tonal small"
            href={entry.lastSourceUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Continuar ${entry.canonicalName}`}
          >
            <Play aria-hidden="true" />
            Continuar
          </a>
        )}
        {CHOICES[tab].map((status) => (
          <button
            key={status}
            type="button"
            className="ghost small"
            disabled={busy}
            aria-label={`${ACTIONS[status]}: ${entry.canonicalName}`}
            onClick={() => void setStatus(status)}
          >
            {ACTIONS[status]}
          </button>
        ))}
        {state.kind === "error" && (
          <span className="error" role="alert">
            {state.error}
          </span>
        )}
      </div>
    </li>
  );
}
