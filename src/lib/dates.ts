const RELATIVE_UNITS: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
  { unit: "year", ms: 365 * 24 * 3_600_000 },
  { unit: "month", ms: 30 * 24 * 3_600_000 },
  { unit: "week", ms: 7 * 24 * 3_600_000 },
  { unit: "day", ms: 24 * 3_600_000 },
  { unit: "hour", ms: 3_600_000 },
  { unit: "minute", ms: 60_000 },
];

const relativeFormatter = new Intl.RelativeTimeFormat("es", {
  numeric: "auto",
});

const absoluteFormatter = new Intl.DateTimeFormat("es", {
  dateStyle: "medium",
  timeStyle: "short",
});

// `now` is injectable so tests stay deterministic.
export function relativeDate(iso: string, now: Date = new Date()): string {
  const elapsed = new Date(iso).getTime() - now.getTime();
  for (const { unit, ms } of RELATIVE_UNITS) {
    if (Math.abs(elapsed) >= ms) {
      return relativeFormatter.format(Math.trunc(elapsed / ms), unit);
    }
  }
  return "hace un momento";
}

export function formatDate(iso: string): string {
  return absoluteFormatter.format(new Date(iso));
}
