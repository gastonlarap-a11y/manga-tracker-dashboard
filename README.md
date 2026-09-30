# manga-tracker-dashboard

Web dashboard of the local-first manga tracker. React 19 + Jotai + Vite, Bun as package
manager. Companion for `manga-tracker-api`: it shows the library, per-manga reading
history and duplicate suggestions, and holds the manual curation the tracker cannot
infer — renames, reading status, tags, covers and deletes.

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

- `/` — library as a grid of cover cards (reached chapter, last activity, "continue
  reading" link) with search, status tabs (reading/completed/dropped), tag filter, domain
  and recency filters, and library stats. Refreshes live over SSE
  (`GET /api/events/stream`) whenever the extension records a reading. Covers load
  through the API proxy (`GET /api/mangas/:id/cover`), which defeats CDN hotlink
  protection; a deterministic gradient stands in when there is no cover.
- `/manga/:id` — full reading history plus the manual curation: inline rename, reading
  status, tags, cover URL (`PUT /api/mangas/:id`) and delete with confirmation
  (`DELETE /api/mangas/:id`, the only destructive action).
- `/duplicates` — suspected duplicate pairs: merge a pair into one card
  (`POST /api/duplicates/merge`, undone from the manga's page with unmerge), or dismiss
  one that is not the same series. Nothing merges on its own — events are append-only,
  and merging groups the cards without rewriting them.

## Commands

- Dev: `bun run dev` · Build: `bun run build` · Deploy: `bun run deploy`
- Test: `bun run test` (vitest) · Single test: `bunx vitest run <file>`
- Lint: `bun run lint` · Format: `bun run format` · Typecheck: `bun run typecheck`

## Structure

- `src/api/` — hand-duplicated API contract types + fetch client (`ApiResult<T>`)
- `src/state/` — Jotai atoms (filters + async data with refresh)
- `src/views/` — one component per route, with colocated tests
- `src/components/` — layout, SSE live refresh, connection badge, sync badge (also the
  "sync now" button), cover image, rename form
- `src/lib/` — pure utilities (relative dates) and the embed link bridge (`embed.ts`),
  which hands external links to the desktop app when the dashboard runs inside it
