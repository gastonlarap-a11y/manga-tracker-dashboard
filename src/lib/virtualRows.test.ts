import { describe, expect, it } from "vitest";
import { visibleRows } from "./virtualRows";

const base = {
  rowCount: 100,
  rowStride: 300,
  listTop: 600,
  scrollTop: 0,
  viewportHeight: 900,
  overscan: 0,
};

describe("visibleRows", () => {
  it("shows the rows the viewport covers when the list starts below the fold", () => {
    // The list starts at 600; a 900-high viewport reaches 300 into it: row 0
    // and row 1 (which starts at 300).
    expect(visibleRows(base)).toEqual({ first: 0, last: 1 });
  });

  it("follows the scroll, row by row", () => {
    // Scrolled to 3 600: 3 000 into the list, rows 10 to 13.
    expect(visibleRows({ ...base, scrollTop: 3_600 })).toEqual({
      first: 10,
      last: 13,
    });
  });

  it("keeps rows beyond each edge as overscan, never past the ends", () => {
    expect(visibleRows({ ...base, scrollTop: 3_600, overscan: 2 })).toEqual({
      first: 8,
      last: 15,
    });
    expect(visibleRows({ ...base, overscan: 5 })).toEqual({
      first: 0,
      last: 6,
    });
    expect(visibleRows({ ...base, scrollTop: 1_000_000, overscan: 2 })).toEqual(
      { first: 99, last: 99 },
    );
  });

  it("shows every row until a row has been measured", () => {
    expect(visibleRows({ ...base, rowStride: 0 })).toEqual({
      first: 0,
      last: 99,
    });
  });

  it("shows nothing for an empty grid", () => {
    expect(visibleRows({ ...base, rowCount: 0 })).toEqual({
      first: 0,
      last: -1,
    });
  });
});
