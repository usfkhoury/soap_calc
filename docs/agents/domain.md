# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

This repo is **single-context**: one `CONTEXT.md` + `docs/adr/` at the root.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — the domain glossary.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in (currently `0001-soap-weight-based-recipe.md`, `0002-soap-offline-pwa-notion.md`).

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The producer skill (`/grill-with-docs`) creates them lazily when terms or decisions actually get resolved.

## File structure

Single-context repo (this one):

```
/
├── CONTEXT.md
└── docs/adr/
    ├── 0001-soap-weight-based-recipe.md
    └── 0002-soap-offline-pwa-notion.md
```

(If this ever becomes a monorepo, add a `CONTEXT-MAP.md` at the root pointing to per-context `CONTEXT.md` files, and check `src/<context>/docs/adr/` for context-scoped decisions.)

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids (e.g. say "lye", not "soda"; "superfat", not "lye discount").

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/grill-with-docs`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0001 (weight-based recipe) — but worth reopening because…_
