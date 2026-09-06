---
date: 2026-09-06T07:21:53+02:00
researcher: Claude Opus 5
git_commit: a52161b5508410215bdde73c520dda14fa17a673
branch: feat/visit-planning-prefill
repository: dentiplan
topic: "Where visit ordering enters the prefill pipeline, what mergePrefill does with generalItems, and how computeQuoteTotals derives a visit's partial cost"
tags: [research, codebase, llm-prefill, visits, cost-engine, content-invariant]
status: complete
last_updated: 2026-09-06
last_updated_by: Claude Opus 5
---

# Research: the visit axis of the note prefill

**Date**: 2026-09-06T07:21:53+02:00
**Researcher**: Claude Opus 5
**Git Commit**: a52161b5508410215bdde73c520dda14fa17a673
**Branch**: feat/visit-planning-prefill
**Repository**: dentiplan

## Research Question

Three questions, fixed in advance by the change's scope — internal only, no new
library, so no external/Context7 leg:

1. Where exactly, in `parse-diagnosis.ts` and `merge.ts`, does visit _ordering_
   enter — and what already renumbers visits today?
2. What does `mergePrefill` currently do with `generalItems`?
3. How does `computeQuoteTotals` derive a visit's partial cost?

## Summary

**Visit numbering is already remapped twice, in two places, for two different
reasons — and neither of them orders visits.** `mapParsedDiagnosis` validates a
tooth's `visitNumber` against the set of visits the model declared and nulls it
when it points at nothing (`parse-diagnosis.ts:92-96`); `mergePrefill` then
renumbers the prefilled visits to continue the sequence the dentystka already
has, remapping each tooth through an explicit old→new map rather than an offset
(`merge.ts:56-75`). Both layers treat the model's numbers as _input_. A pure
`orderVisits` slots cleanly **between** them — at the end of `mapParsedDiagnosis`,
before the result crosses the endpoint — because `mergePrefill`'s remap preserves
the relative order of `prefill.content.visits` and would carry any ordering
decision through untouched. Putting `orderVisits` inside `mergePrefill` would
instead reorder visits the dentystka typed herself, which the additive rule
forbids.

**`mergePrefill` throws the general items' visit away.** `merge.ts:87` writes
`visitNumber: null` as a literal, and it has nothing better available: the
prefill contract carries general items as bare `PricelistItemRef[]`
(`schema.ts:60`), with no visit and no id. The whole path from prompt
(`generalItemIds`, `schema.ts:44`) through `mapParsedDiagnosis`
(`parse-diagnosis.ts:110-124`) to the merge is id-only, so FR-032's "a visit's
partial cost includes the general items associated with it" is unreachable from
a prefill today. That is exactly the p3 phase, and it is a three-layer change,
not a one-line one.

**The cost engine is already right and needs no change.** `computeQuoteTotals`
buckets by `visitNumber` through one `accumulate` closure that treats teeth and
general items identically (`cost.ts:107-119`) — a general item with a
`visitNumber` lands in that visit's bucket today. So p3 is purely about getting a
number into `GeneralItem.visitNumber`; every consumer downstream of that field
already works, including `TotalsPreview` (`TotalsPreview.tsx:16-24`).

**The `label` hole is real and reachable in three hops.** The model writes
`visits[].label` (`schema.ts:45`), `mapParsedDiagnosis` copies it verbatim into
the content tree (`parse-diagnosis.ts:61`), and `VariantComparison.astro:34`
renders it to whoever holds the patient link. It is the same class of hole S7
closed for `note`, and the two are one line apart in the same function.

## Detailed Findings

### 1. Visit ordering — the two existing remap layers

**Layer one, `mapParsedDiagnosis` (`src/lib/llm/parse-diagnosis.ts:61-96`).** It
builds `declaredVisits` as a `Set` of the numbers the model declared, then per
tooth applies two rules in order:

- FR-030: `status === "in-plan" && visitNumber !== 0` — an `uncertain` or
  `out-of-current-plan` tooth the model assigned anyway is nulled **silently**,
  by design (`parse-diagnosis.ts:89-92`, comment: "that is the rule working, not
  a problem she needs to hear about"). The change's "ząb `uncertain` przypisany
  przez model → odcięty bez hałasu" fixture asserts behaviour that already
  exists; the fixture is new, the code is not.
- A number not in `declaredVisits` → nulled **with** a warning
  (`parse-diagnosis.ts:93-96`).

Visits themselves pass through unfiltered and unordered:
`parsed.visits.map((v) => ({ number: v.number, label: v.label }))`
(`parse-diagnosis.ts:61`). There is no dedup on visit numbers, no cap, and no
sort. Two visits sharing a number would both survive and both collide as React
keys in `VisitList.tsx:24` — not a new problem, but a new one to think about once
the model is asked to produce _more_ visits.

**Layer two, `mergePrefill` (`src/lib/llm/merge.ts:56-75`).** Prefilled visits are
appended after the dentystka's own and renumbered `visits.length + 1` upward, and
each prefilled tooth follows its visit through `renumbered: Map<number, number>`.
The comment at `merge.ts:51-55` is the load-bearing one: remapping is by the
visit's **own** number and never by a positional offset, because nothing in the
schema or prompt makes the model number `1, 2, 3` in order — a defect already
caught once. `merge.test.ts:96` pins it ("the model may not count from 1").

**Consequence for `orderVisits`.** Because layer two is order-preserving over
`prefill.content.visits`, `orderVisits` applied at the end of
`mapParsedDiagnosis` composes: it renumbers 1..n by urgency, the merge then
shifts that block past the existing visits keeping the relative order, and the
teeth follow through the map both times. The invariant to state in the plan is
that `orderVisits` runs **once, server-side, on the prefill only** — never over
`tree.visits`.

**Urgency ranking input.** `Urgency` is `"urgent" | "moderate" | "mild"`
(`types.ts:42`) and `ToothEntry.urgency` is **nullable** (`types.ts:109`) — the
`unknown` sentinel becomes `null` in `orNull` (`parse-diagnosis.ts:30-32`). So a
visit's rank has to cope with a fourth, unranked state, and the "przy remisie
zostaje kolejność od modelu" rule means the sort must be **stable** — `Array.sort`
is stable in every engine this app runs on (V8, workerd), so a plain comparator
returning 0 on a tie is enough; no index-carrying decoration needed.

**Third numbering layer, in the browser.** `QuoteEditor.removeVisit`
(`QuoteEditor.tsx:179-187`, quoted at lines 76-86 of the extract) renumbers the
remaining visits `i + 1` and remaps **both** teeth and general items through the
same map. This is the one place that already treats `GeneralItem.visitNumber` as
a first-class reference — evidence that p3 does not need new plumbing in the
editor, only a value flowing in.

### 2. What `mergePrefill` does with `generalItems`

`src/lib/llm/merge.ts:77-88`:

```ts
const present = new Set(tree.generalItems.map((g) => g.item.id));
for (const item of prefill.content.generalItems) {
  if (present.has(item.id)) { warnings.push(…); continue; }
  present.add(item.id); seed += 1;
  generalItems.push({ id: `g-${seed}`, item, visitNumber: null });   // ← the hardcode
}
```

Three separate facts sit behind that `null`:

- **The wire schema has no visit for a general item.** `generalItemIds:
z.array(z.string())` (`schema.ts:44`) — ids only.
- **The prefill result has no visit either.** `PrefillResult.content.generalItems`
  is `PricelistItemRef[]` (`schema.ts:60`). The comment at `schema.ts:51-55`
  explains why they are _ref-only, id-less_: the editor owns the `g-<n>` sequence
  (`QuoteEditor.tsx:194`, `generalCounter`) and seeds it past whatever a reopened
  draft restored, so minting ids server-side would risk a collision. **That
  reason is about `id`, not about `visitNumber`** — so p3 should widen the type to
  `{ item: PricelistItemRef; visitNumber: number | null }[]` and leave id-minting
  in the merge exactly where it is.
- **`mapParsedDiagnosis` dedups general items by id** (`parse-diagnosis.ts:111-124`)
  and warns on a repeat. With visits attached, "the same item twice, in two
  different visits" becomes a legitimate reading (hygiene at visit 1 and visit 4)
  that the current dedup would silently collapse to one. p3 has to decide that
  explicitly; the merge's own duplicate check (`merge.ts:81`) has the same shape
  and the same question.

`GeneralItem.visitNumber` itself is already fully wired: nullable in the domain
type (`types.ts:133`), accepted by the write payload
(`quote-payload.ts:54`, `:102`), editable in the UI through a select
(`GeneralItems.tsx:36-51`), and remapped on visit removal. Only the prefill path
is blind to it.

### 3. How `computeQuoteTotals` derives a visit's partial cost

`src/lib/quote/cost.ts:100-123`. One map, one closure, two loops:

```ts
const accumulate = (visitNumber, cost) => {
  standardGrandTotal = addRanges(standardGrandTotal, cost);
  if (visitNumber !== null) perVisitMap.set(visitNumber, addRanges(perVisitMap.get(visitNumber) ?? ZERO_RANGE, cost));
};
for (const tooth of inPlanTeeth) accumulate(tooth.visitNumber, sumItems(tooth.pricelistItems));
for (const general of content.generalItems) accumulate(general.visitNumber, priceToRange(general.item.price));
```

Points that matter to this change:

- **Only `in-plan` teeth contribute** (`cost.ts:101`); general items contribute
  unconditionally. So an `uncertain` tooth the model parked in a visit would not
  move any money even if FR-030 did not null it first — the FR-030 rule is about
  the form's meaning, not the arithmetic.
- **`perVisit` is keyed by the numbers actually present on items, not by
  `content.visits`** (`cost.ts:104`, `:121`). A visit with no teeth and no general
  items simply does not appear in `perVisit`, and `TotalsPreview.tsx:16` renders
  "Brak pozycji przypisanych do wizyt." only when the whole array is empty. A
  proposed empty visit is therefore invisible in the totals but visible in
  `VisitList` — worth a thought for the visit-ceiling behaviour.
- **`perVisit` is sorted by visit number** (`cost.ts:121-123`), so once
  `orderVisits` makes number 1 the most urgent visit, the totals panel reads in
  urgency order for free.
- **The anesthesia variant ignores visits entirely** (`cost.ts:126-135`): one sum
  over all in-plan teeth plus all general items plus the fee. This is the
  mechanical reason the change's "narkoza is not a split variant" decision is
  already true in code — collapsing the standard plan to one visit would not
  change the anesthesia number by a grosz, it would only destroy the standard
  plan. Nothing needs to be built to enforce it; the prompt rule is the whole job.

### 4. The `label` hole, end to end

| Hop | Location                                            | What happens                                                                                                           |
| --- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | `src/lib/llm/schema.ts:45`                          | `visits: z.array(z.object({ number, label: z.string() }))` — model-authored free text, no `.describe()`, no constraint |
| 2   | `src/lib/llm/parse-diagnosis.ts:61`                 | copied verbatim into `content.visits[]`                                                                                |
| 3   | `src/lib/services/quote-payload.ts:64`, `:105`      | `visits: z.array(VisitSchema)` passes the label through to the stored `content` unchanged                              |
| 4   | `src/components/patient/VariantComparison.astro:34` | `visit && visit.label.length > 0 ? visit.label : \`Wizyta ${n}\`` — rendered to anon                                   |

Hop 4 is the one that makes this a contract bug rather than a style preference:
`get_quote_by_token` returns `content` byte-for-byte to `anon`
(`types.ts:10-14`; `docs/reference/contract-surfaces.md:76-87`), and hop 1 is the
model holding the pen. S7 closed the identical path for `note` — the fix is
`parse-diagnosis.ts:103-104` (`note: ""`, with the reason in a comment) and the
guard is `parse-diagnosis.test.ts:142` ("never lets the model write a
patient-visible note").

**Two documents assert the closed state and will go stale:**

- `docs/reference/contract-surfaces.md:92-101` — "The model cannot write `note`"
  and "the names and prices that end up in `content` are the surgery's, not the
  model's". Both become true-but-incomplete the moment `label` leaves the schema,
  and false-by-omission if it does not.
- `src/lib/llm/schema.ts:14-19` — the "NO `note`" rationale block, which is where a
  future reader will look for "why can't the model name a visit?".

**A trap for the invariant test.** "No string from the model's answer appears in
`content`" cannot be asserted literally: `pricelistItemIds` are model-authored
strings, and `resolvePricelistItem` puts the _same_ id into
`PricelistItemRef.id` (`parse-diagnosis.ts:53`, `resolver.ts`). The id matches by
construction because it was validated against the seed — that is the point. The
assertion has to be over the model's **free-text** fields only (today: `warnings`
and, after this change, `rationale`), plus a positive check that every
`content.visits[].label` is a member of the closed dictionary.

### 5. What the label dictionary can be derived from

The proposed vocabulary — "Leczenie pilne", "Leczenie zachowawcze", "Leczenie
kanałowe", "Ekstrakcje", "Higienizacja" — maps onto data the tree already carries,
with no pricelist lookup needed:

- `TreatmentType` is `extraction | root-canal | caries-removal | filling | other`
  (`types.ts:38`) → covers "Ekstrakcje", "Leczenie kanałowe", "Leczenie
  zachowawcze".
- `Urgency.urgent` (`types.ts:42`) → "Leczenie pilne".
- "Higienizacja" is the only entry that needs a **general item**, and general
  items only acquire a visit in **p3** — which the change names as the first
  phase to cut. So the dictionary function must be total without p3 (a visit
  whose teeth are empty falls back rather than throwing), and the "Higienizacja"
  branch is dead code until p3 lands. Worth stating in the phase contract rather
  than discovering during review.
- `src/lib/quote/labels.ts` already holds `TREATMENT_LABELS` / `URGENCY_LABELS`
  (used by `ToothGroups.astro:17`) — the visit-label dictionary is a sibling of
  that file, not a new concept.

Note the seed's tooth catalog carries no `extraction`/`root-canal` classification
of its own — the category prefix in an id (`chirurgia-stomatologiczna:…`,
`leczenie-kanalowe:…`) correlates but is not the domain field. Deriving the label
from `treatmentType` keeps the dictionary independent of pricelist edits.

### 6. Fixtures, tests, and what the schema change breaks

Four fixtures exist (`src/lib/llm/fixtures/`): `clean.json`,
`out-of-range-tooth.json`, `uncertain-marker.json`, `unknown-pricelist-id.json`.
Each is `ParsedDiagnosisSchema.parse`d inside the test, deliberately — "that step
is part of the assertion, not setup" (`parse-diagnosis.test.ts:1-16`).

Consequences of the p1 schema change, in the order they will bite:

- Adding **required** `rationale` and `urgencyFromNote` makes all four fixtures
  fail `ParsedDiagnosisSchema.parse` immediately. Every fixture must be migrated
  in p1; this is the mechanism by which "the tests light up on the code, not on
  the model" actually happens.
- Removing `label` does **not** fail anything on its own — Zod object schemas are
  non-strict and strip unknown keys, so a stale `label` in a fixture disappears
  silently. Only the positive dictionary assertion catches a regression here.
- `merge.test.ts` builds its `PrefillResult`s inline (`merge.test.ts:42-149`,
  7 cases), so a change to `PrefillResult.content.generalItems` in p3 is a
  compile-time break across that file — cheap and loud, which is what we want.
- `prompt.test.ts` (3 cases) asserts rule _presence_ by substring/regex over
  `buildInstructions()` (`prompt.test.ts:20-47`). The p2 grouping-rule assertions
  have an existing shape to copy — and an existing weakness to avoid repeating:
  `prompt.test.ts:47` matches a regex alternation of phrasings, which passes as
  long as _someone_ wrote _something_ nearby. For rules the dentystka will edit
  (B12), asserting a substring she is likely to reword makes her edit turn the
  suite red for no defect. Prefer asserting the structural markers (a numbered
  rule exists under a "grouping" heading, the ceiling numeral is present) over
  her prose.

### 7. Where the ceiling and the counts are not specified

The change fixes "sufit: 5 wizyt; więcej → ostrzeżenie zamiast rozdrabniania" as a
**prompt** rule. Nothing in the current code caps anything, and the fixture
"propozycja ponad sufit" implies a deterministic code-side behaviour that the
brief does not name. The three candidates are: warn and keep all visits; warn and
merge the tail into the last visit; warn and drop the excess visits (which would
orphan their teeth into `visitNumber: null` via the existing
`declaredVisits` check at `parse-diagnosis.ts:93`). Only the first is consistent
with "prefill nigdy nie kosztuje jej pracy" — but it is a decision `/10x-plan`
must make explicitly, not inherit.

## Code References

- `src/lib/llm/schema.ts:42-47` — the wire contract; `visits[].label` and `generalItemIds` both change here
- `src/lib/llm/schema.ts:14-19` — the "no `note`" rationale that `label` must join
- `src/lib/llm/schema.ts:51-61` — why `PrefillResult.generalItems` carries no ids (about `id`, not `visitNumber`)
- `src/lib/llm/parse-diagnosis.ts:61` — visits copied through, label included, unordered
- `src/lib/llm/parse-diagnosis.ts:89-96` — FR-030 silent null, then the declared-visit check with a warning
- `src/lib/llm/parse-diagnosis.ts:110-124` — general items resolved by id, deduped, no visit
- `src/lib/llm/merge.ts:51-75` — the order-preserving old→new visit remap, and why it is not an offset
- `src/lib/llm/merge.ts:87` — `visitNumber: null` hardcoded
- `src/lib/quote/cost.ts:104-123` — `perVisit` bucketing; teeth and general items go through one closure
- `src/lib/quote/cost.ts:126-135` — anesthesia total ignores visits entirely
- `src/components/admin/QuoteEditor.tsx:179-187` — browser-side renumbering that already remaps general items
- `src/components/admin/QuoteEditor.tsx:276-282` — `applyPrefill`, the whole merge surface in the component
- `src/components/patient/VariantComparison.astro:33-34` — where a model-written label reaches the patient
- `src/components/admin/TotalsPreview.tsx:16-27` — per-visit rendering, driven entirely by `perVisit`
- `src/lib/quote/labels.ts` — the existing label dictionaries the visit vocabulary should sit beside
- `docs/reference/contract-surfaces.md:76-101` — the `content` invariant and its "model cannot write" list

## Architecture Insights

- **The model states facts; code writes sentences.** Every user-visible string in
  the prefill path is composed in `parse-diagnosis.ts` from validated values
  (`Ząb ${n}: …`), and the model's free text is confined to `warnings`. The
  change extends the pattern rather than inventing it: `rationale` is a fact
  channel that happens to be prose, and it must land in `warnings` for the same
  reason `note` was cut.
- **Model numbers are input, never output.** Stated twice in comments
  (`merge.ts:51-55`, `schema.ts:6-12`) and enforced in three places. `orderVisits`
  is the third instance of a rule the codebase already believes.
- **Purity is deliberate and load-bearing.** `parse-diagnosis.ts:16-18` and
  `client.ts:1-7`: `astro:env` lives only in `client.ts`, imported type-only
  elsewhere, because vitest has no stub for it. `orderVisits` and the label
  dictionary must stay in that pure graph — a stray import would take the whole
  suite down before the first assertion, and the failure would look unrelated.
- **Warnings are the product, not the exhaust.** FR-012 is implemented as "drop
  and name", and `ParseWarnings.tsx` renders the list as its own labelled group.
  The session's acceptance criterion — inferred urgency must be named — is the
  same mechanism, so it costs a `push`, not a feature.

## Historical Context (from prior changes)

- `context/archive/2026-09-05-llm-parsing-prefill/` — S-02. Established the
  fixture-not-live-API testing stance, the "drop and name" rule, and the `note`
  excision. Risk #7 in `context/foundation/test-plan.md:45-68` is its risk;
  phase 5 ("Note prefill boundary") is marked complete.
- `context/archive/2026-09-05-ui-redesign/` — S8. Gave `QuoteEditor` a **sticky**
  action bar; `context/foundation/lessons.md` carries four rules from it, of which
  "do not dim a container whose controls are still live" is the one this change
  can trip: a visit block shown as "proposed by the model" must not be dimmed
  while its selects still work.
- `context/foundation/test-plan.md:215` — the standing decision not to E2E the
  prefill: a browser verdict would require a paid, non-deterministic call to
  Anthropic, and what this repo owns is the mapping. This change is squarely
  inside "the mapping" and does not disturb that reasoning.

## Related Research

- `context/archive/2026-09-05-llm-parsing-prefill/research.md` — the prefill
  pipeline as it was designed; this document is its visit-axis sequel.

## Open Questions

1. **Ceiling behaviour in code** (§7): warn-and-keep, warn-and-merge, or
   warn-and-drop. `/10x-plan` decides; warn-and-keep is the only option
   consistent with the additive rule.
2. **The same general item in two visits.** Both dedup sites
   (`parse-diagnosis.ts:113`, `merge.ts:81`) key on item id alone. Once general
   items carry a visit, is "higienizacja at visit 1 and visit 4" a duplicate or
   two items? p3's answer changes the dedup key.
3. **Duplicate visit numbers from the model.** Not checked anywhere today
   (`parse-diagnosis.ts:61-62` builds a `Set` from them but never validates the
   array against it). Asking the model for more visits makes a collision more
   likely, and it lands as two `VisitList` rows sharing a React key.
4. **`urgencyFromNote` must not reach `content`.** It is a per-tooth field on the
   _wire_ shape only; `ToothEntry` (`types.ts:106-114`) must not gain it, or the
   patient page inherits a field about the dentystka's reasoning. The mapper
   consumes it into a warning and drops it — worth an explicit assertion, since
   the natural implementation is a spread.
