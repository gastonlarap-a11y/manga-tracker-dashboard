# manga-tracker-dashboard

Web dashboard of the local-first manga tracker. React 19 + Jotai + Vite + react-router,
Bun as package manager. Consumes `manga-tracker-api` and is served BY that API same-origin
in production (`bun run deploy` copies `dist/` to `../manga-tracker-api/public/`).
Sibling repos: `../manga-tracker-api` (its PLAN.md is the shared roadmap) and
`../manga-tracker-extension`.

## Layout
- `src/api/` — backend contract: `types.ts` (hand-duplicated DTOs) + `client.ts`
  (`ApiResult<T>` fetch wrapper; relative paths, same-origin)
- `src/state/atoms.ts` — Jotai: server filters (domain/since → refetch), client filters
  (search/status tab/tags → filter in memory), `atomWithRefresh` data atoms and the
  unfiltered `baseLibraryAtom` snapshot (stats + select/chip options)
- `src/App.tsx` — a **data router** (`createBrowserRouter`, `RouterProvider` from
  `react-router/dom`): `viewTransition` links and `<ScrollRestoration>` exist only there
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
- `src/lib/` — pure utilities with colocated tests
- `src/test-utils.tsx` — async `renderWithProviders` (jotai store + MemoryRouter) —
  see Rules. `Layout` needs a data router, so its test builds one (`createMemoryRouter`)

## Commands
- Dev: `bun run dev` (vite :5173, proxies `/api`+`/health` → :5150)
- Build: `bun run build` · Deploy: `bun run deploy` (build + copy to API `public/`)
- Test: `bun run test` (vitest, not `bun test`) · Single: `bunx vitest run <file>`
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
