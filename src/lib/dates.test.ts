import { describe, expect, it } from "vitest";
import { formatDate, relativeDate } from "./dates";

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
