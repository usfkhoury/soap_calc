# Soap Calculator

A small, offline-first soap calculator + cure tracker for **100% olive oil (castile) soap**,
deployed at **soap.usfkhoury.com**.

It replaces SoapCalc for a single-oil recipe: enter your olive oil weight by the gram and it
returns the exact lye and water, with adjustable superfat and lye concentration. It also scales
by bar count, walks through the process safely, logs each batch (including bars produced) and
its weekly cure weights to a Notion database, and explains the science behind every number.
For the rare multi-oil blend it links out to [SoapCalc](https://soapcalc.net/) rather than reimplementing it.

## Recipe defaults

All measurements are **by weight** — work in **kg or g** (toggle in the top bar; stored
canonically as grams). You can start from the oil weight *or* from a bar count + bar weight;
the calculator solves whichever you didn't enter (oil is the anchor).

- **Lye** = `oil × SAP × (1 − superfat)`, olive oil SAP = `0.135`
  - default superfat **5%** → `lye = oil × 0.128`
- **Water** = `lye × (100 − concentration)/concentration`
  - default lye concentration **40%** → `water = lye × 1.5 = oil × 0.192`
- Example — 1000 g oil → **128 g lye**, **192 g water**.

> ⚠️ Always weigh by scale, wear gloves + eye protection, and **add lye to water — never the
> reverse**. Lye measured by volume is unsafe because caustic soda's bulk density varies with
> its form.

## How it's built

Static, **no build step** — open `index.html` and it runs. A service worker makes it an
installable, offline-first PWA. One Netlify Function handles Notion persistence.

```
index.html              app shell + styles (shares olive_grove_tracker's design language)
calc.js                 pure soap math (lye/water/scaling/cure-plateau) — no DOM
app.js                  UI, localStorage mirror, offline write-queue, Notion sync
sw.js                   service worker — precaches the shell for offline use
manifest.webmanifest    PWA manifest
icon.svg                app icon
netlify/functions/soap.js   Notion read/write (the only holder of the token)
netlify.toml            static publish + /api/soap → function
CONTEXT.md              domain glossary
docs/adr/               weight-based recipe (0001) · offline PWA/Notion (0002) · Google owner auth (0003)
```

## Offline vs. online

- **Offline tier** (no internet): calculator, scale-by-bars, process/safety steps, Learn, and
  a read-only view of cached history. Installable to a phone home screen.
- **Online tier**: the batch log + cure history are **public to read**; the **owner** signs in
  with Google to add batches / log weights. Sync goes to Notion via `/api/soap`. Writes made
  offline queue in the browser and flush on reconnect (re-signing in if the token expired).

## Auth

Owner-only writes, **public read** (same trust model as olive_grove_tracker). The client signs
in via Google Identity Services and sends the Google ID token as `Authorization: Bearer …`; the
function verifies it (audience = `GOOGLE_CLIENT_ID`, `email = OWNER_EMAIL`) before any Notion
write. No passphrase, no session cookie. See `docs/adr/0003-google-owner-auth.md`.

## Setup

1. **Notion** — two databases shared with an internal integration:
   - `Soap Batches`: `Name` (title), `Date`, `Oil (g)`, `Superfat (%)`, `Concentration (%)`,
     `Lye (g)`, `Water (g)`, `Bars`, `Status` (select: Curing/Cured), `Notes`.
   - `Cure Weights`: `Name` (title), `Batch` (relation → Soap Batches), `Date`, `Weight (g)`.
2. **Google** — reuse olive_grove's OAuth Web client; add `soap.usfkhoury.com` as an authorized
   JavaScript origin. Put the client ID in `index.html` (`<meta name="google-client-id">`).
3. **Env vars** (Netlify UI, or `.env` for `netlify dev`) — see `.env.example`:
   `NOTION_TOKEN`, `NOTION_SOAP_DB_ID`, `NOTION_CURE_DB_ID`, `GOOGLE_CLIENT_ID`, `OWNER_EMAIL`.
4. **Deploy** — connect the repo to a Netlify site, set the env vars, point
   `soap.usfkhoury.com` at it. Then click **Sign in** in the batch-log card to enable writes.

## Local dev

```
npm install
npx netlify dev      # serves the static site + the function at /api/soap
```

The calculator/PWA work with plain static hosting too (`python3 -m http.server`); only the
Notion sync needs the function.
