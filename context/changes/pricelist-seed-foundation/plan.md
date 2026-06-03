# Pricelist Seed Foundation (F-02) Implementation Plan

## Overview

Define the Dentina clinic pricelist as a **typed, Zod-validated TypeScript seed bundled into the app** — the single source the S-01 quote flow reads from to assign pricelist items per-tooth (FR-025), as general items (FR-029), sum ranges (FR-026), auto-skip locally-anesthetic items in the narkoza plan (FR-041), and compute the anesthesia fee (FR-042/FR-043). No DB table, no admin UI — both are deliberate v2 deferrals (roadmap F-02, PRD §Non-Goals). The seed is built from the real `pricing.json` / `pricing-narkoza.json` exports the dentystka supplied, annotated with DentiPlan-specific flags the exports lack.

## Current State Analysis

- **The snapshot value-type already exists.** `src/types.ts:79` defines `PricelistItemRefSchema` (`id`, `name`, `price`, `localAnesthesia`) — the by-value shape S-01 freezes into a quote's `content` jsonb on approval (FR-050). `PriceValueSchema` (`src/types.ts:68`) is a discriminated union of `fixed` and `range` only.
- **No pricelist DB table.** F-01's migration (`supabase/migrations/20260603194110_quotes_foundation.sql`) created only `public.quotes`. The pricelist is repo-config, bundled at build — not a queried table. The `[db.seed]` hook in `supabase/config.toml:60` seeds DB rows and is **not** the home for this.
- **Runtime is Cloudflare Workers SSR.** No filesystem read at request time; "loaded at build/deploy" means *bundled* — a TS/JSON module imported at build time.
- **Real data exists, richer than the snapshot contract.** `pricing.json` (repo root) is a categorized export: 7 `categories` (`name`/`slug`/`items[]`), each item with `price_type` ∈ {`fixed`, `range`, `modifier`} (the `$comment` also documents `from`), `price_min`, `price_max`, `note`, `display`, plus top-level metadata (`currency`, `isIndicative`, `nfz`, `paymentMethods`, `installments`, `modifiers[]`). `pricing-narkoza.json` encodes the anesthesia fee model: base 1400 (dzieci/zęby mleczne) / 2000 (dorośli/zęby stałe), `+100` per tooth above 5 — exactly FR-042/FR-043 — with dental treatment itself priced from the standard pricelist ("wycena indywidualna").
- **Two gaps between the export and what F-02 must deliver:**
  1. `price_type: "modifier"` (e.g. "Ponowne leczenie kanałowe +500 zł", "Szycie +100 zł") and the documented `from` have **no representation** in `PriceValueSchema`.
  2. The export carries **no `localAnesthesia` flag** and **no per-tooth/general context flags**. The local-anesthetic line is a plain item "Znieczulenie" (50 zł). FR-041's flag must be *authored by us*, not read from the export.
- **Conventions.** Zod-first types in `src/types.ts` (types via `z.infer`); services/helpers in `src/lib/` (`utils.ts`, `supabase.ts`, `config-status.ts` today). No `lessons.md`. No test framework yet (Module 3 introduces testing per `CLAUDE.md`).

## Desired End State

A bundled, type-safe pricelist any later slice imports:

- `src/types.ts` exports an **extended** `PriceValueSchema` covering `fixed`, `range`, `modifier`, and `from`; `PricelistItemRef` continues to carry the resolved price by value.
- `src/lib/pricing/` exports a validated `PRICELIST` (all real items, grouped by category, each annotated with `localAnesthesia` / `validForTooth` / `validForGeneral` and a stable id), an `ANESTHESIA_FEE_SCHEDULE` (base-by-dentition + per-extra-tooth surcharge + threshold), a `resolvePricelistItem(id) → PricelistItemRef` snapshot mapper, and context-aware lookup helpers.
- An `npm run validate:pricing` script that imports the seed, runs the Zod parse, and exits non-zero on any schema or referential failure — the automated fail-fast gate in lieu of a test framework.
- A short README note telling the dentystka how to change a price.

**Verification:** `npm run validate:pricing` passes; `npm run lint` and `npm run build` pass; `resolvePricelistItem` round-trips a known id to the correct `PricelistItemRef`; every `modifier`/`from` item parses; the local-anesthesia item carries `localAnesthesia: true`.

### Key Discoveries:

- Snapshot ref + price union already defined — `src/types.ts:68` / `src/types.ts:79`. F-02 extends, it does not reinvent.
- F-01 is archived/immutable, but `src/types.ts` is live code; extending `PriceValueSchema` there is a normal edit, not an archive violation. The DB layer is untouched — `content` is `jsonb` (schema-on-read), so `src/db/database.types.ts` needs no regeneration.
- The anesthesia fee numbers in `pricing-narkoza.json` are clinic pricing, not pure calc logic — they belong in the seed (`ANESTHESIA_FEE_SCHEDULE`), with S-01 owning only the formula that consumes them.
- `pricing.json` items have no IDs — only names. Stable ids are derived as `<category-slug>:<slugified-name>`.

## What We're NOT Doing

- **No pricelist DB table, no migration, no RLS.** Repo-config only (roadmap F-02).
- **No admin UI to edit the pricelist.** Deferred to v2 (PRD §Non-Goals; price change = PR + redeploy).
- **No separate narkoza treatment set.** The narkoza plan reuses standard treatment items minus `localAnesthesia` ones, plus the fee (FR-041). `pricing-narkoza.json` confirms this.
- **No quote/totals computation.** Summing teeth, building visits, applying the anesthesia formula, and the patient page are all S-01. F-02 only supplies the data + the snapshot resolver + the fee constants.
- **No LLM, no token, no email** — unrelated slices.
- **No confirmation of the price numbers themselves.** The supplied export is taken as authoritative for v1; medical/price sign-off with the dentystka is a launch-gate tracked in the roadmap, not a coding task here.

## Implementation Approach

Three thin phases, dependency-ordered. Phase 1 settles the shared contract (extended price union) and the source schema so the data has something to validate against. Phase 2 brings the real data into the source tree, attaches the DentiPlan annotations inline, and wires the load-time validation gate. Phase 3 adds the S-01-facing surface (resolver, fee schedule export, lookups) and the change-price docs. Each phase is independently lint/build/validate-clean.

The seed is authored as TS that **imports the relocated JSON exports** (so the real prices live as data, diffable against future clinic exports) and attaches flags via an **inline annotation step within the same module** (not a separate override file) — co-locating each item's full behavior while keeping the price numbers in the raw JSON. Zod validates the merged result at module load.

## Critical Implementation Details

- **`modifier` ripples into S-01.** Extending `PriceValueSchema` with an additive `modifier` variant means S-01's per-tooth and patient-page sum logic must treat a `modifier` as an addition to the tooth's other items, not a standalone line. F-02 only defines the variant and resolves it through the snapshot verbatim; it does **not** implement the summation. This is called out in Open Risks so S-01 planning inherits it.
- **Load-time validation must actually execute.** A bundler will not run the seed's Zod parse unless something imports it. The `validate:pricing` script is the thing that imports it; do not rely on `npm run build` alone to catch a malformed seed (a page must import the module for the build to evaluate it).
- **Annotation completeness is the failure mode.** An item present in the JSON but missing from the inline annotation step would default its flags silently. The seed builder must assert every JSON item is annotated (fail the Zod/validation pass on an unannotated item) so a future re-import can't drop a flag unnoticed.

## Phase 1: Shared price-type extension + source schema

### Overview

Extend the shared price union to represent every real `price_type`, and define the Zod schema the source seed validates against (categories, annotated items, fee schedule).

### Changes Required:

#### 1. Extend the shared price value union

**File**: `src/types.ts`

**Intent**: Teach `PriceValueSchema` the two price kinds the real export uses that `fixed`/`range` can't express — `modifier` (an additive surcharge like +500 zł) and `from` (a starting "od" price) — so a resolved `PricelistItemRef` snapshot can carry them faithfully (the "Extend F-01 PriceValueSchema" decision). Update the doc comment to note the snapshot now distinguishes these and that summation semantics for `modifier` are an S-01 concern.

**Contract**: `PriceValueSchema` becomes a discriminated union on `kind` with four members. The two existing members are unchanged; the additions are:

```ts
z.object({ kind: z.literal("modifier"), amount: z.number() }),  // additive surcharge, e.g. +500
z.object({ kind: z.literal("from"), amount: z.number() }),      // starting price ("od X")
```

`PriceValue` (the `z.infer`) and `PricelistItemRefSchema` need no structural change — they consume the wider union automatically.

#### 2. Source pricelist + fee-schedule schema

**File**: `src/lib/pricing/schema.ts` (new)

**Intent**: Define the Zod schema for the *source* pricelist (richer than the snapshot ref: grouped by category, plus DentiPlan annotation flags and the `note`/`display` metadata the admin UI will want) and for the anesthesia fee schedule. Types via `z.infer`, following the `src/types.ts` pattern.

**Contract**: exports —
- `PriceTypeSchema` = `z.enum(["fixed", "range", "modifier", "from"])` (matches the JSON's `price_type`).
- `SourcePricelistItemSchema` — fields from the JSON (`name`, `price_type`, `price_min`, `price_max` nullable, `note` nullable, `display`) **plus** the authored fields: `id: string`, `localAnesthesia: boolean` (default `false`), `validForTooth: boolean`, `validForGeneral: boolean`. Cross-field refinement: `range` requires non-null `price_max`; `fixed`/`modifier`/`from` require null `price_max`.
- `PricelistCategorySchema` — `name`, `slug`, `items: SourcePricelistItemSchema[]`.
- `PricelistSchema` — top-level metadata (`currency`, `isIndicative`, `nfz`, `paymentMethods`, `installments`) + `categories[]`.
- `AnesthesiaFeeScheduleSchema` — `baseMilk: number`, `basePermanent: number`, `perExtraTooth: number`, `includedTeeth: number` (the "do 5 zębów" threshold).
- Inferred types: `SourcePricelistItem`, `PricelistCategory`, `Pricelist`, `AnesthesiaFeeSchedule`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run lint` (type-checked ESLint config)
- Build passes: `npm run build`
- `PriceValueSchema` parses one fixture of each of the four `kind`s (exercised via the Phase 2 validation script once the seed exists; in this phase, verified by typecheck of the union usage)

#### Manual Verification:

- The four price kinds cover every `price_type` value present in both JSON files (no unmapped type)
- Annotation fields (`localAnesthesia`, `validForTooth`, `validForGeneral`) are present on the source item schema

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Seed data + inline annotations + load-time validation

### Overview

Bring the real exports into the source tree, build the canonical seed (raw prices + inline annotations), validate it at load, and expose the typed constants.

### Changes Required:

#### 1. Relocate the raw exports

**File**: `src/lib/pricing/data/pricing.json`, `src/lib/pricing/data/pricing-narkoza.json` (moved from repo root)

**Intent**: Move the two authoritative exports out of the repo root into the pricing module so they're bundled and co-located with the code that consumes them; keep them byte-faithful so future clinic re-exports diff cleanly.

**Contract**: the two files relocated verbatim; the root copies removed. They are imported as data by `seed.ts` (Astro/Vite JSON import).

#### 2. Seed builder with inline annotations

**File**: `src/lib/pricing/seed.ts` (new)

**Intent**: Import the JSON, attach DentiPlan annotations (`localAnesthesia`, `validForTooth`, `validForGeneral`) and stable ids to every item inline, derive the anesthesia fee schedule from `pricing-narkoza.json`, validate the whole structure with the Phase 1 schema at module load, and export the typed results. Authoring the annotation map is the one place clinical judgment enters: mark the "Znieczulenie" (50 zł) item `localAnesthesia: true` (FR-041); mark Profilaktyka / consultation / RTG-type items `validForGeneral: true` and treatment items `validForTooth: true` per the dentystka's intent.

**Contract**:
- Stable id = `${category.slug}:${slugify(item.name)}`.
- An inline annotation lookup keyed by id supplies `{ localAnesthesia?, validForTooth, validForGeneral }` for every item. **The builder must throw if any JSON item lacks an annotation entry** (completeness guard — see Critical Implementation Details) and if any annotation entry references a non-existent item.
- `price_type`/`price_min`/`price_max` map onto the source schema unchanged (the resolver in Phase 3 converts to `PriceValue`).
- Exports: `PRICELIST: Pricelist` (validated) and `ANESTHESIA_FEE_SCHEDULE: AnesthesiaFeeSchedule` (`{ baseMilk: 1400, basePermanent: 2000, perExtraTooth: 100, includedTeeth: 5 }`, parsed from the narkoza JSON, not hardcoded twice).
- Validation runs via `*Schema.parse(...)` at module top level so any import (including the validate script) triggers it.

#### 3. Validation script + npm wiring

**File**: `scripts/validate-pricing.ts` (new), `package.json`

**Intent**: Provide an automated fail-fast gate that imports the seed (forcing the Zod parse and the completeness guard) and exits non-zero on failure, since there's no test runner yet.

**Contract**: `scripts/validate-pricing.ts` imports `PRICELIST` + `ANESTHESIA_FEE_SCHEDULE`, logs a one-line summary (category count, item count), and exits 0/1. `package.json` gains `"validate:pricing": "tsx scripts/validate-pricing.ts"` (or the project's existing TS-run mechanism — confirm `tsx`/`node --import` availability; fall back to an Astro/`vite-node` invocation if `tsx` is absent).

### Success Criteria:

#### Automated Verification:

- Seed validates: `npm run validate:pricing` exits 0 and reports the expected category/item counts
- Lint passes: `npm run lint`
- Build passes: `npm run build`
- Tampering check: temporarily removing one annotation entry makes `npm run validate:pricing` exit non-zero (completeness guard works), then restore

#### Manual Verification:

- "Znieczulenie" (50 zł) is flagged `localAnesthesia: true`; no other item is unless the dentystka confirms
- Each item's `validForTooth` / `validForGeneral` matches clinical intent (treatments per-tooth; profilaktyka/konsultacja/RTG general)
- `ANESTHESIA_FEE_SCHEDULE` values (1400 / 2000 / 100 / 5) match `pricing-narkoza.json`
- The two root JSON files are gone; the relocated copies are byte-identical to the originals

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 3: Resolver + S-01-facing API + change-price docs

### Overview

Add the snapshot resolver and lookup surface S-01 consumes, plus a short doc for changing prices.

### Changes Required:

#### 1. Snapshot resolver + lookups

**File**: `src/lib/pricing/resolver.ts` (new)

**Intent**: Map a source pricelist item to the F-01 `PricelistItemRef` snapshot value (the by-value shape frozen into a quote on approval) and provide context-aware lookups so S-01 can populate per-tooth and general-item pickers without re-deriving pricelist knowledge.

**Contract**: exports —
- `resolvePricelistItem(id: string): PricelistItemRef` — looks up the source item, converts its price to a `PriceValue` (`fixed`→`{kind:"fixed",amount:price_min}`, `range`→`{kind:"range",min,max}`, `modifier`→`{kind:"modifier",amount:price_min}`, `from`→`{kind:"from",amount:price_min}`), carries `id`, `name`, and `localAnesthesia` through. Throws on unknown id.
- `findItemById(id): SourcePricelistItem | undefined`.
- `listToothItems()` / `listGeneralItems()` — flattened items filtered by `validForTooth` / `validForGeneral`.
- `listByCategory()` — categories for grouped rendering.
- Re-export `ANESTHESIA_FEE_SCHEDULE` for S-01's fee formula.

#### 2. Barrel export

**File**: `src/lib/pricing/index.ts` (new)

**Intent**: Single import surface for the pricing module.

**Contract**: re-exports `PRICELIST`, `ANESTHESIA_FEE_SCHEDULE`, the resolver/lookup functions, and the source types. S-01 imports from `@/lib/pricing`.

#### 3. Change-a-price documentation

**File**: `src/lib/pricing/README.md` (new)

**Intent**: Tell the dentystka (single operator) how to change a price and what redeploy entails, since there's no UI (the documented mitigation in roadmap F-02's Risk).

**Contract**: a short markdown note — which JSON file to edit, the `price_type`/`price_min`/`price_max` fields, that a change requires a PR + redeploy, that approved quotes keep their old snapshot (FR-050), and how to run `npm run validate:pricing` before committing.

### Success Criteria:

#### Automated Verification:

- `npm run validate:pricing` exits 0
- Lint passes: `npm run lint`
- Build passes: `npm run build`
- Resolver round-trip: `resolvePricelistItem` for a known fixed item, a range item, and the `modifier` re-treatment item returns the correct `PriceValue` shape (asserted in `validate-pricing.ts` or a small inline check)

#### Manual Verification:

- `listToothItems()` / `listGeneralItems()` return the contextually correct subsets
- README is clear enough for a non-developer to change a price
- `@/lib/pricing` import surface exposes everything S-01 needs (resolver, lookups, fee schedule) without reaching into internal files

**Implementation Note**: After completing this phase and all automated verification passes, pause for final manual confirmation.

---

## Testing Strategy

No test framework is configured yet (Module 3 introduces testing per `CLAUDE.md`), so verification leans on the type-checked lint, the build, and the dedicated `validate:pricing` script.

### Validation (automated):

- `npm run validate:pricing` — Zod-parses the full seed, runs the annotation completeness guard, asserts the fee schedule values, and round-trips representative items through the resolver
- `npm run lint` — type-checked ESLint across the new module
- `npm run build` — confirms the seed bundles cleanly for Workers

### Manual Testing Steps:

1. Edit a price in `pricing.json`, run `npm run validate:pricing` → still passes; build picks up the new value.
2. Remove an annotation entry → `validate:pricing` fails (completeness guard).
3. Introduce a `range` item with null `price_max` → schema refinement rejects it.
4. Spot-check that the `localAnesthesia` flag sits only on the intended item(s).

## Performance Considerations

The seed is a small static structure (~40 items) bundled at build and held in module scope — no runtime cost beyond a single load-time Zod parse. Irrelevant at this scale (PRD: ~kilkadziesiąt kosztorysów rocznie).

## Migration Notes

No data migration — the pricelist is not in the database. The only "migration" is relocating two JSON files from repo root into `src/lib/pricing/data/` and removing the originals. Extending `PriceValueSchema` does not touch the DB (`content` is `jsonb`, validated on read); `src/db/database.types.ts` needs no regeneration.

## References

- Roadmap F-02: `context/foundation/roadmap.md:77`
- Snapshot ref + price union (extend, don't reinvent): `src/types.ts:68`, `src/types.ts:79`
- F-01 schema (archived, immutable): `context/archive/2026-06-03-quotes-data-foundation/plan.md`
- PRD pricelist FRs: FR-025/026/029/040/041/042/043/050 in `context/foundation/prd.md`
- Source data: `pricing.json`, `pricing-narkoza.json` (repo root → relocated in Phase 2)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Shared price-type extension + source schema

#### Automated

- [ ] 1.1 Type checking passes: `npm run lint`
- [ ] 1.2 Build passes: `npm run build`
- [ ] 1.3 `PriceValueSchema` parses one fixture of each of the four `kind`s

#### Manual

- [ ] 1.4 Four price kinds cover every `price_type` present in both JSON files
- [ ] 1.5 Annotation fields present on the source item schema

### Phase 2: Seed data + inline annotations + load-time validation

#### Automated

- [ ] 2.1 Seed validates: `npm run validate:pricing` exits 0 with expected counts
- [ ] 2.2 Lint passes: `npm run lint`
- [ ] 2.3 Build passes: `npm run build`
- [ ] 2.4 Tampering check: removing an annotation entry fails `validate:pricing`, then restore

#### Manual

- [ ] 2.5 "Znieczulenie" flagged `localAnesthesia: true`; no other item unless confirmed
- [ ] 2.6 Each item's `validForTooth` / `validForGeneral` matches clinical intent
- [ ] 2.7 `ANESTHESIA_FEE_SCHEDULE` matches `pricing-narkoza.json` (1400 / 2000 / 100 / 5)
- [ ] 2.8 Root JSON files removed; relocated copies byte-identical

### Phase 3: Resolver + S-01-facing API + change-price docs

#### Automated

- [ ] 3.1 `npm run validate:pricing` exits 0
- [ ] 3.2 Lint passes: `npm run lint`
- [ ] 3.3 Build passes: `npm run build`
- [ ] 3.4 Resolver round-trips a fixed, a range, and the `modifier` item to correct `PriceValue` shapes

#### Manual

- [ ] 3.5 `listToothItems()` / `listGeneralItems()` return contextually correct subsets
- [ ] 3.6 README clear enough for a non-developer to change a price
- [ ] 3.7 `@/lib/pricing` exposes everything S-01 needs without reaching into internals
