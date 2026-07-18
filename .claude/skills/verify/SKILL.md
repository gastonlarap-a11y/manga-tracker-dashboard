---
name: verify
description: Launch the dashboard against the real API and verify a change end-to-end. Use before declaring work done.
---

# Verify

1. Precondition: the backend must be up on `http://localhost:5150` (the LaunchAgent
   `com.mangatracker` normally keeps it alive) — `curl -s http://localhost:5150/health`
   → expect `{"status":"ok"}`. If it is down, see the API repo's deploy skill.
2. Start: `bun run dev` (background) — Vite on `http://localhost:5173`, proxying
   `/api` + `/health` to :5150.
3. Probe the changed surface: fetch the data the view consumes through the proxy
   (e.g. `curl -s http://localhost:5173/api/library | head -c 400`). Rendering is
   client-side (curl only returns the SPA shell), so drive a real browser when the
   change is visual or interactive.
4. Run the affected tests: `bunx vitest run <file>`; full `bun run test` before
   declaring done.
5. Stop the dev process; report what was actually observed, not what should happen.
