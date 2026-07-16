import { useAtom, useAtomValue } from "jotai";
import { unwrap } from "jotai/utils";
import { Suspense } from "react";
import { Link } from "react-router";
import { relativeDate } from "../lib/dates";
import {
  domainFilterAtom,
  knownDomainsAtom,
  libraryAtom,
  sinceDaysAtom,
} from "../state/atoms";

const SINCE_OPTIONS = [
  { label: "Todo", days: null },
  { label: "Última semana", days: 7 },
  { label: "Último mes", days: 30 },
  { label: "Últimos 3 meses", days: 90 },
];

// unwrap() keeps the filter bar from suspending: empty options while loading.
const domainOptionsAtom = unwrap(
  knownDomainsAtom,
  (previous) => previous ?? [],
);

export function LibraryView() {
  return (
    <section>
      <div className="view-head">
        <h1>Biblioteca</h1>
        <LibraryFilters />
      </div>
      <Suspense fallback={<p className="status">Cargando biblioteca…</p>}>
        <LibraryTable />
      </Suspense>
    </section>
  );
}

function LibraryFilters() {
  const [domain, setDomain] = useAtom(domainFilterAtom);
  const [sinceDays, setSinceDays] = useAtom(sinceDaysAtom);
  const domainOptions = useAtomValue(domainOptionsAtom);

  return (
    <div className="filters">
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
    </div>
  );
}

function LibraryTable() {
  const result = useAtomValue(libraryAtom);

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

  return (
    <table>
      <thead>
        <tr>
          <th>Manga</th>
          <th>Capítulo alcanzado</th>
          <th>Última lectura</th>
          <th className="num">Lecturas</th>
          <th>Sitios</th>
        </tr>
      </thead>
      <tbody>
        {result.data.map((entry) => (
          <tr key={entry.id}>
            <td>
              <Link to={`/manga/${entry.id}`}>{entry.canonicalName}</Link>
            </td>
            <td>{entry.reachedChapter?.label ?? "—"}</td>
            <td>
              {entry.lastActivity
                ? relativeDate(entry.lastActivity.readAt)
                : "—"}
            </td>
            <td className="num">{entry.readCount}</td>
            <td>
              {entry.sourceDomains.map((sourceDomain) => (
                <span key={sourceDomain} className="chip">
                  {sourceDomain}
                </span>
              ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
