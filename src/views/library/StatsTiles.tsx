import { useAtomValue } from "jotai";
import {
  BookOpen,
  BookOpenCheck,
  CalendarCheck,
  Globe,
  type LucideIcon,
} from "lucide-react";
import { baseLibraryAtom } from "../../state/atoms";

const DAY_MS = 86_400_000;
const numbers = new Intl.NumberFormat("es");

interface Stat {
  readonly label: string;
  readonly value: number;
  readonly Icon: LucideIcon;
}

/** Totals over the whole library, whatever the grid below is filtered to. */
export function StatsTiles() {
  const result = useAtomValue(baseLibraryAtom);
  if (!result.ok) {
    return null;
  }
  const entries = result.data;
  const weekAgo = Date.now() - 7 * DAY_MS;
  const stats: Stat[] = [
    {
      label: "En lectura",
      value: entries.filter((entry) => entry.status === "reading").length,
      Icon: BookOpen,
    },
    {
      label: "Capítulos leídos",
      value: entries.reduce((sum, entry) => sum + entry.readCount, 0),
      Icon: BookOpenCheck,
    },
    {
      label: "Sitios",
      value: new Set(entries.flatMap((entry) => entry.sourceDomains)).size,
      Icon: Globe,
    },
    {
      label: "Activos esta semana",
      value: entries.filter(
        (entry) =>
          entry.lastActivity &&
          new Date(entry.lastActivity.readAt).getTime() >= weekAgo,
      ).length,
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
