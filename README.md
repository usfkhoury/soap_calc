# soap_calc

A small, offline-first soap calculator + cure tracker for **100% olive oil (castile) soap**,
deployed at **soap.usfkhoury.com**.

It replaces SoapCalc for a single-oil recipe: enter your olive oil weight by the gram and it
returns the exact lye and water, with adjustable superfat and lye concentration. It also scales
by bar count, walks through the process safely, and logs each batch (including bars produced)
and its weekly cure weights to a Notion database.

## Recipe defaults

All measurements are **by weight, in grams**.

- **Lye** = `oil × SAP × (1 − superfat)`, olive oil SAP = `0.135`
  - default superfat **5%** → `lye = oil × 0.128`
- **Water** = `lye × (100 − concentration)/concentration`
  - default lye concentration **40%** → `water = lye × 1.5 = oil × 0.192`
- Example — 1000 g oil → **128 g lye**, **192 g water**.

> ⚠️ Always weigh by scale, wear gloves + eye protection, and **add lye to water — never the
> reverse**. Lye measured by volume is unsafe because caustic soda's bulk density varies with
> its form.

## Status

Bootstrapping. The full build plan (PWA frontend, Netlify function + Notion persistence, cure
tracker, and the "Learn / The Science" explainer) is being refined in the cloud planning
session and will land as code here.

## Stack (planned)

- Static, offline-first PWA (service worker) — no build step, deployed on Netlify
- One Netlify Function (`@notionhq/client`) for Notion read/write, passphrase-gated
- Notion `Soap Batches` + `Cure Weights` databases as the source of truth
