---
name: deploy
description: Build the dashboard and publish it into manga-tracker-api/public so the backend serves it. User-invoked only.
disable-model-invocation: true
---

# Deploy (static build into the API)

The backend serves `../manga-tracker-api/public/` same-origin on
`http://localhost:5150/` via hono `serveStatic` — files are read from disk, so no
backend restart is needed after copying.

1. Pre-flight: `bun run lint` + `bun run typecheck` + `bun run test` — all green.
2. `bun run deploy` — builds and replaces `../manga-tracker-api/public/` with `dist/`
   (`rm -rf` + copy; the previous build is gone after this).
3. Post-check: the asset hash served at `http://localhost:5150/` matches the fresh build:
   `curl -s http://localhost:5150/ | grep -o 'assets/index[^"]*'` vs `dist/index.html`.
