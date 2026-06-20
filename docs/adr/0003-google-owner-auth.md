# 3. Google owner login (replaces the write passphrase)

Date: 2026-06-20

## Status

Accepted. Amends ADR-0002 (which gated writes with a shared passphrase).

## Context

ADR-0002 protected Notion writes with a shared passphrase (`SOAP_WRITE_SECRET`)
sent from the client. That was explicitly "light write-protection, not real auth":
the secret lives in the browser, can't be rotated per-person, and anyone who sees
it can write. The sibling app `olive_grove_tracker` already uses **Google sign-in
restricted to a single owner email**, and we want the same trust model here.

The constraint: soap_calc is a **static site + Netlify Functions** with no
persistent backend, whereas olive_grove has a Python/VM backend that exchanges the
Google token for its own signed **session cookie** verified on each write.

## Decision

Replace the passphrase with **Google sign-in, owner-restricted**, verified
**statelessly** in the function:

- The client uses Google Identity Services to sign in and obtains a Google **ID
  token** (JWT). It sends that token as `Authorization: Bearer …` on write calls.
- The Netlify function verifies the token on every write (signature via Google's
  keys, audience = our OAuth client ID, not expired) and checks
  `email === OWNER_EMAIL` (and `email_verified`). Reads (`list`) stay open.
- No session cookie and no signing secret — the Google token *is* the proof, so
  there's nothing extra for a serverless function to keep.

Trust model matches olive_grove: **public read, owner write**, single owner.
We **reuse olive_grove's OAuth client** (add `soap.usfkhoury.com` as an authorized
origin). Env: `GOOGLE_CLIENT_ID` (public, in the page) + `OWNER_EMAIL` (function);
`SOAP_WRITE_SECRET` is removed.

## Consequences

- Real identity instead of a shared secret; only the owner's Google account can
  write, and access is revoked by changing `OWNER_EMAIL`, not rotating a leaked string.
- Stateless verification fits the static/serverless setup — no cookie/session
  store, no VM (unlike olive_grove, which needs one for other reasons).
- ID tokens are short-lived (~1h); a write after expiry returns 401 and the UI
  re-prompts sign-in. Writes made offline still queue and flush once signed in.
- Sign-in needs network + the Google script, so it's unavailable offline — but the
  calculator, steps, Learn, and cached read-only log still work offline.
- Reuses one Google OAuth client across two apps; the owner email gate keeps them
  independent in practice.
