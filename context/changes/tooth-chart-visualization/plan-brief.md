# Tooth chart on the patient page and in the editor — Plan Brief

> Full plan: `context/changes/tooth-chart-visualization/plan.md`
> Research: `context/changes/tooth-chart-visualization/research.md`

## What & Why

The patient gets a drawing of their own mouth instead of a list of two-digit numbers.
Teeth in the plan are coloured by urgency and outlined by status, and a tooltip names the
tooth, the treatment and the cost. The dentystka gets the same drawing in the editor as a
picker. The number `36` means nothing to a patient; a marked tooth in a picture of a jaw
means something immediately — and every byte the drawing needs has been in the record
since S-01, so this is a function from model to view, not a new capability.

## Starting Point

The patient page shows a list grouped by quadrant (FR-061), introduced as an explicit
"v1 substitute for graphical tooth arch visualization". Two slices have been cutting the
slot for the real thing: `marks.ts` was extracted so this change would find the urgency
table rather than write a third copy, `--urgency-unknown` was defined for teeth only this
chart draws, and the quadrant grid was laid out 2×2 in true chart orientation so a
drawing could replace a rectangle. The patient page has no React island yet; this is its
first.

## Desired End State

Opening a patient link shows an arch drawing above the grouped list, coloured by urgency,
with statuses distinguishable by shape as well as hue, tooltips on hover, focus and tap,
and a legend. It survives being printed in black and white. In the editor the same
drawing sits above the tooth rows: click an unplanned tooth to add it, click a planned
one to jump to its row, and the drawing follows the text picker and prefill without extra
wiring. The grouped list stays, now as a parallel accessibility and print layer rather
than a substitute.

## Key Decisions Made

| Decision              | Choice                                                       | Why                                                                                                                                                            | Source       |
| --------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Library or own SVG    | Copy the geometry, write the component                       | `readOnly` upstream kills `pointer-events` (the patient needs a tooltip), selection is uncontrolled, FDI 51–85 don't exist, status is colour-only              | Decided 6 IX |
| What gets copied      | Path data, four transforms, viewBox — nothing else           | Anything with state, style or a11y semantics is exactly what has to work differently here                                                                      | Decided 6 IX |
| Upstream quadrant bug | Copy transforms as anonymous **slots**; own the FDI→slot map | Verified by rendering: quadrants 3 and 4 are swapped in both layouts. Ours to map, so the fix is a table with a test, not a fork                               | Research     |
| Chart layout          | Anatomical arch (circle)                                     | Reads as a mouth; no midline gap; the design brief's 2×2 slot is shaped for it                                                                                 | Plan         |
| Child patients        | Mixed, driven by the data                                    | A real 9-year-old has both dentitions; drawing an assumed stage would be wrong for most children. Milk teeth share their successors' slots, smaller and marked | Plan         |
| Milk-tooth shapes     | Reused permanent shapes, scaled                              | No milk geometry exists upstream. Named as an approximation in code, docs and legend rather than passed off as anatomy                                         | Plan         |
| Urgency provenance    | No new field; chart draws approved values                    | `urgencyFromNote` never reaches `content`, and FR-015 keeps inference in the dentystka-only warnings. The chart draws what she approved                        | Research     |
| Chart's class table   | In `marks.ts`, beside the other two                          | `URGENCY_MARK` values are `bg-*` and won't work on a `<path>`; a separate table is the third divergent copy `marks.ts` was extracted to prevent                | Research     |
| Per-tooth cost        | Export the existing `sumItems`                               | Two cost paths that can disagree is a defect class this repo has already paid for                                                                              | Research     |
| Component test        | None                                                         | Repo has no component test, vitest is node-only; the logic is in tested pure functions and E2E covers the integration                                          | Plan         |

## Scope

**In scope:** vendored geometry + MIT notice + `THIRD-PARTY-NOTICES.md`; the pure layer
(`paths`/`layout`/`model`/`style`) with tests; the `ToothChart` island, tooltip and
legend; the patient page; the editor picker and row anchors; PRD FR-074–076, roadmap
S-06, tech-stack vendoring note; E2E risk #8.

**Out of scope:** `npm install react-odontogram`; copying any component, tooltip, label
or stylesheet from it; Universal/Palmer notation; the library's dark theme and
animations; drag-and-drop between visits; editing treatments from the drawing; tooth
surfaces; any migration or wire-schema change; `src/lib/llm/`.

## Architecture / Approach

Two boundaries carry the change. **Geometry is inert data with no FDI meaning** —
`paths.ts` holds shapes and four draw-order slots, and `layout.ts` owns the FDI→slot
mapping, which is where upstream was wrong and where we are right. **The component is
controlled** — selection and status arrive as props from the same `teeth` state the rows
render, so the drawing cannot drift from the tree that the picker and prefill also write
to. `QuoteContent → toChartTeeth() → ToothChart` on both surfaces; the only difference
between them is whether clicks call back.

## Phases at a Glance

| Phase                            | What it delivers                                                                                      | Key risk                                                                                                |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1. Geometry, licence, pure layer | Vendored paths + notices, FDI mapping with the quadrant fix, model and style, all tested (`/10x-tdd`) | Copying more than the geometry — the whole benefit is lost the moment a stateful component comes across |
| 2. Component + patient page      | `ToothChart`, tooltip, legend, patient surface, PRD/roadmap/tech-stack                                | Aesthetics. "It looks good" is an acceptance criterion; if it fails, fix the drawing before phase 3     |
| 3. Editor                        | Chart as picker, row anchors, `addToothNumbers`                                                       | Breaking the E2E-load-bearing picker labels; a chart that silently stops being controlled               |
| 4. E2E risk #8                   | Chart and list describe the same mouth                                                                | Asserting the chart renders, which passes whether or not the marks agree                                |

**Prerequisites:** S-01 (the record already carries tooth number, urgency, status and
items); the local `../react-odontogram` clone at 0.5.6; the S8 palette on `main`.
**Estimated effort:** one session across four phases; phase 3 is the one that gets cut if
the timebox runs out.

## Open Risks & Assumptions

- **Aesthetics are the session risk.** A correct chart that looks bad fails the
  acceptance criterion. The mitigation is ordering: the drawing gets fixed before the
  editor gets built, and phase 3 is the designated cut.
- **B8 (visual direction) is still unanswered.** The chart is drawn in the S8 palette on
  that assumption; a later correction is a token change, but the chart's shapes would
  stay.
- **Milk-tooth geometry is an approximation** and is labelled as one everywhere it
  appears. If the dentystka finds it misleading, the honest fallback is a permanent-only
  chart with a milk badge, not a better-looking guess.
- The tooltip deliberately shows one of the two variant costs. If patients read it as the total, the fix is wording, not arithmetic.
- The patient page ships React for the first time. Watch the weight on a slow phone;
  server-rendering the base drawing and hydrating only the tooltip is the escape hatch.
- FR-074–076 sit outside the patient-view band (060s, currently maxed at FR-072). The
  session plan names those numbers, so they are used as named and the plan records the
  inconsistency rather than silently renumbering.

## Success Criteria (Summary)

- A patient opens their link and sees which teeth are being treated, how urgent each is
  and what each costs, without decoding a number — on a phone, and on paper in black and
  white.
- The dentystka adds a tooth by clicking it and reaches its row by clicking it again,
  with the text picker still working exactly as before.
- The drawing and the list never disagree, and a test fails if they do.
