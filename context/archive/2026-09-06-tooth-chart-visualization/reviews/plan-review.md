<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Tooth chart on the patient page and in the editor

- **Plan**: `context/changes/tooth-chart-visualization/plan.md`
- **Mode**: Deep
- **Date**: 2026-09-06
- **Verdict**: REVISE → SOUND after fixes
- **Findings**: 3 critical, 3 warnings, 1 observation

## Verdicts

| Dimension             | Verdict | After fixes |
| --------------------- | ------- | ----------- |
| End-State Alignment   | FAIL    | PASS        |
| Lean Execution        | PASS    | PASS        |
| Architectural Fitness | WARNING | PASS        |
| Blind Spots           | FAIL    | PASS        |
| Plan Completeness     | WARNING | PASS        |

Two dimensions failed, which the rubric would read as RETHINK. Recorded as REVISE
deliberately: both failures are specification defects in individual contracts — a
sentence each — not evidence that the approach is wrong. The structural decisions
(geometry as anonymous slots, controlled component, class table in `marks.ts`) all
survived verification intact.

## Grounding

12/12 paths ✓, 2/2 symbols ✓, Progress↔Phase structure ✓, brief↔plan ✓

## Findings

### F1 — Mixed dentition could hide a tooth that is in the plan

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 1 — `layout.ts`
- **Detail**: The contract said the permanent tooth "is omitted from that slot when a milk
  tooth is present". During exfoliation a quote can hold both 55 and 15 — the exact case
  the mixed-dentition decision exists to serve — and one would silently disappear from
  the drawing, contradicting the Desired End State.
- **Fix**: A slot never drops a tooth. When both are present the slot renders both — milk
  in the crown position, permanent successor offset outward along the arch — each its own
  button. New unit criterion 1.4 covers it.
- **Decision**: FIXED

### F2 — The tooltip's cost would be wrong for the anesthesia variant

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: End-State Alignment
- **Location**: Phase 1 — `model.ts`, criterion 1.4 (was)
- **Detail**: `sumItems(tooth.pricelistItems)` is exact for the standard plan
  (`cost.ts:114-116`) but not for the anesthesia variant, which drops `localAnesthesia`
  items (`:71`) and adds `anesthesiaFee(inPlanTeeth)` (`:147-153`) — a set-level fee
  (`base + max(0, n - included) * perExtraTooth`) that cannot be attributed to one tooth
  without inventing an allocation. Separately only `status === "in-plan"` teeth contribute
  (`:101`), so an `uncertain` tooth has a non-zero item sum but contributes nothing to any
  total the patient sees. The old criterion "agrees with `computeQuoteTotals`" was not
  well-defined.
- **Fix**: `cost` is populated for `in-plan` teeth only; the tooltip labels it as the
  standard-plan amount; the anesthesia fee stays in the variant comparison, which owns the
  set-level number. Criterion restated as "equals the tooth's contribution to
  `standard.grandTotal`".
- **Decision**: FIXED

### F3 — The dependency-cruiser edit described does not exist

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — `.dependency-cruiser.cjs`
- **Detail**: The plan said "add `tooth-chart` to the allowed-import list". There is no
  allowlist: `:267-278` captures the family by regex from `from.path` and exempts only the
  same family (back-reference) and `^src/components/ui/` in `to.pathNot`.
- **Fix**: Add `'^src/components/tooth-chart/'` as a third `to.pathNot` entry.
- **Decision**: FIXED

### F4 — The `addTeeth` seam was specified in the wrong place

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — `QuoteEditor.tsx`
- **Detail**: `warnings` is built on both sides of the proposed cut (`:129` parse, `:133`
  duplicate) and flushed once at `:149`; a naive split yields two `setToothWarnings` calls
  and the parse warnings vanish. `Ząb ${n} jest już dodany` must travel with the dedupe,
  contradicting "the Polish literals stay in `addTeeth`". `seen` is built from the render
  closure (`:123`) while the write is functional (`:148`), so two chart clicks in one tick
  can double-insert.
- **Fix**: `addToothNumbers` returns `string[]`; `addTeeth` concatenates and sets once;
  `setToothInput("")` stays text-input-only; `seen` moves inside the `setTeeth` updater;
  the `additions.length > 0` guard is preserved. Line-by-line seam written into the contract.
- **Decision**: FIXED

### F5 — An `.astro` legend cannot render in the editor

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 — `ChartLegend`
- **Detail**: `admin/quotes/new.astro:20` renders only `<QuoteEditor client:load />`, and a
  React island cannot import an Astro component — the legend would be unusable on one of
  its two surfaces.
- **Fix**: `ChartLegend.tsx`, shared by both surfaces.
- **Decision**: FIXED

### F6 — Phase 4 promised a cleanup FR-053 forbids

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 — `e2e/tooth-chart.spec.ts`
- **Detail**: Risk #8 needs the patient page, which needs an approved quote, which FR-053
  makes immutable. The spec cannot delete what it creates.
- **Fix**: Follow `patient-link-content.spec.ts:17-20` — unique stamp, assert only on its
  own quote, no cleanup; rows swept by the session's closing SQL.
- **Decision**: FIXED

### F7 — Phase 2 carries a lot

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 2
- **Detail**: Component, tooltip, legend, patient page, lint-rule edit, print CSS and three
  documentation files in one phase and one commit.
- **Fix**: None applied — the phase shape is fixed by the session's step list, and the
  documentation half is short. Noted so the implementer can commit it in two steps if the
  phase runs long.
- **Decision**: ACCEPTED
