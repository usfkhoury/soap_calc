# 2. Offline-first PWA + Notion via one Netlify Function

Date: 2026-06-20

## Status

Accepted

## Context

The tool must (a) work **offline** — the calculator and process steps are used in
a garage with no signal — and (b) **durably persist** batch records and weekly
cure weights, ideally where the rest of the owner's life already lives (Notion).

Options considered:

1. **Browser localStorage only** — simplest, but single-device and lost on cache
   clear. Weak for data revisited weekly over months.
2. **Full backend** (Python + DB + auth, like `olive_grove_tracker`) — durable,
   but a server to run and maintain, and still needs a PWA to be usable offline.
3. **Static PWA + serverless function writing to Notion.**

## Decision

Option 3. A static, offline-first **PWA**:

- A service worker precaches the app shell, so the calculator, scale-by-bars, and
  steps work with no internet and the app installs to a phone home screen.
- Batch + cure data is mirrored in `localStorage` (offline reads) and synced to a
  **Notion `Soap Batches` + `Cure Weights`** pair of databases — the source of
  truth — through one **Netlify Function** that holds the Notion token.
- Writes are gated by a shared passphrase (`x-soap-secret`). Writes made offline
  queue in `localStorage` and flush on reconnect.

## Consequences

- Offline "dumb" tool + durable, cross-device, Notion-native history, with **no
  server/VM** to maintain — strictly better here than (1) or (2).
- The passphrase is light write-protection for a personal tool, **not** real auth;
  a determined attacker with the URL could spam reads. Acceptable for scope.
- Sync is last-write-wins and single-user; no conflict resolution. Fine for one
  owner on a phone + laptop.
- Notion is now a hard dependency for persistence (the offline tier still works
  without it).
