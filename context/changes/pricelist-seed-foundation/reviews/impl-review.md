<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Pricelist Seed Foundation (F-02)

- **Plan**: context/changes/pricelist-seed-foundation/plan.md
- **Scope**: Phases 1–3 of 3
- **Date**: 2026-06-04
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Automated success criteria all pass: `npm run validate:pricing` (exit 0, 7 categories / 37 items, resolver round-trips ok), `npm run lint` (clean), `npm run build` (Complete). Manual items 2.5–2.8 and 3.5–3.8 all `[x]` with diff-backed evidence.

Drift detection found effectively zero meaningful drift; all planned changes implemented as specified. EXTRAs (narkoza-source Zod validation, resolver round-trip assertions in the validate script, redundant resolver range guard) strengthen the planned safety posture within the planned files — not scope creep.

## Findings

### F1 — range refinement accepts inverted / negative prices

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/pricing/schema.ts:50-53
- **Detail**: The SourcePricelistItem refinement only checked `price_max !== null` for ranges. A future re-export typo (`price_min: 600, price_max: 400`) would pass Zod and flow into `{ kind: "range", min: 600, max: 400 }` (resolver.ts:43), silently mis-totaling in S-01. No non-negativity check existed either.
- **Fix**: Added `.nonnegative()` to price_min/price_max and a refinement asserting `price_max >= price_min` for ranges.
- **Decision**: FIXED (schema.ts: nonnegative + range-ordering refinement; negative-tested)

### F2 — no guard that an item is pickable somewhere

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/pricing/seed.ts:69-128 / schema.ts:47-48
- **Detail**: validForTooth / validForGeneral are independent booleans; a future annotation typo setting both false would make an item silently absent from BOTH listToothItems() and listGeneralItems() — unpickable, no error.
- **Fix**: Added a refinement requiring `validForTooth || validForGeneral`.
- **Decision**: FIXED (schema.ts: at-least-one-context refinement; negative-tested)

### F3 — duplicate item name across two categories (picker note for S-01)

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/pricing/data/pricing.json (leczenie-zachowawcze + leczenie-kanalowe)
- **Detail**: "Odbudowa po leczeniu kanałowym" (600 zł) appears in both categories. IDs are category-scoped, so no collision and both resolve correctly — not a seed bug. But both are validForTooth, so listToothItems() yields two identically-named entries; a future price divergence would make the picker confusing.
- **Fix**: No code change in F-02. Recorded a durable "Note for S-01" in the contract-surfaces F-02 entry directing the picker to disambiguate by category (`listByCategory()`).
- **Decision**: FIXED (docs note in contract-surfaces.md)

### F4 — fee extraction keys on `order === 1`

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Reliability
- **Location**: src/lib/pricing/seed.ts:217
- **Detail**: buildFeeSchedule selected the anesthesia component via `c.order === 1`. Failed loudly if reordered (explicit undefined check at seed.ts:222), but keying on a presentation-ish field is marginally fragile.
- **Fix**: Select the component by the structural fact that it carries the base-price array (`c.pricing.base !== undefined`) — robust to a re-export reordering or dropping `order`.
- **Decision**: FIXED (seed.ts: base-presence selector)
