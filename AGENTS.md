# manga-tracker-dashboard

Web dashboard of the local-first manga tracker. React 19 + Jotai + Vite + react-router,
Bun as package manager. Consumes `manga-tracker-api` and is served BY that API same-origin
in production (`bun run deploy` copies `dist/` to `../manga-tracker-api/public/`).
Sibling repos: `../manga-tracker-api` (its PLAN.md is the shared roadmap) and
`../manga-tracker-extension`.

## Layout
- `src/api/` — backend contract: `types.ts` (hand-duplicated DTOs) + `client.ts`
  (`ApiResult<T>` fetch wrapper; relative paths, same-origin)
- `src/state/atoms.ts` — Jotai: the grid's query (sort, status tab, search, site, period,
  tags — **all applied by the server**), `atomWithRefresh` data atoms (the summary behind the
  stats, counts and filter options; the continue-reading page; activity; duplicates; sync),
  `libraryRevisionAtom` and `refreshLibraryAtom`, the one action every mutation calls
- `src/state/libraryPages.ts` — the grid's pages, in the store: a new query reads its first
  page, a new revision re-reads every card already held, the newest request always wins
- `src/App.tsx` — a **data router** (`createBrowserRouter`, `RouterProvider` from
  `react-router/dom`): `viewTransition` links and `<ScrollRestoration>` exist only there.
  The library is passed to `Layout`, which keeps it alive (see Rules); its route is empty
- `src/views/` — one component per route (`/`, `/manga/:id`, `/duplicates`) with
  colocated `*.test.tsx`, and their parts beside them: `views/library/` (the overview bento
  — continue reading, activity, stats — the floating toolbar and the 2:3 cover grid),
  `views/detail/` (the history grouped by day)
- `src/lib/embed.ts` — the bridge for when the desktop app shows this page in a frame:
  after the app's greeting, external links are posted up instead of opened (Wails
  implements no new-window handler), the greeting is answered with `embed-ready`, and an
  `embedStore` tells components whether they are embedded (the settings button) and whether
  the window is translucent. Inert in a normal tab. Not an access check.
- `src/lib/activity.ts` — the activity panel as plain values (heatmap squares, last seven
  days against the seven before, streak), from `GET /api/library/activity`; "today" is the
  series' last day, never the clock
- `src/components/` — `Layout` (the one glass bar: nav, connection and sync badges —
  `SyncBadge` is also the "sync now" button — and, embedded, the app's settings), `LiveRefresh` (SSE
  `/api/events/stream` → refreshes every data atom on events, on (re)open and on the
  tab becoming visible; owns `liveStatusAtom`), `ConnectionBadge` (shows the real
  stream state, no polling), `CoverImage` (cover with deterministic gradient
  fallback, and `AmbientCover`, the same cover blurred into a backdrop), `RenameForm`,
  `Skeleton`, `EmbedChrome`, `coverTransition` (names the clicked cover for the morph)
- `src/styles/` — `tokens.css` (every colour, radius and duration, both themes) and one
  file per area; `main.tsx` imports them in order
- `src/lib/` — pure utilities with colocated tests; `virtualRows.ts` is which rows of the
  grid are in the page for a given scroll
- `src/test-utils.tsx` — async `renderWithProviders` (jotai store + MemoryRouter) —
  see Rules. `Layout` needs a data router, so its test builds one (`createMemoryRouter`).
  `fakeLibraryApi` answers the library endpoints as the API does (filtered, searched,
  ordered, paged) over cards in memory

## Commands
- Dev: `bun run dev` (vite :5173, proxies `/api`+`/health` → :5150)
- Build: `bun run build` · Deploy: `bun run deploy` (build + copy to API `public/`)
- Test: `bun run test` (vitest, not `bun test`) · Single: `bunx vitest run <file>`. Vitest runs
  on **Node ≥ 22.12** (Vitest 5 and Jotai 3 require it; CI pins Node 24), not on Bun
- Lint: `bun run lint` · Format: `bun run format` · Typecheck: `bun run typecheck`

## Rules
- **Contract duplication**: `src/api/types.ts` mirrors the API's Zod schemas by hand.
  A contract change in `manga-tracker-api` updates this file in the same commit.
- All fetching goes through `src/api/client.ts` (`ApiResult<T>`, never throws); UI paths
  are relative so dev proxy and same-origin production behave identically.
- Dependency direction: `views` → `components`/`state` → `api` → `lib`; `src/api` and
  `src/lib` never import app code.
- Shared/cross-view state lives in Jotai atoms; state local to one view stays in the
  component (discriminated-union state, no flag booleans).
- Rename fixes only `canonicalName`. Merging two cards (`/api/duplicates/merge`) groups them
  without rewriting a single event — events stay append-only — and unmerge undoes it.
  Nothing merges automatically: a wrong merge is worse than a duplicate the user can join.
- Reading status and tags are MANUAL (chapter pages cannot declare genres reliably);
  deletes require explicit confirmation and are the only destructive action.
- Tests: components that read async atoms suspend — always render through the async
  `renderWithProviders` and wrap suspense-triggering interactions in `actAsync`
  (React 19 requires awaited `act` for suspended trees). The hero and the recents repeat
  titles the grid also shows, so grid assertions go `within` the list named "Mangas".
- **A refresh while the page is on screen goes inside `startTransition`** (`LiveRefresh`,
  `SyncBadge`, `DuplicatesView`). Outside one, refreshing an async atom suspends the view
  back to its Suspense fallback: the whole grid unmounted, every cover reloaded and every
  card replayed its entrance, once per chapter read in another tab. Inside one, React keeps
  what is on screen until the new data is there (Jotai notifies from the setter, so the
  re-render belongs to the transition). Only a first load shows a skeleton.
- **The browser never holds the whole library.** It used to: every visit fetched every card,
  and search, tabs, tags and order ran in memory — fine at a hundred, megabytes and a frozen
  tab at ten thousand. The grid reads `GET /api/library/page` a page at a time (keyset
  cursors, filters and search on the server), the stats, tab counts and filter options come
  from `GET /api/library/summary`, the hero from its own short page. Nothing calls
  `/api/library`; a test says so. A new filter is a server parameter, not a `.filter()`.
- **Only the rows near the window are in the page.** The grid pads above and below for the
  rest (`lib/virtualRows.ts`), which is a division and not a measurement because every card
  has the same height: the 2:3 cover, a title box of two lines, one line of meta. A card
  that could grow taller breaks the grid's arithmetic — keep it the same height. The column
  count and a card's height are read from the CSS as resolved, so `library.css` alone
  decides the shape. No `content-visibility` on cards: an off-screen card reports its
  placeholder size.
- **The library stays mounted behind the other pages** (`<Activity>` in `Layout`). Coming
  back from Duplicados or a manga used to rebuild it — every page fetched again, every cover
  decoded again, a view transition delaying it all. Now it is shown as it was left, and
  `ScrollRestoration` remembers its position by path, so the bar and the back link restore it
  too, not only the browser's back. `viewTransition` is kept only for the cover morph from a
  card into its page, never between sections.
- **Glass is the navigation layer, never the content** (Apple's own rule for Liquid Glass):
  the bar, the floating toolbar, pills over covers. Tiles, cards and the history are solid
  surfaces, and glass never stacks on glass.
- **Colour comes from tokens, themes from `prefers-color-scheme`.** Every colour is a custom
  property in `styles/tokens.css`, redefined for light — not `light-dark()`, which WebKit
  before 17.5 does not know, leaving an older macOS with no colours at all. A new colour is
  a new token in both themes, checked for AA contrast where text sits on it.
- **New CSS is an enhancement, never a requirement.** Scroll-driven animations, container
  queries and view transitions are used where they exist, and the page is complete without
  them; reduced motion collapses the duration tokens and switches keyframes off where they
  are defined (no `!important`).
- UI strings are Spanish; code, identifiers and comments are English.

## Engineering standards
- Every feature ships with its tests. Run `bun run lint` + `bun run typecheck` +
  `bun run test` before declaring work done; report real results.
- No speculative abstractions; this is a small read-mostly UI.
