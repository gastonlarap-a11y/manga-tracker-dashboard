# manga-tracker-dashboard

Web dashboard of the local-first manga tracker. React 19 + Jotai + Vite, Bun as package
manager. Read-only companion for `manga-tracker-api` (plus manual name corrections): it
shows the library, per-manga reading history and duplicate suggestions.

Sibling repos: `../manga-tracker-api` (backend, roadmap in its `PLAN.md`) and
`../manga-tracker-extension` (MV3 extension that records the reading events).

## How it runs

There is no dashboard server. The production build is copied into the API repo and served
by the backend itself on `http://localhost:5150/` (same origin as the API, so no CORS and
no Chrome local-network permission):

```bash
bun run deploy   # vite build + copy dist/ → ../manga-tracker-api/public/
```

During development Vite runs on `http://localhost:5173` and proxies `/api` + `/health` to
the backend on `5150` (see `vite.config.ts`):

```bash
bun run dev
```

## Views

- `/` — library table (reached chapter, last activity, read count, source sites) with
  domain and recency filters.
- `/manga/:id` — full reading history + inline rename (`PUT /api/mangas/:id`).
- `/duplicates` — suspected duplicate pairs; correction is manual rename by design
  (events are append-only, so there is no automatic merge).

## Commands

- Dev: `bun run dev` · Build: `bun run build` · Deploy: `bun run deploy`
- Test: `bun run test` (vitest) · Single test: `bunx vitest run <file>`
- Lint: `bun run lint` · Format: `bun run format` · Typecheck: `bun run typecheck`

## Structure

- `src/api/` — hand-duplicated API contract types + fetch client (`ApiResult<T>`)
- `src/state/` — Jotai atoms (filters + async data with refresh)
- `src/views/` — one component per route, with colocated tests
- `src/components/` — layout, connection badge, rename form
- `src/lib/` — pure utilities (relative dates)
