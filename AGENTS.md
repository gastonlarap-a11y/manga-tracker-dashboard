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
- `src/views/` — one component per route (`/`, `/manga/:id`, `/duplicates`) with
  colocated `*.test.tsx`; the library is a cover-card grid with a sticky toolbar
- `src/components/` — `Layout` (nav + health badge), `LiveRefresh` (SSE
  `/api/events/stream` → refreshes every data atom, 300ms debounce), `CoverImage`
  (cover with deterministic gradient fallback), `RenameForm`
- `src/lib/` — pure utilities with colocated tests
- `src/test-utils.tsx` — async `renderWithProviders` (jotai store + MemoryRouter) —
  see Rules

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
- Shared/cross-view state lives in Jotai atoms; state local to one view stays in the
  component (discriminated-union state, no flag booleans).
- Rename fixes only `canonicalName`; there is no merge on purpose (append-only events).
- Reading status and tags are MANUAL (chapter pages cannot declare genres reliably);
  deletes require explicit confirmation and are the only destructive action.
- Tests: components that read async atoms suspend — always render through the async
  `renderWithProviders` and wrap suspense-triggering interactions in `actAsync`
  (React 19 requires awaited `act` for suspended trees).
- UI strings are Spanish; code, identifiers and comments are English.

## Engineering standards
- Every feature ships with its tests. Run `bun run lint` + `bun run typecheck` +
  `bun run test` before declaring work done; report real results.
- No speculative abstractions; this is a small read-mostly UI.
