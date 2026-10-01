import { describe, expect, it } from "vitest";
import { type DayCount, summarizeActivity } from "./activity";

/** Consecutive days ending on `last`, with the given chapter counts. */
function series(last: string, counts: number[]): DayCount[] {
  const end = Date.parse(`${last}T00:00:00.000Z`);
  return counts.map((chapters, index) => ({
    date: new Date(end - (counts.length - 1 - index) * 86_400_000)
      .toISOString()
      .slice(0, 10),
    chapters,
  }));
}

describe("summarizeActivity", () => {
  it("compares the last seven days with the seven before", () => {
    const summary = summarizeActivity(
      series("2026-10-01", [1, 1, 1, 1, 1, 1, 4, 2, 2, 2, 2, 2, 2, 2]),
    );

    expect(summary.previousSeven).toBe(10);
    expect(summary.lastSeven).toBe(14);
    expect(summary.change).toBe(40);
  });

  it("has nothing to compare against when the previous week is empty", () => {
    const summary = summarizeActivity(
      series("2026-10-01", [0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 1]),
    );

    expect(summary.change).toBeNull();
    expect(summary.lastSeven).toBe(4);
  });

  it("does not break the streak on a today with nothing read yet", () => {
    expect(
      summarizeActivity(series("2026-10-01", [0, 2, 1, 3, 0])).streak,
    ).toBe(3);
    expect(summarizeActivity(series("2026-10-01", [2, 0, 0])).streak).toBe(0);
  });

  it("says when the streak runs back past the start of the data", () => {
    const summary = summarizeActivity(series("2026-10-01", [1, 1, 1]));

    expect(summary.streak).toBe(3);
    expect(summary.streakReachesStart).toBe(true);
  });

  it("lays the weeks out Monday to Sunday, ending with the week of today", () => {
    // 2026-10-01 is a Thursday.
    const summary = summarizeActivity(
      series("2026-10-01", Array(84).fill(1)),
      12,
    );

    expect(summary.weeks).toHaveLength(12);
    const lastWeek = summary.weeks.at(-1) ?? [];
    expect(lastWeek.map((cell) => cell.date)).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
    // Friday to Sunday have not happened: empty, which is not "nothing read".
    expect(lastWeek.slice(4).every((cell) => cell.chapters === null)).toBe(
      true,
    );
    expect(lastWeek[3]?.chapters).toBe(1);
  });

  it("grades each day against the reader's own busiest one", () => {
    const summary = summarizeActivity(series("2026-10-04", [0, 1, 2, 3, 8]));
    const levels = (summary.weeks.at(-1) ?? []).map((cell) => cell.level);

    expect(summary.busiest).toBe(8);
    // Thu..Sun of that week carry 1, 2, 3 and 8 chapters; Wed had none.
    expect(levels.slice(2)).toEqual([0, 1, 1, 2, 4]);
  });

  it("returns an empty heatmap for an empty series", () => {
    const summary = summarizeActivity([]);

    expect(summary.weeks).toEqual([]);
    expect(summary.streak).toBe(0);
    expect(summary.change).toBeNull();
  });
});
