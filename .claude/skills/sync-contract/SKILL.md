---
name: sync-contract
description: Mirror a manga-tracker-api contract change into this repo's hand-duplicated types and client. Use when API routes or schemas changed, or a dashboard task needs a new endpoint.
---

# Sync API contract

`src/api/types.ts` mirrors the API's Zod schemas BY HAND; there is no codegen. A contract
change in `manga-tracker-api` updates this repo in the same commit (AGENTS.md rule).

1. Read the source of truth: the Zod schemas in
   `../manga-tracker-api/src/modules/<slice>/<slice>.routes.ts` — or
   `http://localhost:5150/openapi.json` when the backend is running.
2. Update `src/api/types.ts` to match: names, optionality and nullability exactly as the
   schema says.
3. If the surface changed (new endpoint, changed params), update `src/api/client.ts`:
   relative paths, `ApiResult<T>`, never throws.
4. Run `bun run typecheck` + `bun run test` — compile errors here are the point: they
   list every view the contract change touches.
