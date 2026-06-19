# soap_calc — context

The single glossary for this project. Domain language only — no implementation
detail. (See `docs/adr/` for decisions, `README.md` for the build.)

## Language

**Castile soap**
Soap made from 100% olive oil. The only kind this tool supports. Mild and
conditioning by nature, but soft and slow to harden — the problems the defaults
are tuned to fight.

**Lye** (NaOH, caustic soda, _atroun_)
The strong alkali that reacts with oil to make soap. Sold as flakes or beads.
Caustic and dangerous; always weighed, never measured by volume.
_Avoid_: "soda", "ash".

**Oil**
The fat being turned into soap. Here, always olive oil (often the family grove's
own). Measured by weight.

**Saponification**
The reaction `oil + lye → soap + glycerin`. Every fat needs a precise lye amount
to fully react.

**SAP value**
A fat's "lye appetite" — grams of lye that fully react with 1 g of it. Olive
oil ≈ **0.135**. The constant that lets one oil collapse to one multiplier.

**Superfat**
The share of oil deliberately left un-saponified by using slightly less lye than
full. Higher = milder/softer; lower = firmer/longer-lasting. Default **5%**.
_Avoid_: "lye discount" (that's a different idea — see water discount).

**Lye concentration**
Lye as a percent of the lye-water solution. The same fact as the water-to-lye
ratio (40% concentration = water is 1.5× the lye). Default **40%**.

**Water discount**
Using less water than a "full water" recipe. Raises lye concentration, firms the
bar sooner, shortens cure. The main lever against soft castile.

**Trace**
The point while mixing when the batter thickens enough to leave a faint trail on
its own surface — the signal it's emulsified and ready to mold.

**Cure**
The weeks-to-months after unmolding while water evaporates and the bar hardens
and mellows. Considered done when a bar's weekly weight stops dropping.

**Batch**
One make: a quantity of oil turned into soap on a given day, with its recipe
numbers, bars produced, notes, and cure-weight history.

**Bar**
One finished cake of soap cut/poured from a batch.
