import { useAtomValue, useSetAtom } from "jotai";
import { unwrap } from "jotai/utils";
import {
  ArrowLeft,
  Combine,
  ImageOff,
  ImagePlus,
  Play,
  Trash,
  Unlink,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  deleteManga,
  getLibraryPage,
  getMangaHistory,
  mergeMangas,
  unmergeManga,
  updateManga,
} from "../api/client";
import type {
  HistoryEventDto,
  LibraryEntryDto,
  MangaDto,
  MangaHistoryDto,
  MangaStatus,
} from "../api/types";
import { AmbientCover, CoverImage } from "../components/CoverImage";
import { RenameForm } from "../components/RenameForm";
import { DetailSkeleton } from "../components/Skeleton";
import { formatDate, relativeDate } from "../lib/dates";
import {
  continueReadingAtom,
  refreshLibraryAtom,
  SEARCH_PAUSE_MS,
} from "../state/atoms";
import { libraryPagesAtom } from "../state/libraryPages";
import { ReadingHistory } from "./detail/ReadingHistory";

type HistoryState =
  | { kind: "loading" }
  | { kind: "error"; error: string }
  | { kind: "loaded"; history: MangaHistoryDto };

const STATUS_CHOICES: { value: MangaStatus; label: string }[] = [
  { value: "reading", label: "Leyendo" },
  { value: "completed", label: "Terminado" },
  { value: "dropped", label: "Abandonado" },
];

const shortDate = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

// What the library already knows, without suspending: shown while the history
// loads (see DetailSkeleton), never instead of it. Coming from a card, the
// card is in the grid's pages or in the recents above it.
const cachedRecentsAtom = unwrap(
  continueReadingAtom,
  (previous) => previous ?? null,
);

function useKnownEntry(id: string | undefined): LibraryEntryDto | undefined {
  const pages = useAtomValue(libraryPagesAtom);
  const recents = useAtomValue(cachedRecentsAtom);
  if (id === undefined) {
    return undefined;
  }
  return (
    pages?.items.find((entry) => entry.id === id) ??
    (recents?.ok
      ? recents.data.items.find((entry) => entry.id === id)
      : undefined)
  );
}

export function MangaDetailView() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<HistoryState>({ kind: "loading" });
  const known = useKnownEntry(id);
  const refreshLibrary = useSetAtom(refreshLibraryAtom);
  // Bumped after a merge or an unmerge: the whole history changes shape, so it
  // is refetched rather than patched in place.
  const [reloads, setReloads] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reloads` is a refetch trigger, not a value the effect reads — a merge changes the shape of the whole history.
  useEffect(() => {
    if (!id) {
      return;
    }
    let cancelled = false;
    setState({ kind: "loading" });
    void getMangaHistory(id).then((result) => {
      if (cancelled) {
        return;
      }
      setState(
        result.ok
          ? { kind: "loaded", history: result.data }
          : { kind: "error", error: result.error },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [id, reloads]);

  function reloadEverything(): void {
    setReloads((count) => count + 1);
    refreshLibrary();
  }

  function applyManga(manga: MangaDto): void {
    setState((previous) =>
      previous.kind === "loaded"
        ? { kind: "loaded", history: { ...previous.history, manga } }
        : previous,
    );
    // The pages the library holds still show the old values.
    refreshLibrary();
  }

  if (state.kind === "loading") {
    return <DetailSkeleton entry={known} />;
  }
  if (state.kind === "error") {
    return (
      <div className="detail">
        <BackLink />
        <p className="status error" role="alert">
          No se pudo cargar el manga: {state.error}
        </p>
      </div>
    );
  }

  const { manga, aliases, events } = state.history;
  const lastUrl = events[0]?.sourceUrl ?? null;

  return (
    <article className="detail">
      <AmbientCover
        className="detail-ambient"
        mangaId={manga.id}
        name={manga.canonicalName}
        coverUrl={manga.coverUrl}
        coverVersion={manga.coverVersion}
      />
      <BackLink />
      <div className="detail-layout">
        <aside className="detail-side">
          <CoverImage
            mangaId={manga.id}
            name={manga.canonicalName}
            coverUrl={manga.coverUrl}
            coverVersion={manga.coverVersion}
            className="detail-cover"
            priority
          />
          {lastUrl && (
            <a
              className="button primary block"
              href={lastUrl}
              target="_blank"
              rel="noreferrer"
            >
              <Play aria-hidden="true" />
              Seguir leyendo
            </a>
          )}
          <CoverEditor manga={manga} onUpdated={applyManga} />
        </aside>
        <div className="detail-main">
          <header className="detail-header">
            <div className="detail-title-row">
              <h1>{manga.canonicalName}</h1>
              <RenameForm
                mangaId={manga.id}
                currentName={manga.canonicalName}
                onRenamed={applyManga}
              />
            </div>
            <Facts events={events} />
            <StatusPicker manga={manga} onUpdated={applyManga} />
            <TagsEditor manga={manga} onUpdated={applyManga} />
            <MergedSources
              manga={manga}
              aliases={aliases}
              onChanged={reloadEverything}
            />
          </header>
          <ReadingHistory events={events} />
          <footer className="detail-footer">
            <DangerZone mangaId={manga.id} name={manga.canonicalName} />
            {/* What dedup keys on. Useful when a merge goes wrong, noise the
                rest of the time — so it is one click away, not on the page. */}
            <details className="technical">
              <summary>Detalles técnicos</summary>
              <dl>
                <dt>Slug</dt>
                <dd>
                  <code>{manga.normalizedSlug}</code>
                </dd>
                <dt>Id</dt>
                <dd>
                  <code>{manga.id}</code>
                </dd>
              </dl>
            </details>
          </footer>
        </div>
      </div>
    </article>
  );
}

// No view transition: the library is kept alive behind this page and comes
// back at once, where it was left; animating the way there only delayed it.
function BackLink() {
  return (
    <Link className="back" to="/">
      <ArrowLeft aria-hidden="true" />
      Biblioteca
    </Link>
  );
}

/**
 * The few numbers worth seeing before the history: how far, how many, where
 * and since when. Derived from the history itself, which lists each chapter
 * once even across merged sites.
 */
function Facts({ events }: { events: HistoryEventDto[] }) {
  const reached = events.reduce<HistoryEventDto | null>(
    (best, event) =>
      event.chapterNumber !== null &&
      (best?.chapterNumber == null || event.chapterNumber > best.chapterNumber)
        ? event
        : best,
    null,
  );
  const sites = new Set(
    events.flatMap((event) => [event.sourceDomain, ...event.alsoReadOn]),
  );
  const latest = events[0];
  const first = events.at(-1);

  return (
    <dl className="facts">
      <div>
        <dt>Alcanzado</dt>
        <dd>{reached?.chapterLabel ?? "—"}</dd>
      </div>
      <div>
        <dt>Leídos</dt>
        <dd>{events.length}</dd>
      </div>
      <div>
        <dt>Sitios</dt>
        <dd>{sites.size}</dd>
      </div>
      {latest && (
        <div>
          <dt>Última lectura</dt>
          <dd title={formatDate(latest.readAt)}>
            {relativeDate(latest.readAt)}
          </dd>
        </div>
      )}
      {first && (
        <div>
          <dt>Desde</dt>
          <dd>{shortDate.format(new Date(first.readAt))}</dd>
        </div>
      )}
    </dl>
  );
}

type MergeState =
  | { kind: "idle" }
  | { kind: "picking" }
  | { kind: "working" }
  | { kind: "error"; error: string };

/**
 * The manual answer to "these two are the same manga". Needed because no local
 * heuristic can relate a Spanish title to an English one — and asking an
 * external catalogue would trade the whole local-first design for a guess.
 *
 * The manga being viewed is always the one that survives: its name, status and
 * tags are the ones already curated here.
 */
function MergedSources({
  manga,
  aliases,
  onChanged,
}: {
  manga: MangaDto;
  aliases: MangaDto[];
  onChanged: () => void;
}) {
  const [state, setState] = useState<MergeState>({ kind: "idle" });

  async function merge(aliasId: string): Promise<void> {
    setState({ kind: "working" });
    const result = await mergeMangas(manga.id, aliasId);
    if (result.ok) {
      setState({ kind: "idle" });
      onChanged();
    } else {
      setState({ kind: "error", error: result.error });
    }
  }

  async function detach(aliasId: string): Promise<void> {
    setState({ kind: "working" });
    const result = await unmergeManga(aliasId);
    if (result.ok) {
      setState({ kind: "idle" });
      onChanged();
    } else {
      setState({ kind: "error", error: result.error });
    }
  }

  const busy = state.kind === "working";

  return (
    <div className="merged-sources">
      {aliases.length > 0 && (
        <div className="aliases">
          <span className="field-label">También se llama</span>
          <ul className="alias-list">
            {aliases.map((alias) => (
              <li key={alias.id} className="alias">
                <span>{alias.canonicalName}</span>
                <button
                  type="button"
                  className="ghost small"
                  disabled={busy}
                  onClick={() => void detach(alias.id)}
                >
                  <Unlink aria-hidden="true" />
                  Separar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {state.kind === "picking" ? (
        <MergePicker
          excludeId={manga.id}
          onPick={(id) => void merge(id)}
          onCancel={() => setState({ kind: "idle" })}
        />
      ) : (
        <button
          type="button"
          className="ghost"
          disabled={busy}
          onClick={() => setState({ kind: "picking" })}
        >
          <Combine aria-hidden="true" />
          Es el mismo que…
        </button>
      )}
      {state.kind === "error" && (
        <span className="error" role="alert">
          {state.error}
        </span>
      )}
    </div>
  );
}

/** Options the picker lists: enough to find one, few enough to scan. */
const PICKER_OPTIONS = 8;

type PickerOptions =
  | { kind: "loading" }
  | { kind: "ready"; entries: LibraryEntryDto[] }
  | { kind: "error"; error: string };

// Searched by the server, like the toolbar: the browser does not hold the
// library, and asking for all of it to show eight was what it used to cost.
// Every other card is a valid target — the point is joining titles that look
// nothing alike — so the search is over the whole library, any status.
function MergePicker({
  excludeId,
  onPick,
  onCancel,
}: {
  excludeId: string;
  onPick: (id: string) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<PickerOptions>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(
      async () => {
        const result = await getLibraryPage({
          q: query,
          // One more than shown, in case the manga being viewed is among them.
          limit: PICKER_OPTIONS + 1,
        });
        if (cancelled) {
          return;
        }
        setOptions(
          result.ok
            ? {
                kind: "ready",
                entries: result.data.items
                  .filter((entry) => entry.id !== excludeId)
                  .slice(0, PICKER_OPTIONS),
              }
            : { kind: "error", error: result.error },
        );
      },
      // The first list, before anything is typed, need not wait.
      query === "" ? 0 : SEARCH_PAUSE_MS,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, excludeId]);

  const matches = options.kind === "ready" ? options.entries : [];

  return (
    <div className="merge-picker">
      <div className="merge-picker-head">
        <input
          value={query}
          aria-label="Buscar el manga a unir"
          placeholder="Buscar en la biblioteca…"
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          type="button"
          className="icon-button"
          aria-label="Cancelar"
          title="Cancelar"
          onClick={onCancel}
        >
          <X aria-hidden="true" />
        </button>
      </div>
      <ul>
        {matches.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              className="option"
              onClick={() => onPick(entry.id)}
            >
              <CoverImage
                mangaId={entry.id}
                name={entry.canonicalName}
                coverUrl={entry.coverUrl}
                coverVersion={entry.coverVersion}
                className="option-cover"
              />
              <span>{entry.canonicalName}</span>
            </button>
          </li>
        ))}
        {options.kind === "ready" && matches.length === 0 && (
          <li className="meta">Sin coincidencias.</li>
        )}
        {options.kind === "error" && (
          <li className="error" role="alert">
            {options.error}
          </li>
        )}
      </ul>
    </div>
  );
}

function StatusPicker({
  manga,
  onUpdated,
}: {
  manga: MangaDto;
  onUpdated: (manga: MangaDto) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(status: MangaStatus): Promise<void> {
    if (status === manga.status) {
      return;
    }
    setSaving(true);
    setError(null);
    const result = await updateManga(manga.id, { status });
    setSaving(false);
    if (result.ok) {
      onUpdated(result.data);
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="status-picker">
      <div className="segmented">
        {STATUS_CHOICES.map((choice) => (
          <button
            key={choice.value}
            type="button"
            disabled={saving}
            aria-pressed={manga.status === choice.value}
            className={manga.status === choice.value ? "active" : ""}
            onClick={() => void setStatus(choice.value)}
          >
            {choice.label}
          </button>
        ))}
      </div>
      {error && (
        <span className="error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

function TagsEditor({
  manga,
  onUpdated,
}: {
  manga: MangaDto;
  onUpdated: (manga: MangaDto) => void;
}) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveTags(tags: string[]): Promise<void> {
    setSaving(true);
    setError(null);
    const result = await updateManga(manga.id, { tags });
    setSaving(false);
    if (result.ok) {
      onUpdated(result.data);
    } else {
      setError(result.error);
    }
  }

  function addTag(): void {
    const tag = draft.trim().toLowerCase();
    setDraft("");
    if (tag.length === 0 || manga.tags.includes(tag)) {
      return;
    }
    void saveTags([...manga.tags, tag]);
  }

  return (
    <div className="tags-editor">
      {manga.tags.map((tag) => (
        <span key={tag} className="chip">
          {tag}
          <button
            type="button"
            className="chip-remove"
            aria-label={`Quitar ${tag}`}
            disabled={saving}
            onClick={() =>
              void saveTags(manga.tags.filter((existing) => existing !== tag))
            }
          >
            <X aria-hidden="true" />
          </button>
        </span>
      ))}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          addTag();
        }}
      >
        <input
          className="tag-input"
          value={draft}
          disabled={saving}
          placeholder="Agregar tag…"
          aria-label="Nuevo tag"
          onChange={(event) => setDraft(event.target.value)}
        />
      </form>
      {error && (
        <span className="error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

type CoverEditorState =
  | { kind: "idle" }
  | { kind: "editing"; value: string }
  | { kind: "saving" }
  | { kind: "error"; error: string; value: string };

// Manual cover: sites like olympus only expose their logo as og:image, so
// the user can paste the real cover URL (from the site's manga page) here.
// The backend never overwrites a stored cover automatically (first wins).
function CoverEditor({
  manga,
  onUpdated,
}: {
  manga: MangaDto;
  onUpdated: (manga: MangaDto) => void;
}) {
  const [state, setState] = useState<CoverEditorState>({ kind: "idle" });

  async function save(coverUrl: string | null): Promise<void> {
    setState({ kind: "saving" });
    const result = await updateManga(manga.id, { coverUrl });
    if (result.ok) {
      setState({ kind: "idle" });
      onUpdated(result.data);
    } else {
      setState({ kind: "error", error: result.error, value: coverUrl ?? "" });
    }
  }

  if (state.kind === "idle" || state.kind === "saving") {
    return (
      <div className="cover-editor">
        <button
          type="button"
          className="ghost small"
          disabled={state.kind === "saving"}
          onClick={() => setState({ kind: "editing", value: "" })}
        >
          <ImagePlus aria-hidden="true" />
          Cambiar imagen…
        </button>
        {manga.coverUrl && (
          <button
            type="button"
            className="ghost small"
            disabled={state.kind === "saving"}
            onClick={() => void save(null)}
          >
            <ImageOff aria-hidden="true" />
            Quitar imagen
          </button>
        )}
      </div>
    );
  }

  const value = state.value;

  return (
    <div className="cover-editor">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = value.trim();
          if (trimmed.length > 0) {
            void save(trimmed);
          }
        }}
      >
        <input
          aria-label="URL de la imagen"
          placeholder="https://…/portada.jpg"
          value={value}
          onChange={(event) =>
            setState({ kind: "editing", value: event.target.value })
          }
        />
        <div className="row">
          <button type="submit" className="primary small">
            Guardar
          </button>
          <button
            type="button"
            className="ghost small"
            onClick={() => setState({ kind: "idle" })}
          >
            Cancelar
          </button>
        </div>
      </form>
      {state.kind === "error" && (
        <span className="error" role="alert">
          {state.error}
        </span>
      )}
    </div>
  );
}

type DangerState =
  | { kind: "idle" }
  | { kind: "confirming" }
  | { kind: "deleting" }
  | { kind: "error"; error: string };

function DangerZone({ mangaId, name }: { mangaId: string; name: string }) {
  const [zone, setZone] = useState<DangerState>({ kind: "idle" });
  const navigate = useNavigate();
  const refreshLibrary = useSetAtom(refreshLibraryAtom);

  async function confirmDelete(): Promise<void> {
    setZone({ kind: "deleting" });
    const result = await deleteManga(mangaId);
    if (!result.ok) {
      setZone({ kind: "error", error: result.error });
      return;
    }
    refreshLibrary();
    void navigate("/");
  }

  if (zone.kind === "idle") {
    return (
      <div className="danger-zone">
        <button
          type="button"
          className="ghost danger"
          onClick={() => setZone({ kind: "confirming" })}
        >
          <Trash aria-hidden="true" />
          Borrar manga…
        </button>
      </div>
    );
  }

  return (
    <div className="danger-zone confirming">
      <p>
        ¿Borrar <strong>{name}</strong> y todo su historial? No se puede
        deshacer.
      </p>
      <div className="row">
        <button
          type="button"
          className="danger-solid"
          disabled={zone.kind === "deleting"}
          onClick={() => void confirmDelete()}
        >
          {zone.kind === "deleting" ? "Borrando…" : "Sí, borrar"}
        </button>
        <button
          type="button"
          className="ghost"
          disabled={zone.kind === "deleting"}
          onClick={() => setZone({ kind: "idle" })}
        >
          Cancelar
        </button>
      </div>
      {zone.kind === "error" && (
        <span className="error" role="alert">
          {zone.error}
        </span>
      )}
    </div>
  );
}
