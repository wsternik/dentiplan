<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Visit planning prefill

- **Plan**: `context/changes/visit-planning-prefill/plan.md`
- **Mode**: Deep
- **Date**: 2026-09-06
- **Verdict**: REVISE → SOUND after fixes
- **Findings**: 0 critical, 4 warnings, 1 observation

## Verdicts

| Dimension             | Verdict | After fixes |
| --------------------- | ------- | ----------- |
| End-State Alignment   | WARNING | PASS        |
| Lean Execution        | PASS    | PASS        |
| Architectural Fitness | PASS    | PASS        |
| Blind Spots           | WARNING | PASS        |
| Plan Completeness     | WARNING | PASS        |

## Grounding

13/13 claimed paths exist; `src/lib/llm/visits.ts` correctly absent; Progress
25/25 criteria mapped to phase bullets, no stray checkboxes, phase headings match;
brief↔plan consistent. Blast radius outside `src/lib/llm/`: two consumers —
`QuoteEditor.tsx:27-28` (`mergePrefill` + a type-only `PrefillResult`) and
`parse.ts:20-21` (`parseDiagnosis`, `anthropicModel`). Both pass the prefill
through without inspecting `generalItems`, so phase 3's contract widening does not
reach them. FR-014 / FR-015 / FR-033 each appear 0 times in the PRD — free.

## Findings

### F1 — The warnings block is headed "what we failed to read", and this change fills it with "what we proposed"

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Desired End State; every phase that adds a warning
- **Detail**: `ParseWarnings.tsx:28` reads _"Z notatki nie udało się odczytać
  wszystkiego:"_, and the group is labelled _"Ostrzeżenia z wypełniania notatki"_
  (`:26`). Accurate while every entry was a phrase we could not place. The plan
  routes the inferred-urgency notice and every `rationale` into the same list —
  and the session's acceptance criterion is that those get read. Under a heading
  announcing failures they read as defects and get skimmed, which is the exact
  failure mode risk #11 describes. No phase touched the component.
- **Fix**: Add a change entry to phase 1 rewriting the heading and `aria-label` to
  cover both kinds of entry. Text only — no markup or layout change, so the
  position-keyed list and the component's structure stay as they are.
  - Strength: Restores the acceptance criterion to something a reader can actually
    act on, for two strings.
  - Tradeoff: Puts one `src/components/` file into phase 1, which has to be
    reflected in the phase's E2E statement.
  - Confidence: HIGH — the strings are unreferenced anywhere else in `src/` or `e2e/`.
  - Blind spot: The final wording is a judgment call the dentystka may want to
    change; it is one string when she does.
- **Decision**: FIXED — added as phase 1 change #6, with criteria 1.6 and 1.7.

### F2 — `orderVisits`' return shape was left as "if phase 3 needs it"

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 §2
- **Detail**: The contract said the function "returns a `Map<number, number>` too
  if phase 3 needs it — otherwise keep the return shape minimal." Phase 3 then
  requires exactly that map to remap general items. An unresolved signature the
  implementer has to guess at, and a signature change in phase 3 if guessed wrong.
- **Fix**: Pin the return as
  `{ visits; teeth; renumbered: Map<number, number> }` in phase 1 and reference
  `renumbered` from phase 3.
- **Decision**: FIXED.

### F3 — A manual mutation check was filed under Automated Verification

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1, Success Criteria
- **Detail**: "The invariant test fails when `label` is restored — verify by
  breaking it once, then reverting" has no runnable command. A good check in the
  wrong half; an agent working the Automated list would either skip it or invent
  a command.
- **Fix**: Move to Manual Verification, phrased as the mutation it is.
- **Decision**: FIXED — now criterion 1.5.

### F4 — Phases 1 and 2 are not independently correct, and the plan did not say so

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Implementation Approach
- **Detail**: After phase 1 the schema _requires_ `urgencyFromNote` and
  `rationale`, while the prompt still says "propose visits only when the note
  suggests them" (`prompt.ts:43`) and explains neither field. Structured output
  forces the model to emit values it has no basis for, so the inferred-urgency
  warning is confidently wrong until phase 2 lands. Nothing reaches production in
  that state — all four phases merge in one PR — but "code first, prompt second"
  reads as if the phases were separable, and an implementer might judge phase 1 by
  pressing the button.
- **Fix**: State in Implementation Approach that phases 1 and 2 are inseparable,
  that neither may be cut, and that phase 1 must not be judged by trying the
  button.
- **Decision**: FIXED.

### F5 — A proposed visit can arrive empty after deduplication

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 / `merge.ts:56-62`
- **Detail**: If every tooth of a proposed visit is already in the form, the merge
  still appends the visit — now carrying a label. `computeQuoteTotals` keys
  `perVisit` on the items present rather than on `content.visits` (`cost.ts:104`),
  so the visit shows in `VisitList` and nowhere in `TotalsPreview`. Pre-existing
  behaviour; this change multiplies visits and so multiplies the odds.
- **Fix**: Suppressing it means either dropping visits that came back empty (which
  would fight the additive rule the moment she wanted to fill one in herself) or
  recomputing labels after the merge (which moves label logic into the merge). Both
  cost more than the wart.
- **Decision**: ACCEPTED — recorded in the brief's Open Risks. She removes an empty
  visit with one click (FR-031).
