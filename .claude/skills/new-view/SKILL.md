---
name: new-view
description: Scaffold a new routed view under src/views/ with its colocated test. Use when adding a page/route to the dashboard.
argument-hint: "<ViewName>"
---

# New view

1. Create `src/views/<Name>View.tsx` mirroring the closest exemplar —
   `DuplicatesView.tsx` for a plain data view, `LibraryView.tsx` for one with a
   toolbar/filters. Named export, UI strings in Spanish.
2. Data: fetch through `src/api/client.ts` behind an `atomWithRefresh` in
   `src/state/atoms.ts` only when the data is shared across views or must live-update —
   then also add its refresh to `refreshAll` in `src/components/LiveRefresh.tsx`.
   View-local state stays in the component as a discriminated union. Anything that grows
   with the library is asked of the server a page at a time, never fetched whole.
3. Route: add a child route to the `createBrowserRouter` table in `src/App.tsx` (under
   the `Layout` element); add a `NavLink` in `src/components/Layout.tsx` if it deserves
   one — without `viewTransition`, which is only for the cover morph (see AGENTS.md).
   Production caveat: the API serves
   known SPA paths explicitly (no wildcard), so a new top-level path needs the matching
   entry in `../manga-tracker-api`'s static serving — same commit as the API change —
   and it carries the frame-ancestors policy like the others.
   Styles: a `src/styles/<area>.css` imported from `main.tsx`, written only with the
   tokens in `styles/tokens.css`; glass only if it is navigation, never content.
4. Test: colocated `src/views/<Name>View.test.tsx` rendered through the async
   `renderWithProviders` (`src/test-utils.tsx`); wrap suspense-triggering interactions
   in `actAsync`.
5. Run `bun run lint` + `bun run typecheck` + `bun run test`; report real results.
