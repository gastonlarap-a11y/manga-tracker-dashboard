import { useSetAtom } from "jotai";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { getMangaHistory } from "../api/client";
import type { MangaDto, MangaHistoryDto } from "../api/types";
import { RenameForm } from "../components/RenameForm";
import { formatDate, relativeDate } from "../lib/dates";
import { libraryAtom } from "../state/atoms";

type HistoryState =
  | { kind: "loading" }
  | { kind: "error"; error: string }
  | { kind: "loaded"; history: MangaHistoryDto };

export function MangaDetailView() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<HistoryState>({ kind: "loading" });
  const refreshLibrary = useSetAtom(libraryAtom);

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

  function applyRename(manga: MangaDto): void {
    setState((previous) =>
      previous.kind === "loaded"
        ? { kind: "loaded", history: { ...previous.history, manga } }
        : previous,
    );
    // The cached library projection still shows the old name.
    refreshLibrary();
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

  return (
    <section>
      <Link className="back" to="/">
        ← Biblioteca
      </Link>
      <div className="view-head">
        <h1>{manga.canonicalName}</h1>
        <RenameForm
          mangaId={manga.id}
          currentName={manga.canonicalName}
          onRenamed={applyRename}
        />
      </div>
      <p className="meta">
        Slug: <code>{manga.normalizedSlug}</code> · {events.length} lecturas
      </p>
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
    </section>
  );
}
