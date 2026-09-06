<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Visit planning prefill

- **Plan**: `context/changes/visit-planning-prefill/plan.md`
- **Scope**: Phases 1–4 of 4 (all Progress criteria `[x]`)
- **Date**: 2026-09-06
- **Verdict**: NEEDS ATTENTION → APPROVED after fixes
- **Findings**: 0 critical, 3 warnings, 3 observations

## Verdicts

| Dimension           | Verdict | After fixes |
| ------------------- | ------- | ----------- |
| Plan Adherence      | WARNING | WARNING     |
| Scope Discipline    | PASS    | PASS        |
| Safety & Quality    | WARNING | PASS        |
| Architecture        | PASS    | PASS        |
| Pattern Consistency | PASS    | PASS        |
| Success Criteria    | WARNING | WARNING     |

## Grounding

Every file the plan named is in the diff and matches its stated intent; nothing is
in the diff that the plan did not describe, beyond the change folder's own
process artifacts. The "What We're NOT Doing" list holds: `src/types.ts` is
untouched (`Visit.label` still exists and is still editable via
`VisitList.tsx:29`), no component other than `ParseWarnings.tsx` was touched, no
E2E spec was added, `rationale` never enters `content` and so never reaches the
database.

Automated verification re-run rather than taken from the Progress boxes:
`npm test` 83/83 · `npx astro check` 0 errors · `npm run lint` clean ·
`npm run test:e2e` 5/5 in the first pass (12 s, no spec changes) · FR-014,
FR-015, FR-033 each defined once in the PRD.

## Findings

### F1 — The invariant test names two free-text fields by hand instead of catching every new one

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/lib/llm/parse-diagnosis.test.ts:252`
- **Detail**: The corpus was
  `[...parsed.warnings, ...parsed.visits.map((v) => v.rationale)]` — the two
  fields that existed the day it was written. Add `clinicalSummary: z.string()`
  to `ParsedToothSchema` tomorrow and spread `...tooth` into the pushed entry,
  and a new model-authored sentence reaches `content` with the test still green.
  This is precisely the gap the lessons entry written in this same change forbids:
  "leave behind an assertion that fails when a new one appears — a positive check
  that the visible string is a member of a closed dictionary, not a negative check
  that one known field is gone." The positive half (labels ∈ `VISIT_LABELS`) was
  delivered; the negative half stayed field-by-name.
- **Fix**: Walk the parsed answer for every string with its path, and invert the
  check: `MAY_REACH_CONTENT` allowlists the paths whose strings legitimately
  appear in `content` (the three closed enums, `pricelistItemIds`, a general
  item's `id`); everything else must not appear. A field added tomorrow is
  covered by default, and the failure message names the path.
  - Strength: Fail-closed. Proved by mutation — adding `clinicalSummary` to the
    schema and copying it into `note` fails with
    `teeth[].clinicalSummary reached content`, on a field that did not exist when
    the assertion was written.
  - Tradeoff: The allowlist is now a thing to maintain; adding to it is the
    deliberate act, which is the point.
  - Confidence: HIGH — mutation-tested in both directions, 83/83 after revert.
  - Blind spot: A future free-text field whose value happens to be a substring
    of an allowlisted one would slip through `toContain`; so would an empty
    string, which cannot carry meaning anyway.
- **Decision**: FIXED.

### F2 — Criteria 2.5, 2.6 and 3.5 are ticked without a model call ever being made

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: `plan.md:675`, `plan.md:676`, `plan.md:690`
- **Detail**: All three read as live checks — "With a real key configured, a
  made-up six-tooth note … produces 2–3 visits", "A note saying «wszystko w
  jednym znieczuleniu ogólnym» produces one visit and the anesthesia warning",
  "In the editor after a prefill, a proposed general item shows its visit". The
  session's own handoff records zero model calls and zero spend. They are the
  only criteria in the plan that test what phase 2 is for: whether the model
  actually applies the new grouping rules. What is proved today is that the
  prompt contains the rules and that the mapper handles a recorded answer
  correctly — not that the two meet.
- **Fix**: Run the three manual steps against the live endpoint (plan's Manual
  testing steps 1–5), then clean up the production rows with SQL per FR-053.
  - Strength: It is the only thing that closes the phase-1/phase-2 seam the plan
    itself calls inseparable.
  - Tradeoff: Costs a paid, non-deterministic call.
  - Confidence: HIGH — the gap is a fact, not an inference.
  - Blind spot: One live run proves the model can follow the rules, not that it
    reliably does.
- **Decision**: ACCEPTED — deferred with reason. B10 (the spending cap) is an
  open user decision and this stage has no mandate to spend against it. Carried
  to the handoff and named in the PR body so it is not merged as silently
  verified. The deterministic layer this project owns is unaffected:
  `test-plan.md:215` is a standing decision not to put the prefill behind a
  browser verdict for exactly this reason.

### F3 — "Higienizacja" sits in the closed dictionary and nothing can produce it

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `src/lib/llm/visits.ts:33`, `visits.ts:63`
- **Detail**: Phase 1's contract said "the empty-teeth branch is where phase 3
  adds _Higienizacja_". Phase 3 landed and the branch still returns `""`:
  `visitLabel` takes teeth only, so a visit carrying a hygiene general item and
  no teeth is unnamed, and one member of `VISIT_LABELS` is unreachable. In
  practice the prompt sends hygiene to visit 1, which normally holds the urgent
  teeth and is therefore named from them — the gap needs the model to declare a
  visit made of general items alone.
- **Fix**: Widen `visitLabel` / `orderVisits` to take the visit's general items
  and name a teeth-less hygiene visit from them.
  - Strength: Closes the phase-1 promise and makes the dictionary honest.
  - Tradeoff: It is a signature change on the phase-3 contract plus its tests —
    a feature increment, not a review fix.
  - Confidence: MEDIUM — the label is right, but which general items count as
    "hygiene" is a clinical mapping nobody has specified.
  - Blind spot: It overlaps B12; she may want the rule stated in the prompt
    rather than in code.
- **Decision**: ACCEPTED — deferred with reason. Fixing it properly means
  widening a phase-3 signature, which is outside the boundary this review stage
  declared (review fixes, not feature increments), and the "which item is
  hygiene" question belongs with B12. Recorded in the follow-ups file.

### F4 — Criterion 3.4 is satisfied somewhere other than where the plan put it

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `src/lib/llm/merge.test.ts:188`
- **Detail**: The plan said a cost assertion "already exists in spirit
  (`cost.test.ts:117`) — extend rather than duplicate". `cost.test.ts` is
  untouched; the assertion was written in `merge.test.ts` instead, where it runs
  `computeQuoteTotals` over `mergePrefill`'s output and proves exactly what the
  criterion asks — a prefilled general item's price landing in its visit's
  `perVisit` entry.
- **Fix**: None needed; the assertion is arguably better placed, since what is
  under test is the prefill path rather than the cost engine.
- **Decision**: DISMISSED — the criterion is met substantively; only its address
  moved.

### F5 — `orderVisits` resolves a duplicate visit number the opposite way from its caller

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/lib/llm/visits.ts:87`
- **Detail**: `renumbered.set(visit.number, …)` overwrites, so within
  `orderVisits` a repeated number resolves to the last entry, while
  `parse-diagnosis.ts:69-79` drops duplicates on the rule that the first wins.
  Unreachable today — the one caller dedupes before calling — but the exported
  pure function's contract said nothing about it, so a second caller would find
  the trap by having teeth land in the wrong visit, silently.
- **Fix**: State the input contract in the doc comment: duplicates are the
  caller's responsibility, the map is keyed on the number, `parseDiagnosis`
  drops them first-wins before calling.
- **Decision**: FIXED — documented rather than defended in code, because a
  defensive dedupe inside `orderVisits` would put the "first wins" rule in two
  places and let them drift.

### F6 — `rationale` and `warnings` have no length bound

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/lib/llm/schema.ts:59`
- **Detail**: A 50 KB `rationale` is composed verbatim into a warning
  (`parse-diagnosis.ts:193`) and rendered in a single `<li>`
  (`ParseWarnings.tsx:41-43`). Degrades the admin list; no crash, no patient
  surface.
- **Fix**: Cap the string in the schema, or truncate at composition.
- **Decision**: DISMISSED — the shape predates this change (`warnings` has always
  been unbounded), the surface is hers alone, and a cap invented here would be a
  number nobody chose.

## Triage summary

```
  Fixed:      F1, F5     (2)
  Accepted:   F2, F3     (2)
  Dismissed:  F4, F6     (2)
```

Post-fix gate: `npm test` 83/83 · `npx astro check` 0 errors · `npm run lint`
clean.
