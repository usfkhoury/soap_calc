# Soap Calc

A small web app for soap makers. You type in your oils and how much of each you're using, and it tells you how much lye and water to add so the soap comes out right. It also lets you save a batch to your Notion workspace.

## How to use it

- Open the deployed site, or open `frontend/index.html` in a browser for a local try.
- Add oils, enter weights, pick your lye type (NaOH or KOH), set superfat and water amounts, and read the results.
- Sign in with Google (top of the page) if you want to save the batch to Notion.

## What's in here

- `frontend/index.html` — the page.
- `frontend/app.js` — the interface: reading inputs, drawing results, handling the save button.
- `frontend/calc.js` — the actual soap math (SAP values, lye, water, superfat).
- `frontend/sw.js`, `frontend/manifest.webmanifest`, `frontend/icon.svg` — make it installable as an offline PWA.
- `netlify/functions/soap.js` — tiny backend that receives a saved batch and writes a row to Notion. Needs Notion + Google env vars set in the Netlify dashboard.
- `netlify.toml`, `package.json` — Netlify build config and backend dependencies.

## Deploy

Push to `main`. Netlify builds and publishes automatically.
