import { describe, expect, it } from "vitest";
import { STATUS_NAMES, STATUSES } from "./statusNames";

describe("STATUSES", () => {
  it("lists every status once, in the order the tabs and the picker show", () => {
    expect(STATUSES).toEqual(["reading", "on_hold", "completed", "dropped"]);
  });

  it("names a paused series the same on a card and on its tab", () => {
    expect(STATUS_NAMES.on_hold).toEqual({ one: "En pausa", many: "En pausa" });
  });
});
