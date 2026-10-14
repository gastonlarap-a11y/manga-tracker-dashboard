import type { MangaStatus } from "../api/types";

/**
 * How each status is called on screen: `one` for a card or a choice
 * ("Terminado"), `many` for a tab that lists them ("Terminados").
 *
 * One Record for the whole app because the lists of statuses used to be three
 * arrays, two of which would have left out a new status without a word from
 * the compiler. Keyed by MangaStatus, the next status is a type error here and
 * nowhere else; the order written is the order shown.
 */
export const STATUS_NAMES: Record<
  MangaStatus,
  { readonly one: string; readonly many: string }
> = {
  reading: { one: "Leyendo", many: "Leyendo" },
  on_hold: { one: "En pausa", many: "En pausa" },
  completed: { one: "Terminado", many: "Terminados" },
  dropped: { one: "Abandonado", many: "Abandonados" },
};

// Cast justified: the keys of a Record<MangaStatus, …> literal are exactly the
// MangaStatus values, and Object.keys keeps the order they were written in.
export const STATUSES = Object.keys(STATUS_NAMES) as MangaStatus[];
