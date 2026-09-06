# Visit planning prefill — plan brief

> Full plan: `context/changes/visit-planning-prefill/plan.md`
> Research: `context/changes/visit-planning-prefill/research.md`

## What & Why

The note prefill reads teeth but does not produce a **plan**. This change makes
the model propose the visit split — teeth grouped by clinical rule, visits ordered
so the most urgent are first, urgency filled in where the note gives evidence —
while taking every _sentence_ out of its hands. It closes the second half of
FR-011 ("proposed visit split"), which S-02 delivered half of.

The session's own risk states the reason for the second half: a split that looks
sensible and is medically wrong arrives pre-filled and confident, and therefore
gets approved unread. So naming what the model supplied on its own is the
acceptance criterion, not a decoration.

## Starting Point

`mapParsedDiagnosis` validates a tooth's visit against the model's declared list;
`mergePrefill` renumbers prefilled visits to continue the dentystka's own sequence.
Neither _orders_ anything, and visits only ever appear when the note happened to
declare them. Meanwhile `visits[].label` is written by the model, copied verbatim
into `content`, and rendered to anyone holding the patient link
(`VariantComparison.astro:34`) — the same hole S7 closed for `note`, one line away
in the same function. General items reach the form with `visitNumber: null`
hardcoded, so FR-032's per-visit partial cost is unreachable from a prefill.

## Desired End State

She pastes a note naming six teeth and no visits, presses the button, and gets a
schedule: visits 1..n with the most urgent first, teeth assigned, urgency filled
in, visit names drawn from a closed vocabulary the code owns — and a warnings list
that names every tooth whose urgency was inferred plus the model's own reasoning
for the split, in prose only she sees. Nothing she typed before pressing the button
is altered.

## Key Decisions Made

| Decision                  | Choice                                                                 | Why                                                                                                                                   | Source        |
| ------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| One call or two           | One call, extended schema                                              | A second planning round doubles cost and splits the reading from the plan                                                             | Session brief |
| Anesthesia variant        | Model never designs it                                                 | FR-041–FR-044 computes it from in-plan teeth; a collapsed standard plan would show the patient the same variant twice                 | Session brief |
| Visit numbering           | Model proposes groups, code numbers them                               | Model numbers are already treated as input in two places; this is the third                                                           | Session brief |
| Visit label               | Model loses `label`, gains `rationale`                                 | `label` reaches the patient page verbatim; `rationale` goes to warnings, which only she sees                                          | Session brief |
| Urgency                   | Inferred, but flagged per tooth and named in one code-composed warning | The model supplies the boolean, we write the sentence — S7 doctrine                                                                   | Session brief |
| Grouping rules            | In the prompt, not in code                                             | They are medical, not technical; the dentystka rewrites them in one sentence (**B12**)                                                | Session brief |
| Ordering placement        | `orderVisits` at the end of `mapParsedDiagnosis`                       | The merge's remap is order-preserving, so an ordering made upstream survives it; ordering inside the merge would reorder _her_ visits | Research      |
| Cost engine               | Untouched                                                              | `computeQuoteTotals` already buckets teeth and general items through one closure keyed on `visitNumber`                               | Research      |
| Ceiling behaviour in code | Warn and **keep** all visits                                           | Dropping them orphans their teeth into `visitNumber: null` and costs her the work the button saves                                    | Plan          |
| Duplicate general item    | Dedup stays keyed on item id                                           | Hygiene at visits 1 and 4 is real, but it is one dropdown for her and a dedup redesign for us — out of scope, to the handoff          | Plan          |
| Duplicate visit numbers   | First declaration wins, rest dropped with a warning                    | Two visits sharing a number are two `VisitList` rows sharing a React key                                                              | Plan          |

## Scope

**In scope:** the warnings block's own framing — the list that carries the
proposals is still headed "what we failed to read"; the wire schema (`label` out,
`rationale` + `urgencyFromNote` in); a
pure `visits.ts` owning ordering, the label dictionary and the visit ceiling;
code-composed warnings for every inferred value; the grouping and urgency rules in
the prompt; general items carrying a visit (FR-032); PRD FR-014/FR-015/FR-033,
roadmap slice S-09, test-plan risk #11.

**Out of scope:** per-field "proposed by the model" markers in `ToothRow`;
appointment dates and intervals; drag-and-drop between visits; a separate
anesthesia treatment set; a second model round; storing the reasoning in the
database; an E2E test of the prefill (standing decision, `test-plan.md:215`).

## Architecture / Approach

```
model answer ──▶ ParsedDiagnosisSchema ──▶ mapParsedDiagnosis ──▶ orderVisits ──▶ PrefillResult
   facts only        no label,                validate, drop,        rank by         content + warnings
                     + rationale,             compose warnings       urgency,             │
                     + urgencyFromNote                               renumber,            ▼
                                                                     label          mergePrefill (additive)
                                                                                          │
                                                                                          ▼
                                                                              QuoteEditor island state
```

Three numbering layers already exist and compose: the mapper validates against the
model's declared set, `orderVisits` renumbers 1..n by urgency, and the merge shifts
that block past the dentystka's own visits. The through-line is S7's doctrine —
**the model states facts, the code writes sentences** — extended to a field that
happens to be prose.

## Phases at a Glance

| Phase                                    | What it delivers                                                                   | Key risk                                                                                                                  |
| ---------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1. Code owns numbering, naming, warnings | Schema, `visits.ts`, rewritten mapper, migrated + new fixtures, the invariant test | `urgencyFromNote` reaching `content` via a spread; rationale warnings composed before ordering and naming the wrong visit |
| 2. Prompt asks for a plan                | Grouping rules, urgency evidence, ceiling, anesthesia prohibition                  | Prompt tests that freeze the dentystka's wording and go red when she edits a working rule                                 |
| 3. General items get a visit (FR-032)    | Wire contract widening, merge carries the visit through                            | The only contract _widening_ here — **first to cut**                                                                      |
| 4. Documents                             | PRD FR-014/015/033, roadmap S-09, test-plan risk #11, maybe a lesson               | FRs written as a description of the implementation rather than of the product                                             |

**Prerequisites:** none beyond `main` — S-02's pipeline and S8's editor are both in
place. Phase 2's manual check needs a configured `ANTHROPIC_API_KEY`.
**Estimated effort:** four phases, one commit each; phases 1 and 2 carry the weight.

## Open Risks & Assumptions

- **The central risk is not a bug, it is plausibility.** A green mapping test proves
  the split is _labelled_, never that it is _sensible_. The warnings are the only
  thing standing between a confident proposal and an unread approval — which is
  why "every inferred value is named" is the acceptance criterion.
- **The grouping defaults are a guess until the dentystka rewrites them** (**B12**).
  They live in the prompt precisely so that costs one sentence, and phase 2's tests
  assert structure rather than her prose so an edit does not turn the suite red.
- **Phase 3 assumes the UI needs no change.** `GeneralItems` already renders a visit
  select and the cost engine already buckets. If that turns out wrong, it is a
  finding for the phase notes, not a silent expansion.
- **A proposed visit can arrive empty.** If every tooth of a proposed visit is
  already in the form, the merge still appends the visit, now labelled — and
  `computeQuoteTotals` keys `perVisit` on items rather than on `content.visits`
  (`cost.ts:104`), so it shows in `VisitList` and nowhere in the totals.
  Pre-existing; this change multiplies visits and so multiplies the odds. Accepted
  — she deletes it with one click (FR-031).
- **Alignment with S12.** If the eval matrix ever runs, its corpus has to contain
  split cases, or it will grade a prompt on half of what the prompt now does.

## Success Criteria (Summary)

- A note that mentions no visits comes back as a schedule, with the urgent teeth in
  visit 1 and a name on every visit.
- Everything the model supplied without direct support in the note is named in the
  warnings she reads.
- No free-text string the model wrote reaches `content`, and every visit label is a
  member of the closed dictionary — asserted across every fixture.
