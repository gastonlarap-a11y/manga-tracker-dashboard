import type { MouseEvent } from "react";

const NAMED = "vt-cover";

/**
 * Names the cover being opened, so the view transition into its detail page
 * morphs it into the cover there (which carries the same name in CSS).
 *
 * Named on click rather than up front: a view transition snapshots every
 * named element on both pages, and a grid of a hundred covers each with its own
 * name would be a hundred snapshots to open one. Only one element may carry a
 * name at a time, so any earlier one — a click that opened a new tab instead —
 * is cleared first.
 */
export function markCoverForTransition(event: MouseEvent<HTMLElement>): void {
  // The same test react-router applies before navigating in place: a modified
  // or middle click does not navigate this page, so nothing should morph.
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.altKey ||
    event.ctrlKey ||
    event.shiftKey
  ) {
    return;
  }
  for (const other of document.querySelectorAll(`.${NAMED}`)) {
    other.classList.remove(NAMED);
  }
  const cover = event.currentTarget
    .closest("[data-cover-root]")
    ?.querySelector(".cover");
  cover?.classList.add(NAMED);
}
