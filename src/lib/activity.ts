/**
 * The reading-activity panel, reduced to plain values: which squares the
 * heatmap draws, how the last seven days compare with the seven before, and
 * the current streak.
 *
 * Works on the series exactly as the backend sends it — calendar days of the
 * reader's zone, oldest first, every day present — and takes "today" to be its
 * last day. Nothing here reads the clock, so the panel and its tests agree on
 * what today is by construction.
 */

/** One day of the series. Structural, so this module needs nothing from `api/`. */
export interface DayCount {
  readonly date: string;
  readonly chapters: number;
}

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

/**
 * A square of the heatmap. `chapters` is null for a day the series does not
 * cover: before the window started, or later this week. Those are drawn empty,
 * which is different from a day with nothing read.
 */
export interface HeatCell {
  readonly date: string;
  readonly chapters: number | null;
  readonly level: HeatLevel;
}

export interface ActivitySummary {
  /** Columns oldest first, each one a week from Monday to Sunday. */
  readonly weeks: readonly (readonly HeatCell[])[];
  readonly lastSeven: number;
  readonly previousSeven: number;
  /** Rounded % change against the previous seven days; null with nothing to compare. */
  readonly change: number | null;
  /** Days in a row with a reading, ending today — or yesterday, while today has none yet. */
  readonly streak: number;
  /** The streak runs back to the first day of the data, so it may be longer still. */
  readonly streakReachesStart: boolean;
  /** Most chapters read on one day: what level 4 means. */
  readonly busiest: number;
}

const DAY_MS = 86_400_000;

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** 0 for Monday … 6 for Sunday: weeks start on Monday where this is read. */
function weekdayFromMonday(date: string): number {
  return (new Date(`${date}T00:00:00.000Z`).getUTCDay() + 6) % 7;
}

/**
 * Four steps relative to the reader's own busiest day, so a light reader's
 * heatmap is not a page of near-blank squares measured against someone else.
 */
function levelOf(chapters: number, busiest: number): HeatLevel {
  if (chapters <= 0 || busiest <= 0) {
    return 0;
  }
  // Cast justified: the value is clamped to 1..4 just above.
  return Math.min(
    4,
    Math.max(1, Math.ceil((chapters / busiest) * 4)),
  ) as HeatLevel;
}

function sum(days: readonly DayCount[]): number {
  return days.reduce((total, day) => total + day.chapters, 0);
}

function streakOf(days: readonly DayCount[]): {
  streak: number;
  reachesStart: boolean;
} {
  let index = days.length - 1;
  // Today without a reading yet does not break a streak: the day is not over.
  if (index >= 0 && days[index].chapters === 0) {
    index -= 1;
  }
  let streak = 0;
  while (index >= 0 && days[index].chapters > 0) {
    streak += 1;
    index -= 1;
  }
  return { streak, reachesStart: streak > 0 && index < 0 };
}

export function summarizeActivity(
  days: readonly DayCount[],
  weeks = 12,
): ActivitySummary {
  const busiest = days.reduce((max, day) => Math.max(max, day.chapters), 0);
  const { streak, reachesStart } = streakOf(days);
  const lastSeven = sum(days.slice(-7));
  const previousSeven = sum(days.slice(-14, -7));
  const today = days.at(-1)?.date;

  const columns: HeatCell[][] = [];
  if (today !== undefined) {
    const byDate = new Map(days.map((day) => [day.date, day.chapters]));
    const lastSunday = addDays(today, 6 - weekdayFromMonday(today));
    const firstMonday = addDays(lastSunday, -(weeks * 7 - 1));
    for (let week = 0; week < weeks; week += 1) {
      const column: HeatCell[] = [];
      for (let weekday = 0; weekday < 7; weekday += 1) {
        const date = addDays(firstMonday, week * 7 + weekday);
        const chapters = byDate.get(date) ?? null;
        column.push({
          date,
          chapters,
          level: chapters === null ? 0 : levelOf(chapters, busiest),
        });
      }
      columns.push(column);
    }
  }

  return {
    weeks: columns,
    lastSeven,
    previousSeven,
    change:
      previousSeven === 0
        ? null
        : Math.round(((lastSeven - previousSeven) / previousSeven) * 100),
    streak,
    streakReachesStart: reachesStart,
    busiest,
  };
}
