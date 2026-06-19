# 1. Weight-based recipe derived from saponification

Date: 2026-06-20

## Status

Accepted

## Context

The recipe started as a family ratio, **1 : 2 : 8** (lye : water : oil), measured
by **volume**. Two problems:

- **Volume lye is unsafe and unrepeatable.** Water and oil convert volume→weight
  predictably, but solid caustic soda's bulk density swings with its form (flakes
  ~0.85–1.0 g/mL, beads ~1.1–1.4). The same "1 scoop" of lye can land from a mild
  bar to a lye-heavy, skin-burning one — invisibly.
- **The bars came out too soft / slow to harden**, the classic 100% olive oil
  complaint.

We could have kept the ratio and just converted it to weights, but the lye part —
the dangerous part — is exactly what the volume ratio gets unreliably.

## Decision

Abandon the volume ratio. Derive the recipe **by weight** from olive oil's
saponification value, with two adjustable knobs and these defaults (the "Moderate"
hardening profile):

- `lye = oil × SAP × (1 − superfat)`, SAP = **0.135**, superfat = **5%**
  → `lye = oil × 0.128`
- `water = lye × (100 − concentration)/concentration`, concentration = **40%**
  → `water = lye × 1.5 = oil × 0.192`

5% superfat keeps a mild-but-firmer bar (olive oil is already gentle); the 40%
concentration is a deliberate water discount — the biggest lever against soft
castile. Everything is measured on a scale in grams.

## Consequences

- Repeatable and safe at any batch size; the lye is computed, not scooped.
- Firmer, faster-curing bars than the old high-water volume recipe.
- The numbers differ from the inherited ratio, so the soap's feel changes
  slightly — an accepted trade of tradition for safety + control.
- Assumes ~99% pure caustic soda and the 0.135 SAP; impure lye must be bumped.
  SAP is exposed as an advanced field for that reason.
