# Visit planning prefill — implementation plan

## Overview

The note prefill already reads teeth. It does not produce a **plan**: visits come
back only when the note happens to declare them, urgency comes back only when the
note states it outright, and the visit's name is a free-text string the model
writes straight through to the patient's page.

This change makes the model propose the split — visits grouped by clinical rule,
ordered so the most urgent teeth are in visit 1, urgency filled in wherever the
note gives evidence for it — while moving every _sentence_ out of the model's
hands. The model states facts; code numbers the visits, names them from a closed
dictionary, and composes every warning. Everything it proposed without direct
support in the note is named in the FR-012 warnings, because a split that arrives
pre-filled and looks confident is exactly the kind that gets approved unread.

Closes the second half of FR-011 ("proposed visit split"), which S-02 delivered
only half of.

## Current State Analysis

From `context/changes/visit-planning-prefill/research.md` (read it for file:line
detail; the load-bearing findings are repeated here):

- **Visit numbers are already remapped twice, and neither layer orders
  anything.** `mapParsedDiagnosis` nulls a tooth's `visitNumber` when it points
  at a visit the model never declared (`parse-diagnosis.ts:93-96`), and
  `mergePrefill` renumbers the prefilled visits to continue the dentystka's own
  sequence, remapping teeth through an explicit old→new map rather than an offset
  (`merge.ts:56-75`). Both treat the model's numbers as input. The merge's remap
  is **order-preserving**, so an ordering decision made upstream survives it.
- **The `label` hole is four hops long.** `schema.ts:45` (model writes it) →
  `parse-diagnosis.ts:61` (copied verbatim into `content`) →
  `quote-payload.ts:105` (stored) → `VariantComparison.astro:34` (rendered to
  anyone holding the patient link). `content` is returned byte-for-byte to `anon`
  by `get_quote_by_token` (`types.ts:10-14`). This is the same hole S7 closed for
  `note`, one line away in the same function.
- **The cost engine needs no change.** `computeQuoteTotals` buckets teeth and
  general items into `perVisit` through one shared closure (`cost.ts:107-119`),
  keyed on whatever `visitNumber` an item carries. `TotalsPreview` renders
  whatever that produces. A general item with a visit already works end to end —
  nothing has ever put a number there on the prefill path.
- **`mergePrefill` hardcodes `visitNumber: null`** (`merge.ts:87`) because the
  wire contract carries general items as bare ids (`schema.ts:44`) and the prefill
  result as bare refs (`schema.ts:60`). FR-032 is unreachable from a prefill.
- **The prompt currently says the opposite of what we want.** Rule 6:
  "Wizyty proponuj tylko wtedy, gdy notatka je sugeruje" (`prompt.ts:43`).
- **Purity is load-bearing.** `astro:env` lives only in `client.ts`; a stray
  import into the `parse-diagnosis.ts` graph takes the whole vitest suite down
  before the first assertion (`parse-diagnosis.ts:16-18`, `client.ts:1-7`).

## Desired End State

The dentystka pastes a note naming six teeth and no visits. She presses "Wypełnij
z notatki" and gets:

- **Visits**, 1..n, the one holding the most urgent teeth first, each named from a
  closed vocabulary the code owns.
- **Teeth assigned** to those visits, `uncertain` and `out-of-current-plan` ones
  left unassigned.
- **Urgency filled in** where the note gives evidence, `unknown` where it does not.
- **A warnings list that names what the model supplied on its own**: which teeth
  got an inferred urgency, and the model's own reasoning for the split, in prose
  only she sees.
- **Nothing she typed touched.** Existing teeth, visits and general items survive;
  duplicates are skipped and named.

Verify: `npm test` green; the invariant test proves no free-text model string
reaches `content`; on production, a made-up six-tooth note produces a visit split
with warnings naming the inferences.

### Key Discoveries

- `orderVisits` belongs at the **end of `mapParsedDiagnosis`**, server-side, over
  the prefill only — never over `tree.visits`, which are the dentystka's
  (`merge.ts:36`, additive rule).
- `Array.prototype.sort` is stable in V8/workerd, so "on a tie, keep the model's
  order" costs a comparator returning 0 — no index decoration.
- `ToothEntry.urgency` is **nullable** (`types.ts:109`); a visit's rank has to
  handle a fourth, unranked state.
- The label dictionary derives from `TreatmentType` (`types.ts:38`) and `Urgency`
  (`types.ts:42`) alone — no pricelist lookup — so it cannot drift when the
  pricelist is edited. `src/lib/quote/labels.ts` is the sibling file it belongs
  beside conceptually.
- Zod v4 objects **strip** unknown keys, so removing `label` fails no fixture on
  its own; only a positive dictionary assertion catches a regression. Adding
  **required** `rationale` / `urgencyFromNote` does fail all four fixtures
  immediately — which is the mechanism that makes phase 1 light up on the code.
- `GeneralItems.tsx:36-51` already renders a per-item visit select, and
  `QuoteEditor.removeVisit` already remaps general items. Phase 3 needs no new UI.

## What We're NOT Doing

- **Per-field "the model proposed this" markers in `ToothRow`.** The collective
  warning is the mechanism; it comes back if she says it is not enough.
- **Appointment dates, calendars, intervals between visits in days.**
- **Drag-and-drop of teeth between visits** — PRD non-goal, the dropdown is FR-030.
- **A second model round ("improve your own plan")** — one call, extended schema.
- **A separate anesthesia treatment set, or the model designing an anesthesia
  plan.** FR-041–FR-044 computes that variant from the in-plan teeth; the model
  must not collapse the standard plan to one visit to imitate it.
- **Storing the model's reasoning in the database.** `rationale` is a warning,
  it lives in island state and dies with the page.
- **An E2E test of the prefill.** Standing decision, `test-plan.md:215`: a browser
  verdict would need a paid, non-deterministic call to Anthropic. What we own is
  the mapping, and the mapping is pure.
- **Changing `Visit`, `ToothEntry`, `GeneralItem` or `QuoteContent`** in
  `src/types.ts`. `Visit.label` stays — the dentystka still edits it (FR-031).
  Only the _wire_ schema loses the field. No migration, no content-contract change.

## Implementation Approach

Four phases, in an order chosen so that each one fails loudly on its own:

1. **Code first, prompt untouched.** Every rule the code owns — ordering,
   numbering, labelling, warning composition, the `label` excision — lands
   against recorded fixtures while the prompt still asks for the old shape. The
   tests light up on our code, not on a model's mood. Driven by `/10x-tdd` on
   risk #11.
2. **Then the prompt**, once there is something for it to feed.
3. **Then general items with visits**, the one piece that is a genuine contract
   widening rather than a tightening. Cheapest to cut if the session runs long.
4. **Then the documents**, in the same session as the code.

The through-line is the S7 doctrine, extended rather than invented: _the model
states facts; the code writes sentences._ `rationale` is a fact channel that
happens to be prose, so it goes where `note` was not allowed to go — into
`warnings`, which only she reads.

## Critical Implementation Details

**Ordering must happen before the rationale warnings are composed.** A rationale
is addressed to a visit ("wizyta 2 to strona lewa"), and `orderVisits` changes
which visit is number 2. Compose those warnings from the _ordered_ list or they
will name the wrong visit — silently, and in prose that reads perfectly.

**`urgencyFromNote` must not reach `content`.** It is a field of the wire shape
only; `ToothEntry` never gains it. The natural implementation — spreading the
parsed tooth into the entry — would carry it straight into the patient-visible
tree. Build `ToothEntry` field by field, as `parse-diagnosis.ts:98-107` already
does, and assert the absence.

**The invariant test cannot assert "no model string appears in `content`"
literally.** `pricelistItemIds` are model-authored strings and the resolved
`PricelistItemRef.id` is equal to them by construction — that equality is the
point, since the id was validated against the seed. Assert over the model's
**free-text** fields (`warnings`, `rationale`) and add a positive check that every
`content.visits[].label` is a member of the closed dictionary.

## Phase 1: The code owns numbering, naming and warnings

### Overview

Extend the wire schema, add the pure ordering/labelling layer, and rewrite
`mapParsedDiagnosis`'s visit handling so that everything the dentystka reads is
composed by us. The prompt does not change in this phase.

Risk covered: **#11** — _a split that looks sensible and is medically wrong
arrives pre-filled and gets approved, because nothing distinguishes what the note
said from what the model supplied._ Driven test-first via `/10x-tdd`.

### Changes Required

#### 1. The wire contract

**File**: `src/lib/llm/schema.ts`

**Intent**: Take the pen away from the model on the one remaining free-text field
that reaches `content`, and give it two fact channels instead. Extend the
file-header rationale block (currently "2. NO `note`") to cover `label` with the
same reasoning, naming `VariantComparison.astro` as the place it surfaced.

**Contract**:

- `ParsedDiagnosisSchema.visits`: `{ number: int, label: string }` →
  `{ number: int, rationale: string }`. `rationale` is described as a sentence for
  the dentystka explaining why these teeth are together — never shown to the
  patient.
- `ParsedToothSchema` gains `urgencyFromNote: z.boolean()`, described as "true only
  when the note states or directly implies this urgency".
- `generalItemIds` unchanged in this phase (phase 3 owns it).

#### 2. The pure visit layer

**File**: `src/lib/llm/visits.ts` (new)

**Intent**: One module holding every rule about visit order and visit naming, so
they are testable without a provider and cannot drift from the prompt.

**Contract**:

- `MAX_PROPOSED_VISITS = 5`, exported — `prompt.ts` imports it in phase 2 so the
  ceiling in the instructions and the ceiling in the check are one number.
- `VISIT_LABELS` — the closed dictionary: `"Leczenie pilne"`, `"Leczenie
zachowawcze"`, `"Leczenie kanałowe"`, `"Ekstrakcje"`, `"Higienizacja"`.
- `visitLabel(teeth: ToothEntry[]): string` — first matching rule wins, in this
  order: any `urgency === "urgent"` → _Leczenie pilne_; every treated tooth
  `root-canal` → _Leczenie kanałowe_; any `extraction` → _Ekstrakcje_; any tooth
  at all → _Leczenie zachowawcze_; otherwise `""`. Urgency deliberately outranks
  treatment type: with urgent teeth grouped into the first visit, at most one
  visit normally claims that label, and the field stays editable (FR-031). The
  empty-teeth branch is where phase 3 adds _Higienizacja_; until then a visit
  with no teeth is unlabelled, which `VisitList` renders as its placeholder.
- `orderVisits(visits, teeth)` → `{ visits: Visit[]; teeth: ToothEntry[] }`.
  Ranks each visit by the strongest urgency among its teeth (`urgent` <
  `moderate` < `mild` < none), **stable-sorts** so a tie keeps the model's array
  order, renumbers `1..n`, rewrites every tooth's `visitNumber` through the
  old→new map, and sets each visit's `label` from `visitLabel`. Returns a
  `Map<number, number>` too if phase 3 needs it for general items — otherwise
  keep the return shape minimal.

#### 3. The mapper

**File**: `src/lib/llm/parse-diagnosis.ts`

**Intent**: Stop copying model prose into the tree, start composing the warnings
that make the proposal auditable, and run the ordering last.

**Contract**:

- Visit list is built with `label` no longer read from the model; teeth are built
  as today (field by field — `urgencyFromNote` must not be spread in), then
  `orderVisits` runs over both before returning.
- **Duplicate visit numbers**: first declaration wins, the rest are dropped with a
  warning. Not checked today; asking the model for more visits makes a collision
  likelier, and two visits sharing a number are two `VisitList` rows sharing a
  React key.
- **Ceiling**: more than `MAX_PROPOSED_VISITS` visits → a warning naming the count,
  and **all visits are kept**. Dropping them would orphan their teeth into
  `visitNumber: null` via the existing declared-visit check and cost her the work
  the button was supposed to save. The ceiling is a prompt instruction; the code's
  job is to notice when it was ignored, not to enforce it destructively.
- **Inferred urgency**: teeth with `urgency !== null && urgencyFromNote === false`
  are collected into one warning naming them —
  `Pilność dla zębów 36, 24 zaproponował model — nie ma jej wprost w notatce.`
  Composed by us from validated numbers; the model supplies the boolean, not the
  sentence.
- **Rationale**: each non-empty `rationale`, after ordering, becomes a warning
  prefixed with the visit it belongs to. Never enters `content`.
- Existing behaviour that stays exactly as is: FR-030's silent null for
  `uncertain` / `out-of-current-plan` teeth (`parse-diagnosis.ts:89-92`), the
  undeclared-visit warning, the duplicate-tooth rule, every pricelist check.

#### 4. Fixtures

**Files**: `src/lib/llm/fixtures/*.json`

**Intent**: Migrate the four existing recorded answers to the new required fields,
and add the cases this change is about. Fixtures are recorded model answers parsed
through `ParsedDiagnosisSchema` inside the test — that parse is part of the
assertion, not setup (`parse-diagnosis.test.ts:1-16`).

**Contract**:

- Migrate `clean.json`, `out-of-range-tooth.json`, `uncertain-marker.json`,
  `unknown-pricelist-id.json`: drop `label`, add `rationale` per visit and
  `urgencyFromNote` per tooth. Extend `uncertain-marker.json` so its uncertain
  tooth also carries a `visitNumber` — the silent-cut case.
- New `visit-split-by-urgency.json` — several visits, the urgent one **not** first
  in the model's array. Proves `orderVisits` moves it to 1 and the teeth follow.
- New `visits-declared-in-note.json` — the model's grouping is kept intact; only
  the numbering changes. Proves ordering reorders visits and never regroups teeth.
- New `over-visit-ceiling.json` — seven visits. Proves warn-and-keep.
- New `inferred-urgency.json` — urgency set with `urgencyFromNote: false`, plus one
  tooth with `true` that must not appear in the warning.

#### 5. Tests

**Files**: `src/lib/llm/visits.test.ts` (new), `src/lib/llm/parse-diagnosis.test.ts`,
`src/lib/llm/merge.test.ts`

**Intent**: Pin risk #11 at the layer that owns it, and pin the `label` hole the
way S7 pinned `note`.

**Contract**: unit tests for `orderVisits` (urgency ordering, stability on a tie,
teeth following the renumbering, empty input) and `visitLabel` (each dictionary
branch, and the fallback); mapper tests for each new fixture; and the invariant
test — _no free-text string from a model answer appears anywhere in `content`, and
every `content.visits[].label` is a member of `VISIT_LABELS`_ — run across every
fixture, as `parse-diagnosis.test.ts:142` already does for `note`.
`merge.test.ts` needs its inline `PrefillResult` literals updated; its seven
existing cases must stay green untouched in meaning.

#### 6. The contract-surfaces doc

**File**: `docs/reference/contract-surfaces.md`

**Intent**: The section listing what the model cannot write is the reference a
future reader consults before adding a field. Leaving `label` out of it after
closing the hole makes the document quietly wrong.

**Contract**: extend the "model cannot write `note`" bullets to cover
`visits[].label`, naming `VariantComparison.astro` as where it was rendered and
`VISIT_LABELS` as what replaced it.

### Success Criteria

#### Automated Verification

- Unit tests pass: `npm test`
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Every fixture parses against the new schema (asserted inside the tests, not separately)
- The invariant test fails when `label` is restored to the schema and copied through — verify by breaking it once, then reverting

#### Manual Verification

- Not applicable in this phase — nothing user-visible changes until the prompt does. No E2E run: no file under `src/components/`, `src/pages/` or `src/layouts/` is touched.

---

## Phase 2: The prompt asks for a plan

### Overview

Teach the model the grouping rules, the urgency evidence it is allowed to read,
the ceiling, and the two things it must not do — design an anesthesia plan, or
name a visit.

### Changes Required

#### 1. The instructions

**File**: `src/lib/llm/prompt.ts`

**Intent**: Replace the rule that tells the model to propose visits only when the
note suggests them (rule 6, `prompt.ts:43`) with the rules that make it propose a
schedule — medical rules, in the prompt rather than in code, so the dentystka can
change them in one sentence (**B12**).

**Contract**: a new `## Grupowanie wizyt` section carrying the defaults —
`urgent` teeth into the first visit; 2–3 teeth per visit for conservative
treatment; a root canal counts as two (longer appointment); never mix quadrants
from both sides of the arch in one visit (the patient has to be able to chew);
hygiene and pantomogram into the first visit; `uncertain` and
`out-of-current-plan` teeth get no visit; ceiling of `MAX_PROPOSED_VISITS`
imported from `visits.ts`, with "warn rather than fragment further" above it.
A `## Pilność` section listing the readable evidence (pain, abscess, swelling,
"do pilnego" → `urgent`; caries without symptoms → `moderate`; prophylaxis,
aesthetics → `mild`), the prohibition on raising urgency without evidence, and
what `urgencyFromNote` means. A rule stating that the anesthesia variant is
computed automatically and must not be designed or imitated by collapsing the
standard plan — with the single exception that a note explicitly saying the whole
treatment goes under general anesthesia yields one visit plus a warning. A rule
that `rationale` is written for the dentystka and never for the patient. Update
the worked example at the tail so it shows a split, not just a reading.

#### 2. Prompt tests

**File**: `src/lib/llm/prompt.test.ts`

**Intent**: Guard that the rules are present without freezing the dentystka's
wording. The existing rule-presence test matches a regex alternation of phrasings
(`prompt.test.ts:47`) — that shape passes as long as _something_ was written
nearby, and it turns red when she rewords a rule that is working fine.

**Contract**: assert **structural** markers — the grouping and urgency sections
exist by heading; `MAX_PROPOSED_VISITS` appears in the text and is the same value
the code enforces (import it, do not retype the numeral); `urgencyFromNote` and
`rationale` are both explained; the anesthesia prohibition is present. Keep the
existing catalog-completeness test untouched — it is the model of a good
assertion here.

### Success Criteria

#### Automated Verification

- Unit tests pass: `npm test`
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- The ceiling in the prompt and the ceiling in the mapper are provably the same constant (asserted, not eyeballed)

#### Manual Verification

- With a real key configured, a made-up six-tooth note with no visits mentioned produces 2–3 visits, urgent teeth in the first, and warnings naming any inferred urgency
- A note saying "wszystko w jednym znieczuleniu ogólnym" produces one visit and the anesthesia warning — not two competing variants
- No E2E run: no file under `src/components/`, `src/pages/` or `src/layouts/` is touched

---

## Phase 3: General items get a visit (FR-032)

### Overview

The one contract _widening_ in this change: general items travel with a visit, so
a proposed visit's partial cost is the whole visit, not just its teeth. **First
phase to cut** if the session runs short — everything above it stands alone.

### Changes Required

#### 1. Wire contract and prefill result

**File**: `src/lib/llm/schema.ts`

**Intent**: Let the model say which visit a general item belongs to, and carry
that through the prefill result — while leaving id-minting where it is.

**Contract**: `generalItemIds: string[]` → `generalItems: { id: string;
visitNumber: number }[]` (`0` for unassigned, matching the tooth sentinel — the
provider rejects nullables, `schema.ts:6-12`). `PrefillResult.content.generalItems`
widens from `PricelistItemRef[]` to `{ item: PricelistItemRef; visitNumber: number
| null }[]`. The header comment at `schema.ts:51-55` explains why these refs carry
no id — that reason is about `id` only and stays true; extend it to say so.

#### 2. Mapper and merge

**Files**: `src/lib/llm/parse-diagnosis.ts`, `src/lib/llm/merge.ts`

**Intent**: Validate a general item's visit the way a tooth's visit is validated,
carry it through the ordering, and stop hardcoding `null` in the merge.

**Contract**: in the mapper, a general item's `visitNumber` is checked against the
declared visits and nulled with a warning when it points at nothing, then remapped
by `orderVisits` alongside the teeth. In `merge.ts:87`, `visitNumber: null` becomes
the prefilled item's number remapped through the existing `renumbered` map — the
same treatment teeth already get at `merge.ts:66-74`, including its
"visit does not exist" warning path.
**Deduplication stays keyed on item id**, in both the mapper
(`parse-diagnosis.ts:111`) and the merge (`merge.ts:81`): the same item proposed
for two visits collapses to the first, with the warning that already exists.
Hygiene at visit 1 and visit 4 is a real clinical case, but it is one dropdown for
her and a dedup-key redesign for us; it stays out of this change and goes to the
handoff.

#### 3. UI — verification, not change

**Files**: `src/components/admin/GeneralItems.tsx`,
`src/components/admin/TotalsPreview.tsx`

**Intent**: Confirm rather than modify. `GeneralItems` already renders a per-item
visit select (`GeneralItems.tsx:36-51`), `computeQuoteTotals` already buckets
general items into `perVisit` through the same closure as teeth
(`cost.ts:107-119`), and `TotalsPreview` renders whatever that yields. If a change
turns out to be needed here, it is a finding worth a line in the phase notes — the
expectation is that none is.

**Contract**: no interface change expected. If `QuoteEditor` needs anything, it is
at most that `applyPrefill` already writes the merged general items back
(`QuoteEditor.tsx:279`) — verify, do not rewrite.

#### 4. Tests and fixtures

**Files**: `src/lib/llm/merge.test.ts`, `src/lib/llm/parse-diagnosis.test.ts`,
`src/lib/llm/fixtures/*.json`

**Contract**: every fixture's `generalItemIds` becomes `generalItems` with a visit;
one fixture assigns hygiene to visit 1 and one points a general item at an
undeclared visit. Mapper and merge tests cover: the visit survives the merge's
renumbering; an undeclared visit is nulled and named; the duplicate rule holds. A
cost test asserting that a general item's price lands in its visit's partial total
already exists in spirit (`cost.test.ts:117`) — extend rather than duplicate.

### Success Criteria

#### Automated Verification

- Unit tests pass: `npm test`
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- A prefilled general item's price appears in its visit's `perVisit` entry, asserted through `computeQuoteTotals`

#### Manual Verification

- In the editor after a prefill, a proposed general item shows its visit in the dropdown and the visit's partial cost includes it
- E2E: `npm run test:e2e` **only if** this phase ends up touching a file under `src/components/` — expected not to, in which case say so explicitly rather than skipping silently

---

## Phase 4: Documents

### Overview

PRD, roadmap and test plan move in the same session as the code. README is
unchanged — same endpoint, same secret.

### Changes Required

#### 1. PRD

**File**: `context/foundation/prd.md`

**Contract**: three new functional requirements in the FR-01x / FR-03x gaps
(verified free):

- **FR-014** — the system proposes a visit split for the standard plan, ordering
  visits so the most urgent teeth fall in the first; visit **numbering and labels
  are assigned by the system**, never by the model, and the labels come from a
  closed vocabulary. Priority: must-have.
- **FR-015** — any urgency the system inferred rather than read is named in the
  FR-012 warnings, together with the model's own reasoning for the split. Priority:
  must-have.
- **FR-033** — a proposed general item may carry a visit assignment, so a visit's
  partial cost (FR-032) covers the whole visit. Priority: should-have. _(Drop this
  one if phase 3 was cut.)_
  Plus an Open Question on the visit-grouping rules — owner: dentystka, blocking:
  no — recording that the defaults in the prompt are a starting point she is
  expected to rewrite (**B12**).

#### 2. Roadmap

**File**: `context/foundation/roadmap.md`

**Contract**: a new slice **S-09 `visit-planning-prefill`** in the table and its
own section, marked `done`, noting that it closes the second half of FR-011 which
S-02 delivered half of; prerequisites S-02.

#### 3. Test plan

**File**: `context/foundation/test-plan.md`

**Contract**: risk **#11** added to the Risk Map (§2) — _the prefill proposes a
visit split and an urgency the note does not support; because it arrives complete
and confident it is approved unread, and the patient gets a schedule nobody
decided._ Impact High, Likelihood Medium, source: this change's plan and FR-011 /
FR-012. A matching row in the Risk Response Guidance table (§2) stating what would
prove protection (every inferred value is named in a warning; no free-text model
string reaches `content`), what to challenge (that a green mapping test proves the
split is _sensible_ — it proves only that it is _labelled_), and the cheapest layer
(unit, on recorded answers). A new phase **6 — Visit proposal boundary** in §3,
risks covered #11, type unit, status complete, change folder
`visit-planning-prefill`. Update the "last reviewed" line in §6.

#### 4. Lessons

**File**: `context/foundation/lessons.md`

**Contract**: append an entry **only if** this change surfaces a new class of
defect. The `label` hole is a strong candidate — "a field the model writes is
patient-visible unless something stops it, and the second such field was found a
whole slice after the first" generalises past this change. Written as a rule, with
its context and where it applies, matching the four existing entries' shape.

### Success Criteria

#### Automated Verification

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Unit tests pass: `npm test`
- FR-014, FR-015 and FR-033 are unique in the PRD: `grep -c "FR-014" context/foundation/prd.md` returns 1

#### Manual Verification

- The PRD's new FRs read as requirements on the product, not as a description of this implementation
- The roadmap slice says what the dentystka gets, not what the code does

---

## Testing Strategy

### Unit tests

- `orderVisits`: urgency ordering; stability on a tie (model order preserved);
  teeth follow the renumbering; visits with no teeth; empty input.
- `visitLabel`: one case per dictionary branch, plus the no-teeth fallback.
- `mapParsedDiagnosis`: each new fixture; the inferred-urgency warning names
  exactly the teeth whose `urgencyFromNote` is false; rationale warnings name the
  visit _after_ ordering; the ceiling warns and keeps; duplicate visit numbers keep
  the first.
- **The invariant**: across every fixture, no free-text field of the model's answer
  appears anywhere in `JSON.stringify(content)`, and every visit label is in
  `VISIT_LABELS`. Asserted over free-text fields only — pricelist ids match by
  construction and that is the point.
- `mergePrefill`: the seven existing cases stay green; visits and their teeth
  still remap by the visit's own number; (phase 3) general items carry their visit
  through the renumbering.
- `buildInstructions`: structural presence of the new rule sections; the ceiling
  is the shared constant.

### Integration tests

None new. The prefill endpoint's contract is unchanged: same route, same request
shape, same failure modes.

### Manual testing steps

1. In the editor, paste a made-up note naming six teeth — two with pain, four with
   asymptomatic caries — and mentioning no visits at all.
2. Press "Wypełnij z notatki". Expect: two or three visits; the painful teeth in
   visit 1; visit labels from the dictionary; the warnings block naming the teeth
   whose urgency the model inferred, and the model's reasoning for the split.
3. Add a tooth and a visit **by hand first**, then prefill. Expect: nothing you
   typed is altered; proposed visits land after yours, renumbered; the duplicate
   tooth is skipped and named.
4. Paste a note saying the whole treatment is under general anesthesia. Expect: one
   visit in the standard plan plus the anesthesia warning — not a second variant.
5. Clean up on production with SQL afterwards (FR-053 — approved rows cannot be
   deleted through the UI).

## Performance Considerations

None material. `orderVisits` is a sort over at most five visits and a map over at
most a few dozen teeth, on a path that has just waited up to 30 seconds for a
provider. The prompt grows by a page of rules, which is a small increase in input
tokens on a call that already ships the entire pricelist catalog.

## Migration Notes

No migration. `content` keeps its shape — `Visit.label` still exists and is still
editable; only the _wire_ schema loses the field. Approved quotes are untouched.
Drafts saved before this change reopen and prefill exactly as before.

## References

- Research: `context/changes/visit-planning-prefill/research.md`
- Prior slice: `context/archive/2026-09-05-llm-parsing-prefill/` (S-02 — the `note`
  excision this change repeats for `label`, and the fixture-not-live-API stance)
- The invariant: `docs/reference/contract-surfaces.md:76-101`, `src/types.ts:10-14`
- The pattern to repeat: `src/lib/llm/parse-diagnosis.ts:142` (S7's `note` guard)
- Standing decision not to E2E the prefill: `context/foundation/test-plan.md:215`
- Sticky action bar and the dimming rule: `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: The code owns numbering, naming and warnings

#### Automated

- [ ] 1.1 Unit tests pass: `npm test`
- [ ] 1.2 Type checking passes: `npx astro check`
- [ ] 1.3 Linting passes: `npm run lint`
- [ ] 1.4 Every fixture parses against the new schema
- [ ] 1.5 The invariant test fails when `label` is restored and copied through

#### Manual

- [ ] 1.6 Nothing user-visible changes; no E2E run (no component/page/layout touched)

### Phase 2: The prompt asks for a plan

#### Automated

- [ ] 2.1 Unit tests pass: `npm test`
- [ ] 2.2 Type checking passes: `npx astro check`
- [ ] 2.3 Linting passes: `npm run lint`
- [ ] 2.4 Prompt ceiling and mapper ceiling are provably the same constant

#### Manual

- [ ] 2.5 A six-tooth note with no visits produces a split with urgent teeth first and inference warnings
- [ ] 2.6 A general-anesthesia note produces one visit plus the warning, not a second variant
- [ ] 2.7 No E2E run (no component/page/layout touched)

### Phase 3: General items get a visit (FR-032)

#### Automated

- [ ] 3.1 Unit tests pass: `npm test`
- [ ] 3.2 Type checking passes: `npx astro check`
- [ ] 3.3 Linting passes: `npm run lint`
- [ ] 3.4 A prefilled general item's price appears in its visit's `perVisit` entry

#### Manual

- [ ] 3.5 A proposed general item shows its visit and is included in the visit's partial cost
- [ ] 3.6 E2E run, or an explicit statement that no component file was touched

### Phase 4: Documents

#### Automated

- [ ] 4.1 Type checking passes: `npx astro check`
- [ ] 4.2 Linting passes: `npm run lint`
- [ ] 4.3 Unit tests pass: `npm test`
- [ ] 4.4 FR-014, FR-015, FR-033 are unique in the PRD

#### Manual

- [ ] 4.5 The new FRs read as product requirements, not as a description of the implementation
- [ ] 4.6 The roadmap slice says what the dentystka gets
