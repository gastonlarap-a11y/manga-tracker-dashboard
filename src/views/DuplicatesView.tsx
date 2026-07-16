import { useAtomValue, useSetAtom } from "jotai";
import { Suspense } from "react";
import { Link } from "react-router";
import type { MangaDto } from "../api/types";
import { RenameForm } from "../components/RenameForm";
import { duplicatesAtom, libraryAtom } from "../state/atoms";

export function DuplicatesView() {
  return (
    <section>
      <div className="view-head">
        <h1>Duplicados</h1>
      </div>
      <p className="meta">
        Pares con nombres muy parecidos. El merge automático no existe a
        propósito (los eventos son append-only): corregí el nombre visible del
        que esté mal.
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

  function handleRenamed(_manga: MangaDto): void {
    refreshDuplicates();
    refreshLibrary();
  }

  return (
    <ul className="pairs">
      {result.data.map((pair) => (
        <li key={`${pair.a.id}:${pair.b.id}`} className="pair">
          <span className="similarity">
            {Math.round(pair.similarity * 100)} %
          </span>
          <div className="pair-side">
            <Link to={`/manga/${pair.a.id}`}>{pair.a.canonicalName}</Link>
            <RenameForm
              mangaId={pair.a.id}
              currentName={pair.a.canonicalName}
              onRenamed={handleRenamed}
            />
          </div>
          <div className="pair-side">
            <Link to={`/manga/${pair.b.id}`}>{pair.b.canonicalName}</Link>
            <RenameForm
              mangaId={pair.b.id}
              currentName={pair.b.canonicalName}
              onRenamed={handleRenamed}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
