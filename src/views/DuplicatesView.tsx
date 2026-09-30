import { useAtomValue, useSetAtom } from "jotai";
import { Suspense, useState } from "react";
import { Link } from "react-router";
import { dismissDuplicate, mergeMangas } from "../api/client";
import type { DuplicatePairDto, MangaDto } from "../api/types";
import { RenameForm } from "../components/RenameForm";
import { baseLibraryAtom, duplicatesAtom, libraryAtom } from "../state/atoms";

const REASON_LABELS: Record<string, string> = {
  tokens: "palabras casi iguales",
  "edit-distance": "títulos casi idénticos",
  containment: "uno contiene al otro",
  cover: "misma portada",
};

export function DuplicatesView() {
  return (
    <section>
      <div className="view-head">
        <h1>Duplicados</h1>
      </div>
      <p className="meta">
        Series que parecen estar dos veces en la biblioteca. Al unirlas queda
        una sola tarjeta con el historial de ambas: no se borra ni se mueve
        ninguna lectura, y se puede deshacer desde el detalle del manga.
      </p>
      <Suspense fallback={<p className="status">Buscando duplicados…</p>}>
        <DuplicatesList />
      </Suspense>
    </section>
  );
}

function DuplicatesList() {
  const result = useAtomValue(duplicatesAtom);
  const refreshDuplicates = useSetAtom(duplicatesAtom);
  const refreshLibrary = useSetAtom(libraryAtom);
  const refreshBase = useSetAtom(baseLibraryAtom);

  function refreshAll(): void {
    refreshDuplicates();
    refreshLibrary();
    refreshBase();
  }

  if (!result.ok) {
    return (
      <p className="status error">
        No se pudieron cargar los duplicados: {result.error}
      </p>
    );
  }
  if (result.data.length === 0) {
    return <p className="status">Sin duplicados sospechosos.</p>;
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

  const reasons = pair.reasons
    .map((reason) => REASON_LABELS[reason] ?? reason)
    .join(" · ");

  return (
    <li className="pair">
      <span className="similarity">{Math.round(pair.similarity * 100)} %</span>
      <PairSide manga={pair.a} onRenamed={onResolved} />
      <PairSide manga={pair.b} onRenamed={onResolved} />
      <div className="pair-actions">
        {reasons && <span className="meta">{reasons}</span>}
        {pair.sequelSuspicion && (
          <span className="warning">
            Puede ser una temporada o spin-off, no la misma obra.
          </span>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => mergeMangas(pair.a.id, pair.b.id))}
        >
          Unir en «{pair.a.canonicalName}»
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => mergeMangas(pair.b.id, pair.a.id))}
        >
          Unir en «{pair.b.canonicalName}»
        </button>
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

function PairSide({
  manga,
  onRenamed,
}: {
  manga: MangaDto;
  onRenamed: (manga: MangaDto) => void;
}) {
  return (
    <div className="pair-side">
      <Link to={`/manga/${manga.id}`}>{manga.canonicalName}</Link>
      <RenameForm
        mangaId={manga.id}
        currentName={manga.canonicalName}
        onRenamed={onRenamed}
      />
    </div>
  );
}
