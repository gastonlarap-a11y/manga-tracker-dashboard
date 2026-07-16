# TypeScript rules
- No `any`: use `unknown` plus narrowing, or a proper type. `as` casts need a comment
  justifying them.
- Type-only imports use `import type { ... }` (`verbatimModuleSyntax` is enabled).
- No floating promises: `await`, return, or explicitly `void` with a reason.
- Named exports only; no `export default` (Vite entry is `index.html`, not a module).
- Model states as discriminated unions instead of boolean flag combinations.
- UI strings in Spanish; code, identifiers and comments in English.
