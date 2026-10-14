import { useAtomValue } from "jotai";
import {
  BookOpen,
  BookOpenCheck,
  CalendarCheck,
  Globe,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { librarySummaryAtom, staleDaysAtom } from "../../state/atoms";
import { staleWindowLabel } from "../follow-up/staleWindows";

const numbers = new Intl.NumberFormat("es");

interface Stat {
  readonly label: string;
  readonly value: number;
  readonly Icon: LucideIcon;
  /** A line under the label, for what the number leads to. */
  readonly more?: ReactNode;
}

/**
 * Totals over the whole library, whatever the grid below is filtered to —
 * counted by the server, which holds the library the browser never does.
 */
export function StatsTiles() {
  const result = useAtomValue(librarySummaryAtom);
  const staleDays = useAtomValue(staleDaysAtom);
  if (!result.ok) {
    return null;
  }
  const summary = result.data;
  const stale = summary.stale ?? 0;
  const stats: Stat[] = [
    {
      label: "En lectura",
      value: summary.counts.reading,
      Icon: BookOpen,
      // Of the ones in reading, how many went quiet: the way into Seguimiento.
      more:
        stale > 0 ? (
          <Link className="stat-link" to="/follow-up">
            {numbers.format(stale)} sin leer hace más de{" "}
            {staleWindowLabel(staleDays)}
          </Link>
        ) : undefined,
    },
    { label: "Capítulos leídos", value: summary.chapters, Icon: BookOpenCheck },
    { label: "Sitios", value: summary.sites, Icon: Globe },
    {
      label: "Activos esta semana",
      value: summary.activeThisWeek,
      Icon: CalendarCheck,
    },
  ];

  return (
    <ul className="stats bento-stats" aria-label="Resumen de la biblioteca">
      {stats.map(({ label, value, Icon, more }) => (
        <li key={label} className="tile stat">
          <span className="stat-icon" aria-hidden="true">
            <Icon />
          </span>
          <span className="stat-value">{numbers.format(value)}</span>
          <span className="stat-label">{label}</span>
          {more}
        </li>
      ))}
    </ul>
  );
}
