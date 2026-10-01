import { describe, expect, it } from "vitest";
import {
  dayLabel,
  formatCalendarDay,
  formatDate,
  formatTime,
  groupByDay,
  relativeDate,
} from "./dates";

const NOW = new Date("2026-07-16T12:00:00Z");

describe("relativeDate", () => {
  it.each([
    ["2026-07-16T11:59:40Z", "hace un momento"],
    ["2026-07-16T11:55:00Z", "hace 5 minutos"],
    ["2026-07-16T09:00:00Z", "hace 3 horas"],
    ["2026-07-13T12:00:00Z", "hace 3 días"],
    ["2026-06-29T12:00:00Z", "hace 2 semanas"],
    ["2026-04-16T12:00:00Z", "hace 3 meses"],
  ])("formats %s as %s", (iso, expected) => {
    expect(relativeDate(iso, NOW)).toBe(expected);
  });
});

describe("formatDate", () => {
  it("produces an absolute date with the year", () => {
    expect(formatDate("2026-07-16T09:00:00Z")).toContain("2026");
  });
});

// Built from local date parts, so these hold in whatever zone the suite runs.
const local = (...parts: [number, number, number, number?, number?]) =>
  new Date(parts[0], parts[1] - 1, parts[2], parts[3] ?? 12, parts[4] ?? 0);
const TODAY = local(2026, 10, 1, 9);

describe("dayLabel", () => {
  it.each([
    [local(2026, 10, 1, 0, 5), "Hoy"],
    [local(2026, 9, 30, 23, 50), "Ayer"],
    [local(2026, 9, 28), "Lunes"],
  ])("labels %s as %s", (date, expected) => {
    expect(dayLabel(date.toISOString(), TODAY)).toBe(expected);
  });

  it("names the date, without the year while it is this one", () => {
    expect(dayLabel(local(2026, 9, 12).toISOString(), TODAY)).toBe(
      "12 de septiembre",
    );
    expect(dayLabel(local(2025, 12, 31).toISOString(), TODAY)).toContain(
      "2025",
    );
  });
});

describe("groupByDay", () => {
  it("keeps readings of one local day together, newest group first", () => {
    const readings = [
      { id: "a", readAt: local(2026, 10, 1, 8).toISOString() },
      { id: "b", readAt: local(2026, 10, 1, 1).toISOString() },
      { id: "c", readAt: local(2026, 9, 30, 23).toISOString() },
    ];

    const groups = groupByDay(readings, TODAY);

    expect(groups.map((group) => group.label)).toEqual(["Hoy", "Ayer"]);
    expect(groups[0]?.items.map((item) => item.id)).toEqual(["a", "b"]);
    expect(groups[0]?.key).toBe("2026-10-01");
  });
});

describe("formatCalendarDay", () => {
  it("keeps the day it was given, whatever the zone the suite runs in", () => {
    // 2026-10-01 is a Thursday; read as local midnight west of UTC it would
    // become Wednesday the 30th.
    const label = formatCalendarDay("2026-10-01");

    expect(label).toContain("1");
    expect(label).toMatch(/jue/i);
  });
});

describe("formatTime", () => {
  it("shows the hour and minutes", () => {
    expect(formatTime(local(2026, 10, 1, 14, 5).toISOString())).toMatch(
      /14:05/,
    );
  });
});
