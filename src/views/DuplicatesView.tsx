import { useAtomValue, useSetAtom } from "jotai";
import { CircleCheck, TriangleAlert } from "lucide-react";
import type { CSSProperties } from "react";
import { Suspense, startTransition, useState } from "react";
import { Link } from "react-router";
import { dismissDuplicate, mergeMangas } from "../api/client";
import type { DuplicatePairDto, MangaDto } from "../api/types";
import { CoverImage } from "../components/CoverImage";
import { RenameForm } from "../components/RenameForm";
import { duplicatesAtom, refreshLibraryAtom } from "../state/atoms";

const REASON_LABELS: Record<string, string> = {
  tokens: "palabras casi iguales",
  "edit-distance": "títulos casi idénticos",
  containment: "uno contiene al otro",
  cover: "misma portada",
};

export function DuplicatesView() {
  return (
    <section className="duplicates">
      <header className="page-head">
        <h1>Duplicados</h1>
        <p className="lede">
          Series que parecen estar dos veces en la biblioteca. Al unirlas queda
          una sola tarjeta con el historial de ambas: no se borra ni se mueve
          ninguna lectura, y se puede deshacer desde el detalle del manga.
        </p>
      </header>
      <Suspense
        fallback={
          <div className="pairs-skeleton" role="status">
            <span className="visually-hidden">Buscando duplicados…</span>
            <div className="tile skeleton skeleton-block" aria-hidden="true" />
          </div>
        }
      >
        <DuplicatesList />
      </Suspense>
    </section>
  );
}

function DuplicatesList() {
  const result = useAtomValue(duplicatesAtom);
  const refreshDuplicates = useSetAtom(duplicatesAtom);
  const refreshLibrary = useSetAtom(refreshLibraryAtom);

  // A transition keeps the list on screen while it reloads, so resolving one
  // pair does not drop every other pair back to the skeleton.
  function refreshAll(): void {
    startTransition(() => {
      refreshDuplicates();
      refreshLibrary();
    });
  }

  if (!result.ok) {
    return (
      <p className="status error" role="alert">
        No se pudieron cargar los duplicados: {result.error}
      </p>
    );
  }
  if (result.data.length === 0) {
    return (
      <div className="empty">
        <CircleCheck aria-hidden="true" />
        <p className="empty-title">Todo en orden</p>
        <p>No hay series que parezcan estar dos veces.</p>
      </div>
    );
  }

  return (
    <ul className="pairs">
      {result.data.map((pair) => (
        <PairRow
          key={`${pair.a.id}:${pair.b.id}`}
          pair={pair}
          onResolved={refreshAll}
        />
      ))}
    </ul>
  );
}

type PairState =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "error"; error: string };

function PairRow({
  pair,
  onResolved,
}: {
  pair: DuplicatePairDto;
  onResolved: () => void;
}) {
  const [state, setState] = useState<PairState>({ kind: "idle" });
  const busy = state.kind === "working";
  const percent = Math.round(pair.similarity * 100);

  async function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setState({ kind: "working" });
    const result = await action();
    if (result.ok) {
      // The row disappears with the refresh, so no need to reset the state.
      onResolved();
    } else {
      setState({ kind: "error", error: result.error ?? "Falló la operación" });
    }
  }

  return (
    <li className="tile pair">
      <div className="pair-score">
        <span
          className="meter"
          // Cast justified: a custom property is not in CSSProperties' keys.
          style={{ "--value": pair.similarity } as CSSProperties}
          aria-hidden="true"
        />
        <span className="meter-value">{percent} %</span>
        <span className="visually-hidden"> de parecido</span>
        <div className="pair-why">
          {pair.reasons.map((reason) => (
            <span key={reason} className="chip">
              {REASON_LABELS[reason] ?? reason}
            </span>
          ))}
        </div>
        {pair.sequelSuspicion && (
          <p className="warning">
            <TriangleAlert aria-hidden="true" />
            Puede ser una temporada o spin-off, no la misma obra.
          </p>
        )}
      </div>
      <div className="pair-sides">
        <PairSide
          manga={pair.a}
          busy={busy}
          onRenamed={onResolved}
          onMergeHere={() => void run(() => mergeMangas(pair.a.id, pair.b.id))}
        />
        <PairSide
          manga={pair.b}
          busy={busy}
          onRenamed={onResolved}
          onMergeHere={() => void run(() => mergeMangas(pair.b.id, pair.a.id))}
        />
      </div>
      <div className="pair-actions">
        <button
          type="button"
          className="ghost"
          disabled={busy}
          onClick={() => void run(() => dismissDuplicate(pair.a.id, pair.b.id))}
        >
          No son el mismo
        </button>
        {state.kind === "error" && (
          <span className="error" role="alert">
            {state.error}
          </span>
        )}
      </div>
    </li>
  );
}

/**
 * One of the two candidates, with the button that keeps it: the side merged
 * into is the one that survives, name and status included.
 */
function PairSide({
  manga,
  busy,
  onRenamed,
  onMergeHere,
}: {
  manga: MangaDto;
  busy: boolean;
  onRenamed: (manga: MangaDto) => void;
  onMergeHere: () => void;
}) {
  return (
    <div className="pair-side">
      {/* Same destination as the name beside it, which carries the name. */}
      <Link
        to={`/manga/${manga.id}`}
        className="pair-cover"
        aria-hidden="true"
        tabIndex={-1}
      >
        <CoverImage
          mangaId={manga.id}
          name={manga.canonicalName}
          coverUrl={manga.coverUrl}
          coverVersion={manga.coverVersion}
        />
      </Link>
      <div className="pair-info">
        <Link to={`/manga/${manga.id}`} className="pair-name">
          {manga.canonicalName}
        </Link>
        <div className="row">
          <button
            type="button"
            className="tonal small"
            disabled={busy}
            onClick={onMergeHere}
          >
            Unir en «{manga.canonicalName}»
          </button>
          <RenameForm
            mangaId={manga.id}
            currentName={manga.canonicalName}
            onRenamed={onRenamed}
          />
        </div>
      </div>
    </div>
  );
}
