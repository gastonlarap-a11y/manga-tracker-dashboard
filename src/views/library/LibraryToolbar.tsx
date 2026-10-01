import { useAtom, useAtomValue } from "jotai";
import { unwrap } from "jotai/utils";
import { Search } from "lucide-react";
import {
  domainFilterAtom,
  knownDomainsAtom,
  knownTagsAtom,
  type LibrarySort,
  type StatusTab,
  searchAtom,
  sinceDaysAtom,
  sortAtom,
  statusCountsAtom,
  statusTabAtom,
  tagFilterAtom,
} from "../../state/atoms";

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

const SORTS: { value: LibrarySort; label: string }[] = [
  { value: "recent", label: "Recientes" },
  { value: "title", label: "A–Z" },
  { value: "chapters", label: "Más capítulos" },
];

// unwrap() keeps the toolbar from suspending: empty options while loading.
const domainOptionsAtom = unwrap(
  knownDomainsAtom,
  (previous) => previous ?? [],
);
const tagOptionsAtom = unwrap(knownTagsAtom, (previous) => previous ?? []);
const countsAtom = unwrap(statusCountsAtom, (previous) => previous ?? null);

function isSort(value: string): value is LibrarySort {
  return SORTS.some((sort) => sort.value === value);
}

/**
 * Search, the status tabs and the filters. Floats above the grid while it
 * scrolls, so narrowing the library never means scrolling back up to do it.
 */
export function LibraryToolbar() {
  const [search, setSearch] = useAtom(searchAtom);
  const [statusTab, setStatusTab] = useAtom(statusTabAtom);
  const [domain, setDomain] = useAtom(domainFilterAtom);
  const [sinceDays, setSinceDays] = useAtom(sinceDaysAtom);
  const [tagFilter, setTagFilter] = useAtom(tagFilterAtom);
  const [sort, setSort] = useAtom(sortAtom);
  const domainOptions = useAtomValue(domainOptionsAtom);
  const tagOptions = useAtomValue(tagOptionsAtom);
  const counts = useAtomValue(countsAtom);

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
        <label className="search">
          <Search aria-hidden="true" />
          <input
            type="search"
            placeholder="Buscar manga…"
            aria-label="Buscar"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
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
              {/* The space is for the accessible name ("Leyendo 1", not
                  "Leyendo1"); the gap already spaces it on screen. */}
              {counts !== null && (
                <>
                  {" "}
                  <span className="count">{counts[tab.value]}</span>
                </>
              )}
            </button>
          ))}
        </div>
        <div className="toolbar-filters">
          <label className="select">
            <span>Sitio</span>
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
          <label className="select">
            <span>Período</span>
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
          <label className="select">
            <span>Orden</span>
            <select
              value={sort}
              onChange={(event) => {
                if (isSort(event.target.value)) {
                  setSort(event.target.value);
                }
              }}
            >
              {SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
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
  );
}
