/**
 * How long a series in reading goes unread before the follow-up list shows
 * it, as the select offers it. The label reads after "sin leer hace más de".
 */
export const STALE_WINDOWS: readonly {
  readonly days: number;
  readonly label: string;
}[] = [
  { days: 14, label: "2 semanas" },
  { days: 30, label: "un mes" },
  { days: 90, label: "3 meses" },
  { days: 180, label: "6 meses" },
  { days: 365, label: "un año" },
];

/** "3 meses", for "sin leer hace más de 3 meses". */
export function staleWindowLabel(days: number): string {
  return (
    STALE_WINDOWS.find((window) => window.days === days)?.label ??
    `${days} días`
  );
}
