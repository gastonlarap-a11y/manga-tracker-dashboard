/**
 * Which rows of a grid of equal-height rows to put in the page, given where
 * the window has scrolled to. The grid holds as many cards as were loaded —
 * thousands, in a large library — and only the rows near the viewport exist
 * in the DOM; the rest are padding of the right height.
 *
 * Equal heights are what make this a division instead of a measurement per
 * row: every card has the same cover ratio and a title box sized for two
 * lines, so one card's height is every card's.
 */
export interface RowWindowInput {
  readonly rowCount: number;
  /** One row's height plus the gap below it; 0 until it has been measured. */
  readonly rowStride: number;
  /** Where the first row starts, in page coordinates. */
  readonly listTop: number;
  readonly scrollTop: number;
  readonly viewportHeight: number;
  /** Rows kept beyond each edge of the viewport, so a fast scroll finds them. */
  readonly overscan: number;
}

/** Rows `first` to `last`, inclusive; empty when `last < first`. */
export interface RowWindow {
  readonly first: number;
  readonly last: number;
}

export function visibleRows({
  rowCount,
  rowStride,
  listTop,
  scrollTop,
  viewportHeight,
  overscan,
}: RowWindowInput): RowWindow {
  if (rowCount === 0) {
    return { first: 0, last: -1 };
  }
  // Not measured yet (the first render, or a document without layout): every
  // row, so nothing is missing while the measurement is taken.
  if (rowStride <= 0) {
    return { first: 0, last: rowCount - 1 };
  }
  const top = scrollTop - listTop;
  const first = clamp(Math.floor(top / rowStride) - overscan, 0, rowCount - 1);
  const last = clamp(
    Math.floor((top + viewportHeight) / rowStride) + overscan,
    first,
    rowCount - 1,
  );
  return { first, last };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
