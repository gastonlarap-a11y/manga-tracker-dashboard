import { useAtomValue } from "jotai";
import {
  BookOpen,
  BookOpenCheck,
  CalendarCheck,
  Globe,
  type LucideIcon,
} from "lucide-react";
import { librarySummaryAtom } from "../../state/atoms";

const numbers = new Intl.NumberFormat("es");

interface Stat {
  readonly label: string;
  readonly value: number;
  readonly Icon: LucideIcon;
}

/**
 * Totals over the whole library, whatever the grid below is filtered to —
 * counted by the server, which holds the library the browser never does.
 */
export function StatsTiles() {
  const result = useAtomValue(librarySummaryAtom);
  if (!result.ok) {
    return null;
  }
  const summary = result.data;
  const stats: Stat[] = [
    { label: "En lectura", value: summary.counts.reading, Icon: BookOpen },
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
      {stats.map(({ label, value, Icon }) => (
        <li key={label} className="tile stat">
          <span className="stat-icon" aria-hidden="true">
            <Icon />
          </span>
          <span className="stat-value">{numbers.format(value)}</span>
          <span className="stat-label">{label}</span>
        </li>
      ))}
    </ul>
  );
}
