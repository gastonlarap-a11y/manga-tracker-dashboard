import { useSetAtom } from "jotai";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { deleteManga, getMangaHistory, updateManga } from "../api/client";
import type { MangaDto, MangaHistoryDto, MangaStatus } from "../api/types";
import { CoverImage } from "../components/CoverImage";
import { RenameForm } from "../components/RenameForm";
import { formatDate, relativeDate } from "../lib/dates";
import { baseLibraryAtom, libraryAtom } from "../state/atoms";

type HistoryState =
  | { kind: "loading" }
  | { kind: "error"; error: string }
  | { kind: "loaded"; history: MangaHistoryDto };

const STATUS_CHOICES: { value: MangaStatus; label: string }[] = [
  { value: "reading", label: "Leyendo" },
  { value: "completed", label: "Terminado" },
  { value: "dropped", label: "Abandonado" },
];

export function MangaDetailView() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<HistoryState>({ kind: "loading" });
  const refreshLibrary = useSetAtom(libraryAtom);
  const refreshBase = useSetAtom(baseLibraryAtom);

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
  }, [id]);

  function applyManga(manga: MangaDto): void {
    setState((previous) =>
      previous.kind === "loaded"
        ? { kind: "loaded", history: { ...previous.history, manga } }
        : previous,
    );
    // The cached library projections still show the old values.
    refreshLibrary();
    refreshBase();
  }

  if (state.kind === "loading") {
    return <p className="status">Cargando historial…</p>;
  }
  if (state.kind === "error") {
    return (
      <p className="status error">No se pudo cargar el manga: {state.error}</p>
    );
  }

  const { manga, events } = state.history;
  const lastUrl = events[0]?.sourceUrl ?? null;

  return (
    <section>
      <Link className="back" to="/">
        ← Biblioteca
      </Link>
      <div className="detail-head">
        <div className="detail-cover-column">
          <CoverImage
            mangaId={manga.id}
            name={manga.canonicalName}
            coverUrl={manga.coverUrl}
            className="detail-cover"
          />
          <CoverEditor manga={manga} onUpdated={applyManga} />
        </div>
        <div className="detail-info">
          <div className="view-head">
            <h1>{manga.canonicalName}</h1>
            <RenameForm
              mangaId={manga.id}
              currentName={manga.canonicalName}
              onRenamed={applyManga}
            />
          </div>
          <StatusPicker manga={manga} onUpdated={applyManga} />
          <TagsEditor manga={manga} onUpdated={applyManga} />
          <p className="meta">
            Slug: <code>{manga.normalizedSlug}</code> · {events.length} lecturas
          </p>
          {lastUrl && (
            <a
              className="continue"
              href={lastUrl}
              target="_blank"
              rel="noreferrer"
            >
              Seguir leyendo ↗
            </a>
          )}
        </div>
      </div>
      {events.length === 0 ? (
        <p className="status">Sin lecturas registradas.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Capítulo</th>
              <th>Fecha</th>
              <th>Sitio</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>{event.chapterLabel}</td>
                <td title={formatDate(event.readAt)}>
                  {relativeDate(event.readAt)}
                </td>
                <td>
                  <span className="chip">{event.sourceDomain}</span>
                </td>
                <td>
                  <a href={event.sourceUrl} target="_blank" rel="noreferrer">
                    Abrir
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <DangerZone mangaId={manga.id} name={manga.canonicalName} />
    </section>
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
      {error && <span className="error">{error}</span>}
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
            aria-label={`Quitar ${tag}`}
            disabled={saving}
            onClick={() =>
              void saveTags(manga.tags.filter((existing) => existing !== tag))
            }
          >
            ×
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
          value={draft}
          disabled={saving}
          placeholder="Agregar tag…"
          aria-label="Nuevo tag"
          onChange={(event) => setDraft(event.target.value)}
        />
      </form>
      {error && <span className="error">{error}</span>}
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
          className="ghost"
          disabled={state.kind === "saving"}
          onClick={() => setState({ kind: "editing", value: "" })}
        >
          Cambiar imagen…
        </button>
        {manga.coverUrl && (
          <button
            type="button"
            className="ghost"
            disabled={state.kind === "saving"}
            onClick={() => void save(null)}
          >
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
        <button type="submit">Guardar</button>
        <button
          type="button"
          className="ghost"
          onClick={() => setState({ kind: "idle" })}
        >
          Cancelar
        </button>
      </form>
      {state.kind === "error" && <span className="error">{state.error}</span>}
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
  const refreshLibrary = useSetAtom(libraryAtom);
  const refreshBase = useSetAtom(baseLibraryAtom);

  async function confirmDelete(): Promise<void> {
    setZone({ kind: "deleting" });
    const result = await deleteManga(mangaId);
    if (!result.ok) {
      setZone({ kind: "error", error: result.error });
      return;
    }
    refreshLibrary();
    refreshBase();
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
          Borrar manga…
        </button>
      </div>
    );
  }

  return (
    <div className="danger-zone">
      <p>
        ¿Borrar <strong>{name}</strong> y todo su historial? No se puede
        deshacer.
      </p>
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
      {zone.kind === "error" && <span className="error">{zone.error}</span>}
    </div>
  );
}
