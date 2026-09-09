# Pricelist Seed Foundation (F-02) — Plan Brief

> Full plan: `context/changes/pricelist-seed-foundation/plan.md`

## What & Why

Define the clinic pricelist as a typed, Zod-validated TypeScript seed bundled into the app, built from the real `pricing.json` / `pricing-narkoza.json` exports the dentystka supplied. It's the single source the S-01 quote flow reads from to assign items per-tooth, as general items, sum ranges, auto-skip locally-anesthetic items in the narkoza plan, and compute the anesthesia fee. No DB table, no UI — repo-config only.

## Starting Point

F-01 (done) created `public.quotes` and already defines the snapshot value-types in `src/types.ts`: `PricelistItemRef` (`id`/`name`/`price`/`localAnesthesia`) and `PriceValueSchema` (`fixed`/`range` only). There is no pricelist table and no seed yet. The two real JSON exports sit at repo root; they're categorized, carry `price_type` values (`fixed`/`range`/`modifier`) F-01 can't represent, and lack the `localAnesthesia` + context flags DentiPlan needs.

## Desired End State

`@/lib/pricing` exports a validated `PRICELIST` (all real items, grouped, each annotated with `localAnesthesia` / `validForTooth` / `validForGeneral` and a stable id), an `ANESTHESIA_FEE_SCHEDULE`, a `resolvePricelistItem(id) → PricelistItemRef` snapshot mapper, and context-aware lookups. `PriceValueSchema` is extended to carry `modifier`/`from`. An `npm run validate:pricing` script is the automated fail-fast gate.

## Key Decisions Made

| Decision      | Choice                                  | Why (1 sentence)                                                                         | Source |
| ------------- | --------------------------------------- | ---------------------------------------------------------------------------------------- | ------ |
| Source format | TS module + Zod                         | Zero-cost on Workers (bundled), type-safe, matches the Zod-first `types.ts` pattern      | Plan   |
| Item context  | Hard context flags                      | Explicit `validForTooth` / `validForGeneral` gate where each item appears                | Plan   |
| Seed data     | Real exports supplied                   | Dentystka provided `pricing.json` + `pricing-narkoza.json` — unblocks S-01 end-to-end    | Plan   |
| Price types   | Extend `PriceValueSchema`               | Add `modifier`/`from` so surcharges (+500/+100) survive into the snapshot & patient page | Plan   |
| Annotations   | Inline in the seed module               | `localAnesthesia`/context flags authored once onto each item; single auditable source    | Plan   |
| Scope         | Seed + schema + resolver + fee schedule | S-01 gets one authoritative place for the snapshot mapping and the fee constants         | Plan   |

## Scope

**In scope:** extended price union; source pricelist + fee-schedule Zod schema; relocated JSON exports; annotated seed with load-time validation; `validate:pricing` gate; snapshot resolver + lookups + fee export; change-price README.

**Out of scope:** pricelist DB table/migration/RLS; admin UI; separate narkoza treatment set; quote/totals computation & the anesthesia formula (S-01); LLM/token/email; sign-off on the price numbers themselves.

## Architecture / Approach

Three thin phases. **P1** extends `PriceValueSchema` in `src/types.ts` and defines the source schema in `src/lib/pricing/schema.ts`. **P2** relocates the JSON into `src/lib/pricing/data/`, builds `seed.ts` (raw prices from JSON + inline annotation map keyed by stable id, with a completeness guard that throws on any unannotated item), and wires `scripts/validate-pricing.ts`. **P3** adds `resolver.ts` (id→`PricelistItemRef`, context lookups, fee export), a barrel `index.ts`, and a README. S-01 imports only from `@/lib/pricing`.

## Phases at a Glance

| Phase                                   | What it delivers                                              | Key risk                                                     |
| --------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------ |
| 1. Price-type extension + source schema | Extended `PriceValueSchema`; source + fee-schedule Zod schema | `modifier` variant ripples into S-01's sum logic             |
| 2. Seed + annotations + validation      | Bundled annotated seed; `validate:pricing` gate               | Silently unannotated item — mitigated by completeness guard  |
| 3. Resolver + API + docs                | Snapshot resolver, lookups, fee export, README                | Resolver price mapping must match the extended union exactly |

**Prerequisites:** none (parallel with F-01/S-05; F-01 already done). Real price data already supplied.
**Estimated effort:** ~1 session across 3 small phases.

## Open Risks & Assumptions

- **Extending `PriceValueSchema` widens blast radius.** An additive `modifier` means S-01's per-tooth and patient-page sum logic must treat it as an addition, not a standalone line — F-02 defines the variant but does not implement the summation. Flag for S-01 planning.
- **Price numbers taken as authoritative for v1.** Medical/price sign-off with the dentystka is a launch-gate (roadmap), not part of this change.
- **No test framework yet** (Module 3) — `validate:pricing` + lint + build are the gates.
- **`tsx` availability** for the validate script — fall back to `vite-node`/Astro invocation if absent.

## Success Criteria (Summary)

- `npm run validate:pricing`, `npm run lint`, `npm run build` all pass.
- `resolvePricelistItem` round-trips fixed, range, and `modifier` items to correct `PriceValue` shapes; the local-anesthesia item is flagged.
- S-01 can build both plans from `@/lib/pricing` alone — no pricelist knowledge re-encoded downstream.
