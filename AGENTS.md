# Agent notes — soap-calc

Offline-first PWA: weight-based lye calculator for 100% olive-oil (castile)
soap, plus a Notion-backed batch/cure log. Static site + one Netlify
Function. Owner-only writes via Google sign-in.

## Files

- `frontend/index.html` — the page.
- `frontend/app.js` — UI: input handling, rendering, save button, GSI login.
- `frontend/calc.js` — the soap math (SAP values, lye, water, superfat).
- `frontend/sw.js` + `frontend/manifest.webmanifest` + `frontend/icon.svg` — offline PWA plumbing.
- `netlify/functions/soap.js` — backend at `/api/soap`. Verifies a Google
  ID token against `GOOGLE_CLIENT_ID` + `OWNER_EMAIL`, then writes/reads
  batches in Notion.
- `netlify.toml`, `package.json` — Netlify build config + backend deps
  (`@notionhq/client`, `google-auth-library`, bundled by esbuild).

## Domain highlights (see archived `CONTEXT.md` for full glossary)

- **Castile soap** = 100% olive oil, the only kind supported.
- **Lye** = NaOH by default (KOH supported; different SAP).
- **SAP value** = grams of lye per gram of oil. Olive oil ≈ 0.135 with
  NaOH, 0.19 with KOH.
- **Superfat** default **5%**. **Lye concentration** default **40%**.
- **Owner** = one person, identified by Google email matching `OWNER_EMAIL`.
  Reads are public; only the Owner writes.

## Env vars (Netlify → Environment)

`NOTION_TOKEN`, `NOTION_DB_BATCHES` (or the names used in `soap.js` —
check before assuming), `GOOGLE_CLIENT_ID`, `OWNER_EMAIL`.

## Style rules

- Vanilla JS, no framework, no bundler on the frontend. One function file
  on the backend. Match `olive_grove_tracker`.
- Never `git commit` or `git push` from an agent.

## Deep context

Archived at `/opt/data/repo-archives/soap-calc/`:
`AGENTS.md` (long version — issue tracker + triage-label conventions),
`CONTEXT.md` (full domain glossary), `docs/adr/` (soap-weight-based
recipe, offline PWA + Notion, Google owner auth), `docs/agents/`.
