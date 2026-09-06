# Tooth chart on the patient page and in the editor — Implementation Plan

## Overview

The patient sees a drawing of their mouth with the planned teeth marked: colour by
urgency, status distinguishable by shape as well as colour, and a tooltip naming the
tooth, the treatment and the cost. The dentystka clicks a tooth on the same drawing to
add it to the plan or to jump to its row. The grouped list (FR-061) stays exactly where
it is, as the accessibility and print layer.

The geometry comes from `react-odontogram` 0.5.6 (MIT) by copying its path data, not by
installing it. Everything with state, style, or accessibility semantics is written here.

## Current State Analysis

The repo has been cutting the slot for this change for two slices, and most of the work
is landing in holes already made rather than making new ones:

- `src/lib/quote/marks.ts` exists **because** ui-redesign refused to let this change
  write a third copy of `URGENCY_MARK` (`reviews/impl-review.md:145-152`).
- `--urgency-unknown` / `-ink` (`src/styles/global.css:50-51`) were defined for teeth
  this chart must draw and are used by nothing else today.
- The patient page's quadrant grid was laid out 2×2 "in true chart orientation … so
  S-06 replaces a rectangle with a drawing instead of rebuilding a section"
  (`design-brief.md:191-213`).
- The status vocabulary was decided in the brief and already survives greyscale:
  `in-plan` solid fill + solid outline, `uncertain` dashed outline unfilled,
  `out-of-current-plan` 65% opacity + hairline hatch (`design-brief.md:98-110`).

What is missing, and is not visible from the file names:

- **The vendored quadrant table is wrong.** `react-odontogram` draws FDI quadrant 3 on
  the viewer's left and quadrant 4 on the right — swapped — in both its layouts, while
  its own `convertFDIToNotation` maps `3 → LL`. Confirmed by rendering the raw data
  (see `research.md` §A).
- **`URGENCY_MARK` and `STATUS_OUTLINE` cannot be used on an SVG `<path>`**: their
  values are `bg-*` and `border-*` classes. The chart needs `fill-*`/`stroke-*`, and
  Tailwind's static scan means that has to be a third literal table.
- **There is no per-tooth cost accessor.** `sumItems()` (`src/lib/quote/cost.ts:69`) is
  not exported; only `computeQuoteTotals` (`:100`) is.
- **Tooth rows are not addressable.** `ToothRow.tsx:39` has no `id`, no `ref`, no
  `data-*`.
- **`addTeeth()` takes no arguments** (`QuoteEditor.tsx:120-151`) — it reads the text
  input directly.
- **There is no tooltip primitive** in `src/components/ui/` (badge, button, input,
  label, textarea only).
- **The patient page has zero islands today**; this chart is its first.

## Desired End State

Opening an approved quote's patient link shows, above the grouped list, an arch drawing
of the mouth. Every tooth in the quote is coloured by its urgency and outlined by its
status; teeth not in the quote are drawn plain. Hovering, focusing or tapping a marked
tooth names it, its treatment and its cost. Printed, the drawing survives in black and
white with the statuses still distinguishable. In the editor the same drawing sits above
the tooth rows: clicking an unplanned tooth adds it, clicking a planned one scrolls to
and focuses its row, and the drawing reflects a change made by the text picker or by
prefill immediately.

Verified by: `npm test`, `npm run lint`, `astro check`, `npm run depcruise`,
`npm run test:e2e` (including a new risk #8 spec), and the two evidence screenshots.

### Key Discoveries

- Quadrant defect and its one-line fix — `research.md` §A
- `urgencyFromNote` never reaches `content` (`visit-planning-prefill/plan.md:147`), so
  the chart has no provenance signal and needs none — `research.md` §H
- Chart insertion point is `PatientQuote.astro:47`, and it takes `content.teeth` whole,
  not the `inPlan` bucket — `research.md` §D
- `.dependency-cruiser.cjs:267` `no-cross-component-family-imports` will fire when both
  `admin/` and `patient/` import a new `tooth-chart/` family — `research.md` §F
- `vitest.config.ts` is `environment: "node"`, `include: ["src/**/*.test.ts"]` — no
  component test exists in the repo and none is added here

## What We're NOT Doing

- `npm install react-odontogram` (decided 6 IX; the reasons are in `change.md`)
- Copying `Odontogram.tsx`, `Teeth.tsx`, `Tooltip.tsx`, `Labels.tsx`, or `styles.css`.
  **Verbatim copying is limited to path data, the four transform strings, and the
  viewBox.** Anything with state, style, or a11y semantics is written here.
- Universal / Palmer notation and a notation switch — FDI only
- The library's dark theme, its `:root` palette, its `dash-move` animation, Storybook
- Drag-and-drop of teeth between visits (stays parked)
- Editing a treatment from the drawing; tooth surfaces (mesial/distal/…)
- A component test — the repo has none and this change does not introduce the harness
  (see Testing Strategy)
- Any new column, migration, or wire-schema field
- Touching `src/lib/llm/` — the prompt's time budget is not this change's business

## Implementation Approach

Four phases, in dependency order: the pure layer first (testable without a DOM, and the
place the quadrant fix lives), then the component and the patient surface, then the
editor, then the browser test.

The load-bearing structural decision: **the copied transforms are slots, not
quadrants.** `paths.ts` holds anonymous geometry — four transform strings in draw order
and eight tooth shapes — and carries no FDI meaning at all. `layout.ts` owns the
FDI → slot mapping, which is where the library was wrong and where we are right. That
turns a fork-or-patch problem into a lookup table with a test.

The second: **the chart's class table lives in `marks.ts`, beside the other two.**
`tooth-chart/style.ts` composes them per tooth but does not define them. `marks.ts`
exists specifically to stop a third divergent copy of this mapping; putting the SVG
table anywhere else recreates the problem it was extracted to solve.

---

## Phase 1: Vendored geometry, licence, and the pure layer

### Overview

Copy the geometry as data, attach the licence, correct the quadrant mapping in our own
code, and build the model/layout/style functions with tests. No component, no page
change. Drive this phase with `/10x-tdd` — every unit of it is a pure function.

### Changes Required:

#### 1. Vendored geometry

**File**: `src/lib/tooth-chart/paths.ts` (new)

**Intent**: Hold the copied SVG geometry as inert data so the chart has shapes to draw,
with the attribution MIT requires travelling alongside it. This is the only file in the
change permitted to contain copied bytes.

**Contract**: Exports `TOOTH_SHAPES` — eight entries in FDI position order 1–8, each
`{ position, type, outlinePath }` — copied from `../react-odontogram/src/data.ts`
`teethPaths` (the circle/arch set; `NewTeethPaths` is not copied, see the layout
decision). Exports `SLOT_TRANSFORMS`: four transform strings in **draw order**
(upper-left, upper-right, lower-left, lower-right of the image), copied from
`oldquadrants` in `../react-odontogram/src/utils.ts`. Exports `CHART_VIEWBOX = "0 0 409 694"`
from `getViewBox(layout: "circle", showHalf: "full")` in that repo's `Odontogram.tsx:49`.

The library's `label` field is **not** copied — two of its four values are wrong (see
§2) and all four are English. `shadowPath` and `lineHighlightPath` are not copied; the
chart draws one path per tooth so that fill, outline and hatch are ours to control.

File header carries: `Copyright (c) biomathcode (Pratik Sharma)`, MIT, the repo URL,
version `0.5.6`, commit `81b48eb`, and one sentence saying what was copied and what was
deliberately not.

#### 2. FDI mapping — where the library is wrong

**File**: `src/lib/tooth-chart/layout.ts` (new)

**Intent**: Map an FDI tooth number to a drawing position. This is the file that fixes
the upstream defect, and the fix is a mapping we own rather than a patch to vendored
data.

**Contract**: `slotForQuadrant(quadrant: number): 0 | 1 | 2 | 3`. FDI 1 → slot 0,
2 → slot 1, **4 → slot 2, 3 → slot 3**. The swap is the correction: the library assigns
`teeth-3x` to the lower-left slot, but FDI quadrant 3 is the patient's lower left, which
faces the viewer's right. Write this as an explicit table with the reason in a comment,
never as arithmetic — the whole point is that the obvious index-order version is wrong.

Also exports `chartPositions(teeth: ToothEntry[]): ChartPosition[]` returning every
drawable position (not only teeth in the quote), each with its FDI number, slot, shape
index, dentition, and scale. Milk-tooth rule, per the mixed-dentition decision: milk
quadrants 5–8 map to permanent quadrants 1–4, and a milk tooth shares the slot of its
permanent successor (51→11 … 55→15), drawn at ~0.85 scale in the crown position.

**A slot never drops a tooth.** During exfoliation a quote can legitimately hold both
55 and 15 — the exact case the mixed-dentition decision exists to serve — so when both
are present the slot renders both: the milk tooth in the crown position and the
permanent successor offset outward along the arch, each its own button. Omitting either
would leave a tooth that is in the plan undrawn, which the end state forbids. Shapes are reused —
1–3 for incisors and canine, the molar shapes for milk molars. **This is an
approximation and is named as one** in the module comment, in `research.md`, and in the
chart's own legend; it is not presented as anatomical fidelity.

#### 3. Model — quote content to drawable teeth

**File**: `src/lib/tooth-chart/model.ts` (new)

**Intent**: Turn a `QuoteContent` into what the chart draws, so the component holds no
domain logic.

**Contract**: `toChartTeeth(content: QuoteContent): ChartTooth[]` where `ChartTooth` is
`{ number, name, slot, shapeIndex, dentition, scale, urgency, status, treatmentType, cost, inQuote }`.
`name` comes from `toothName()` (`src/lib/quote/tooth-name.ts:76`); labels from
`src/lib/quote/labels.ts`. `cost` is the tooth's contribution to the **standard plan** — **export the
existing `sumItems` from `src/lib/quote/cost.ts:69` and call it**; do not write a second
summer, because two cost paths that can disagree is precisely the defect class this repo
has already been bitten by.

**The tooltip shows the standard-plan cost and nothing else, and says so.** Two facts
from `cost.ts` force this. The anesthesia variant sums `sumItems(items, true)` — dropping
`localAnesthesia` items (`:71`) — and then adds `anesthesiaFee(inPlanTeeth)` (`:147-153`),
which is a property of the whole set (`base + max(0, n - included) * perExtraTooth`) and
cannot be attributed to one tooth without inventing an allocation. And only
`status === "in-plan"` teeth contribute at all (`:101`), so an `uncertain` or
`out-of-current-plan` tooth has a non-zero item sum but contributes nothing to any total
the patient is shown. So: `cost` is populated only for `in-plan` teeth, the tooltip
labels it as the standard-plan amount, and the anesthesia fee stays where it already
lives — in the variant comparison, which owns the set-level number. A tooltip whose
arithmetic disagrees with the total printed underneath it is the worst defect available
on this page. Teeth absent from the quote come back with `inQuote: false`,
`urgency: null` and no cost — the chart draws every position, so it needs an entry for
every position.

#### 4. Chart marks, beside the existing ones

**File**: `src/lib/quote/marks.ts` (modify)

**Intent**: Give the chart its `fill`/`stroke` classes without creating a third,
divergent copy of the urgency-and-status mapping.

**Contract**: Adds `URGENCY_FILL: Record<Urgency | "unknown", string>` (`fill-urgency-*`,
including the `unknown` key that `URGENCY_MARK` deliberately lacks — a list can omit a
dot, a chart cannot omit a tooth) and `STATUS_SHAPE: Record<ToothStatus, string>`
carrying the SVG expression of the brief's three treatments. Static literal strings, per
the file's own `:14-15` constraint. Extend the file's header comment to say the chart is
now the third consumer and why all three tables live here.

**File**: `src/lib/tooth-chart/style.ts` (new)

**Contract**: Composes the above per tooth — `toothClasses(t: ChartTooth): string` and a
hatch-pattern id for `out-of-current-plan`. Defines nothing; the tables stay in
`marks.ts`. The 65% dim applies to the tooth group **or** its label, never both
(`lessons.md`, composed dimming).

#### 5. Licence notice

**File**: `THIRD-PARTY-NOTICES.md` (new, repo root)

**Intent**: MIT requires the notice to travel with a copy, and this repo is going public.

**Contract**: One entry for `react-odontogram` — package, version `0.5.6`, commit
`81b48eb`, author, repo URL, what was copied and into which file, and the full MIT
licence text. **The upstream repo has no `LICENSE` file** — MIT is declared only in
`package.json:5` and `README.md:323` — so the text is the canonical MIT template and the
entry says so in one sentence rather than implying a verbatim quote of a file that does
not exist.

**File**: `context/foundation/tech-stack.md` (modify)

**Contract**: New `## Vendored code` section after `## LLM provider` (:26): what was
copied, from where, at which version, why not via npm, and what it means for updates —
nothing, because tooth geometry is frozen.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- A test asserts `slotForQuadrant` maps quadrant 3 to the lower-right slot and 4 to the lower-left, naming the upstream defect in its title
- A test asserts every FDI number valid per `isValidToothNumber` gets a position, and 51–85 land on their successors' slots at reduced scale
- A test asserts a quote holding both a milk tooth and its permanent successor (55 and 15) draws both
- A test asserts a tooth's chart cost equals its contribution to `standard.grandTotal`, and that teeth outside the plan carry no cost
- Type checking passes: `astro check`
- Linting passes: `npm run lint`
- Layer rules hold: `npm run depcruise`
- `grep -rn "Odontogram\|--dark-blue\|data-read-only" src/` returns nothing outside `paths.ts`'s licence header

#### Manual Verification:

- `THIRD-PARTY-NOTICES.md` names the right version, commit and author, and states that the MIT text is the canonical template because upstream ships none
- The quadrant fix is a table with a comment, not arithmetic

---

## Phase 2: The `ToothChart` component and the patient page

### Overview

Write the component and put it on the patient page with a legend. Update PRD, roadmap
and tech-stack in the same phase — the repo's rule is that PRD and roadmap move in the
same session as the code.

### Changes Required:

#### 1. The component

**File**: `src/components/tooth-chart/ToothChart.tsx` (new)

**Intent**: Draw the chart. Controlled: everything it shows arrives as props; it holds
no selection state of its own, so it cannot drift from the `content` tree that the text
picker and prefill also write to.

**Contract**: `interface Props { teeth: ChartTooth[]; mode: "read-only" | "interactive"; onToothClick?: (number: number) => void; }`.
Three behaviours fall out of two modes plus the editor's `readOnly`: the patient's
(inert, hoverable, tappable, keyboard-reachable), the editor's (clicks act), and the
approved-quote editor's (inert but still hoverable — FR-053 freezes the quote, it does
not freeze the tooltip).

Each tooth is a `<button>` inside the SVG with an `aria-label` carrying the tooth name,
its treatment and its status in Polish — **not "Tooth 11"**. `onToothClick` receives the
clicked tooth number, singular; the component never emits a set. In read-only mode the
buttons remain focusable and hoverable and simply do not call back — the opposite of the
library's `readOnly`, which is why we are not using the library.

**File**: `src/components/tooth-chart/ToothTooltip.tsx` (new)

**Contract**: Our own, on S8 tokens. Answers hover, focus **and tap** (a Radix tooltip is
hover/focus-only by default, which is the patient case failing). Carries
`class="no-print"`. Positioned relative to the chart container; no positioner is copied.

**File**: `src/components/tooth-chart/ChartLegend.tsx` (new)

**Contract**: React, not Astro — the editor page renders only
`<QuoteEditor client:load />` (`admin/quotes/new.astro:20`), and a React island cannot
import an `.astro` component, so an Astro legend would be unusable on one of its two
surfaces. Urgency swatches and the three status treatments, plus the milk/permanent
signal. Prints. Every entry pairs its colour with a shape or a glyph — a legend whose
entries differ only by hue would reintroduce on paper exactly what the status shapes
exist to prevent.

#### 2. Family boundary

**File**: `.dependency-cruiser.cjs` (modify)

**Intent**: `tooth-chart/` is imported by both `admin/` and `patient/`, which the
existing rule forbids. Answer it deliberately now rather than discovering it at lint
time in phase 3.

**Contract**: The rule (`:267-278`) has **no allowlist** — it captures the family by
regex from `from.path` and exempts only the same family (back-reference) and
`^src/components/ui/` in `to.pathNot`. The working edit is a third entry in that
`pathNot` array: `'^src/components/tooth-chart/'`, plus a line in the rule's `comment`
saying it is a shared family for the same reason `ui/` is.

#### 3. Patient page

**File**: `src/components/patient/PatientQuote.astro` (modify)

**Contract**: Insert `<ToothChart client:load … />` plus the legend at `:47`, above
`<ToothGroups>`. Feed it `toChartTeeth(content)` over `content.teeth` **whole** — the
existing `inPlan`/`deferred`/`uncertain` buckets (`:25-27`) stay for the sections below.
Wrapper gets `break-inside: avoid`.

**File**: `src/styles/global.css` (modify)

**Contract**: Print rules for the chart in the existing `@media print` block (`:191`):
keep the SVG, hide the tooltip via `.no-print` (`:208`), and ensure the hatch survives.
The hatch is an **SVG `<pattern>`**, not a CSS `repeating-linear-gradient` — print drops
background images by default, and that is the exact defect `lessons.md` records from the
last slice.

#### 4. Documentation

**File**: `context/foundation/prd.md` (modify)

**Contract**: Add FR-074 (chart on the patient view, statuses consistent with
FR-061/062/063), FR-075 (legend; status distinguishable other than by colour; grouped
list retained), FR-076 (chart as a picker in the editor) under
`### Patient view (public, token-only)` (:155). _Note_: the section's band is 060s and
FR-072 is the current maximum, so FR-074–076 sit outside their band; the session plan
names these numbers explicitly, so they are used as named and this sentence is the
record of the inconsistency. Strike the parenthetical in FR-061 `:158` ("v1 substitute
for graphical tooth arch visualization") — FR-061 becomes a parallel layer, not a
substitute. Remove `:257` from `### Odroczone na v2` with the reason for the reversal:
the FDI number is not information for the patient, and the data the drawing needs has
been in the record since S-01, so this is a pure function from model to view. Mark Open
Question #4 `:274` resolved in place, in the struck-through style of #8 `:278`.

**File**: `context/foundation/roadmap.md` (modify)

**Contract**: New `### S-06: Tooth chart on the patient page and in the editor` in
`## Slices`, in the format at `:125-135` — Change ID `tooth-chart-visualization`,
PRD refs FR-061 + FR-074–076, Prerequisites S-01. Move the `## Parked:213` entry with an
`unparked 2026-09-06` note. Update `:57`, which currently says the urgency tokens are
"waiting for the odontogram from S-06".

### Success Criteria:

#### Automated Verification:

- `npm test`, `astro check`, `npm run lint`, `npm run depcruise` all pass
- Existing E2E stays green with no edit to any spec: `npm run test:e2e`
- `grep -n "FR-074\|FR-075\|FR-076" context/foundation/prd.md` returns the three new requirements

#### Manual Verification:

- **The drawing looks good.** This is an acceptance criterion, not a nicety: in the S8 palette, on a phone, and in greyscale. If it does not, fix the drawing before starting phase 3.
- Printed at ~717px (A4 printable width, per `lessons.md` — **not** a print-emulated screenshot at a screen viewport), the three statuses remain distinguishable without colour
- Tooltip answers a tap on a touch target, not only a hover
- Tabbing reaches teeth and the labels read as tooth names, treatments and statuses in Polish
- A child's quote with both milk and permanent teeth draws both, and the approximation is visible as an approximation

---

## Phase 3: The editor

### Overview

The same component above the tooth rows, wired to the existing add path and to a new row
anchor. This is the phase that proves the component is genuinely controlled: a change
made by the text picker or by prefill must move the drawing with no extra wiring.

### Changes Required:

#### 1. Addressable rows

**File**: `src/components/admin/ToothRow.tsx` (modify)

**Contract**: Root div (`:39`) gains `id={`tooth-${tooth.number}`}` and `tabIndex={-1}`
so a chart click can `scrollIntoView` and focus it. The ascending-sort invariant
(`QuoteEditor.tsx:65-66`) makes `number` a stable anchor. Do not disturb
`aria-label={`Usuń ząb ${n}`}` (`:53`) — E2E locates by it.

#### 2. Add path

**File**: `src/components/admin/QuoteEditor.tsx` (modify)

**Contract**: Extract `addToothNumbers(numbers: number[]): string[]` from `addTeeth()`
(`:119-151`). The seam is not simply "dedupe onward", and getting it wrong loses
warnings:

- `addTeeth()` keeps tokenizing (`:121`), the `Number()`/`isValidToothNumber` check with
  its `Nieprawidłowy numer zęba` literal (`:127-131`, which needs the raw token), and
  `setToothInput("")` (`:150`) — clearing the text box must **not** happen on a chart click.
- `addToothNumbers()` takes the dedupe (`:123`, `:132-135`), the entry literal
  (`:136-145`) and the sorted write (`:148`). The duplicate warning
  `Ząb ${n} jest już dodany` (`:133`) travels **with** the dedupe, not with the parser.
- **`addToothNumbers` returns its warnings rather than setting them.** `warnings` is
  currently built on both sides of this seam and flushed once at `:149`; two
  `setToothWarnings` calls would have the second clobber the first and the parse
  warnings would silently vanish. `addTeeth()` concatenates both lists and calls
  `setToothWarnings` once.
- Build `seen` inside the `setTeeth(prev => …)` updater rather than from the render
  closure (`:123`): the existing code reads `teeth` from the closure while writing
  functionally, which two chart clicks in one tick would turn into a double insert.
- Preserve the `additions.length > 0` guard (`:148`) — a batch of pure duplicates must
  leave state untouched while still surfacing its warnings.

The chart calls `addToothNumbers([n])`. Mount
`<ToothChart client:load … mode={readOnly ? "read-only" : "interactive"} />` above the
row list (`:510`), fed from the same `teeth` state the rows render — no second source.
Clicking a tooth already in the plan focuses its row instead of adding it. The text
picker stays exactly as it is.

### Success Criteria:

#### Automated Verification:

- `npm test`, `astro check`, `npm run lint`, `npm run depcruise` pass
- `npm run test:e2e` green with no edit to any existing spec — the placeholder `"Numery FDI, np. 17,16,34"` and the remove-button label are untouched

#### Manual Verification:

- Adding a tooth with the text picker colours it in the drawing immediately; removing a row uncolours it
- A prefilled quote's teeth appear in the drawing on arrival, without a remount or a lost focus
- Clicking a planned tooth scrolls to and focuses its row; clicking an unplanned one adds it
- An approved (readOnly) quote's chart is inert but still shows tooltips

---

## Phase 4: E2E — risk #8

### Overview

One browser test for the one thing unit tests cannot hold: that the drawing and the list
tell the same story. Drive with `/10x-e2e`.

**Risk #8 does not exist in `test-plan.md` yet** — risks there run #1–#7, #11, #12. This
phase adds it, following the precedent set when #11 was added with the visit-split
prefill (`test-plan.md:222`).

### Changes Required:

**File**: `context/foundation/test-plan.md` (modify)

**Contract**: New risk row #8 — _the drawing and the grouped list describe the same
mouth: for an approved quote, every tooth marked in the chart appears in the list with
the same urgency and status, and no tooth appears in one and not the other._ Fill the
table's existing columns, including the "what would make this test worthless" column:
asserting the chart renders 32 paths, which passes whether or not the marks match the
list. Add the corresponding rollout-phase row in the table at `:96`.

**File**: `e2e/tooth-chart.spec.ts` (new)

**Contract**: Follows `seed.spec.ts` — role-based locators, self-contained
setup→action→assertion, `Date.now()`-tagged data, `waitForIslands()`
(`e2e/support/app.ts:19-21`) after navigation. **The patient page has had no island
until now**, so this barrier is newly load-bearing there. Test name binds to risk #8.
Asserts chart and list agree — a positive membership check across both, not a count.

**No cleanup, by necessity.** Risk #8 needs the patient page, which needs an approved
quote, and FR-053 makes an approved quote immutable — the test cannot delete what it
creates. It follows the precedent set for the same constraint in
`patient-link-content.spec.ts:17-20`: tag the data with a unique stamp and assert only
on its own quote. The rows are swept by the SQL clean-up that closes the session.

### Success Criteria:

#### Automated Verification:

- `npm run test:e2e` green, all specs, no edits to existing ones
- The new spec fails if a tooth's status is changed in the chart's input but not the list's

#### Manual Verification:

- The spec's failure message names the disagreeing tooth, not just a count mismatch

---

## Testing Strategy

### Unit Tests

`src/lib/tooth-chart/*.test.ts`, co-located, vitest, `environment: "node"`:

- `layout.test.ts` — the quadrant correction (named as such), full FDI coverage, milk-tooth slot sharing and scale
- `model.test.ts` — content → chart teeth, including teeth absent from the quote, `urgency: null`, and cost agreeing with `computeQuoteTotals`
- `style.test.ts` — every urgency including `unknown` and every status resolve to a class; no interpolated class names

### Integration

E2E risk #8 (phase 4). Chart-and-list agreement is the only assertion that needs a
browser; everything else is a pure function.

### No component test

The repo has none, `vitest.config.ts` is `environment: "node"` with
`include: ["src/**/*.test.ts"]`, and adding jsdom plus a config change to test a
presentational component whose logic already lives in tested pure functions buys little.
The integrated behaviour is covered by E2E. Recorded here so a reviewer sees it as a
decision rather than an omission.

### Manual

1. Patient page in the S8 palette, on a phone, and in greyscale
2. Print at ~717px A4 printable width — not a print-emulated screenshot at a screen viewport
3. Tap a tooth on a touch target; tab through the chart with a screen reader
4. A child's quote with mixed dentition
5. An approved quote's editor chart: inert, still hoverable

## Performance Considerations

One SVG, 32–52 paths, no animation beyond hover. The chart is a `client:load` island on
a page that previously had none, so the patient page now ships React. That is a real cost
on a page a patient may open on a slow phone; if it shows, the fallback is to render the
base drawing server-side and hydrate only the tooltip. Measure before optimising.

## Migration Notes

None. No schema, no column, no wire-schema field. The chart is a function from data that
has been in the record since S-01.

## References

- Research: `context/changes/tooth-chart-visualization/research.md`
- Vendored source: `../react-odontogram` @ `81b48eb`, tag `0.5.6`
- Design brief: `context/archive/2026-09-05-ui-redesign/design-brief.md:49-53, 80-117, 191-213`
- Marks extraction: `context/archive/2026-09-05-ui-redesign/reviews/impl-review.md:145-152`
- Provenance: `context/archive/2026-09-06-visit-planning-prefill/plan.md:147, 245, 521`
- `context/foundation/lessons.md` — print backgrounds, composed dimming, media dimensions

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Vendored geometry, licence, and the pure layer

#### Automated

- [x] 1.1 Unit tests pass: `npm test` — 486fc5c
- [x] 1.2 Test asserts the quadrant 3/4 correction, naming the upstream defect — 486fc5c
- [x] 1.3 Test asserts every valid FDI number gets a position; 51–85 share successors' slots at reduced scale — 486fc5c
- [x] 1.4 Test asserts a quote holding both 55 and 15 draws both — 486fc5c
- [x] 1.5 Test asserts chart cost equals the tooth's contribution to `standard.grandTotal`; out-of-plan teeth carry none — 486fc5c
- [x] 1.6 Type checking passes: `astro check` — 486fc5c
- [x] 1.7 Linting passes: `npm run lint` — 486fc5c
- [x] 1.8 Layer rules hold: `npm run depcruise` — 486fc5c
- [x] 1.9 No vendored identifiers outside `paths.ts`: `grep -rn "Odontogram\|--dark-blue\|data-read-only" src/` — 486fc5c

#### Manual

- [x] 1.10 `THIRD-PARTY-NOTICES.md` correct on version, commit, author, and the missing-LICENSE caveat — 486fc5c
- [x] 1.11 The quadrant fix is an explicit table with a reason, not arithmetic — 486fc5c

### Phase 2: The `ToothChart` component and the patient page

#### Automated

- [x] 2.1 `npm test`, `astro check`, `npm run lint`, `npm run depcruise` pass — 570f4c3
- [x] 2.2 Existing E2E green with no spec edits: `npm run test:e2e` — 570f4c3
- [x] 2.3 FR-074/075/076 present in `prd.md` — 570f4c3

#### Manual

- [x] 2.4 The drawing looks good in the S8 palette, on a phone, and in greyscale — 570f4c3
- [x] 2.5 Statuses distinguishable without colour when printed at ~717px A4 width — 570f4c3
- [x] 2.6 Tooltip answers a tap, not only a hover — 570f4c3
- [x] 2.7 Keyboard reaches teeth; labels are Polish tooth names, treatments and statuses — 570f4c3
- [x] 2.8 Mixed dentition draws, and the approximation reads as an approximation — 570f4c3

### Phase 3: The editor

#### Automated

- [x] 3.1 `npm test`, `astro check`, `npm run lint`, `npm run depcruise` pass — c5abcfd
- [x] 3.2 `npm run test:e2e` green with no edits to existing specs — c5abcfd

#### Manual

- [x] 3.3 Text-picker add/remove moves the drawing immediately — c5abcfd
- [x] 3.4 Prefill's teeth appear without a remount or lost focus — c5abcfd
- [x] 3.5 Click planned tooth → focus its row; click unplanned → adds it — c5abcfd
- [x] 3.6 Approved-quote chart is inert but still shows tooltips — c5abcfd

### Phase 4: E2E — risk #8

#### Automated

- [x] 4.1 `npm run test:e2e` green, no edits to existing specs
- [x] 4.2 The spec fails when chart input and list input disagree

#### Manual

- [x] 4.3 The failure message names the disagreeing tooth
