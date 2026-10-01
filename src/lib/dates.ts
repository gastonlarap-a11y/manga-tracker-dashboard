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

const timeFormatter = new Intl.DateTimeFormat("es", {
  hour: "2-digit",
  minute: "2-digit",
});
const weekdayFormatter = new Intl.DateTimeFormat("es", { weekday: "long" });
const dayMonthFormatter = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "long",
});
const dayMonthYearFormatter = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

const calendarDayFormatter = new Intl.DateTimeFormat("es", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/**
 * A `YYYY-MM-DD` the backend counted in the reader's zone, written for people.
 * It names a day, not an instant, so it is read and written in UTC: converting
 * it to the local zone would move it to the evening before west of Greenwich.
 */
export function formatCalendarDay(day: string): string {
  return calendarDayFormatter.format(new Date(`${day}T00:00:00.000Z`));
}

/**
 * Whole calendar days from `earlier` to `later` in this browser's zone. Built
 * from the local date parts rather than by dividing milliseconds, which is off
 * by one on the night a clock changes.
 */
function calendarDaysBetween(earlier: Date, later: Date): number {
  const from = Date.UTC(
    earlier.getFullYear(),
    earlier.getMonth(),
    earlier.getDate(),
  );
  const to = Date.UTC(later.getFullYear(), later.getMonth(), later.getDate());
  return Math.round((to - from) / 86_400_000);
}

function localDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * How a day heads a group of readings: "Hoy", "Ayer", the weekday within the
 * last week, then the date — with the year only once it is not this one.
 */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const days = calendarDaysBetween(date, now);
  if (days === 0) {
    return "Hoy";
  }
  if (days === 1) {
    return "Ayer";
  }
  if (days > 1 && days < 7) {
    const weekday = weekdayFormatter.format(date);
    return weekday.charAt(0).toUpperCase() + weekday.slice(1);
  }
  return date.getFullYear() === now.getFullYear()
    ? dayMonthFormatter.format(date)
    : dayMonthYearFormatter.format(date);
}

export interface DayGroup<T> {
  /** The local calendar day, `YYYY-MM-DD`: stable as a React key. */
  readonly key: string;
  readonly label: string;
  readonly items: readonly T[];
}

/**
 * Consecutive readings of the same local day, in the order given. The history
 * arrives newest first, so the groups come out newest first too.
 */
export function groupByDay<T extends { readonly readAt: string }>(
  items: readonly T[],
  now: Date = new Date(),
): DayGroup<T>[] {
  const groups: { key: string; label: string; items: T[] }[] = [];
  for (const item of items) {
    const key = localDayKey(new Date(item.readAt));
    const current = groups.at(-1);
    if (current?.key === key) {
      current.items.push(item);
    } else {
      groups.push({ key, label: dayLabel(item.readAt, now), items: [item] });
    }
  }
  return groups;
}
