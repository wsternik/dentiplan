<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: UI redesign

- **Plan**: `context/changes/ui-redesign/plan.md`
- **Scope**: all five phases
- **Date**: 2026-09-05
- **Verdict**: NEEDS ATTENTION → APPROVED after fixes
- **Findings**: 0 critical, 9 warnings, 4 observations

Two reviewers ran in parallel over the branch: one comparing the diff against the
plan's contracts, one scanning for safety, correctness and pattern drift. Neither
wrote the code. That is the whole point — the most valuable finding below is one I
had personally marked verified, with a screenshot, using a method that could not
have detected it.

## Verdicts

| Dimension           | Verdict | After fixes |
| ------------------- | ------- | ----------- |
| Plan Adherence      | WARNING | PASS        |
| Scope Discipline    | WARNING | PASS        |
| Safety & Quality    | WARNING | PASS        |
| Architecture        | PASS    | PASS        |
| Pattern Consistency | WARNING | PASS        |
| Success Criteria    | WARNING | PASS        |

No security regression. The patient page leaks nothing new: `Layout.astro` still
gates the config banner on the session, `Topbar` is not on that route,
`PatientError.astro` stayed static, and the built stylesheet is a `<link>` rather
than inlined, so the byte-identity probe is unaffected. `QuoteEditor`'s state,
handlers, guards and read-only branch are unchanged.

## Findings

### F1 — The printed page did not keep the two variants side by side

- **Severity**: ⚠️ WARNING · **Impact**: 🔎 MEDIUM · **Dimension**: Success Criteria
- **Location**: `src/components/patient/VariantComparison.astro:34`, `src/styles/global.css`
- **Detail**: The grid is `md:grid-cols-2` — 768px — while A4 at default margins gives
  about 717px of printable width. On paper the comparison stacked, against a contract
  stated in both the brief (§6) and the plan (Phase 4 §6).

  **This is the finding that justifies the whole review step.** Criterion 4.5 was
  marked verified against a screenshot taken with print media emulated at a
  **1280px viewport** — so the `md:` breakpoint still applied and the capture showed
  exactly what I wanted to see. The defect is invisible to that method and obvious
  the moment you measure at the width a printer actually has. Reproduced at 717px
  before fixing (tabs at y=186 and y=411, grid `717px`), and confirmed after
  (`sideBySide: true`, grid `350.5px 350.5px`).

- **Fix**: `.variant-grid` forced to two columns inside `@media print`.
- **Decision**: FIXED

### F2 — Deferred teeth would have printed identically to teeth in the plan

- **Severity**: ⚠️ WARNING · **Impact**: 🔎 MEDIUM · **Dimension**: Safety & Quality
- **Location**: `src/components/patient/DeferredSection.astro`, `src/styles/global.css`
- **Detail**: The section's distinction rests on a hatched rule drawn as a
  `background-image`, and browsers suppress background images in print unless the
  reader ticks "Background graphics" — while the print block deliberately undoes the
  dimming. Net effect on paper: no dimming _and_ no hatch, so deferred teeth looked
  exactly like teeth in the plan. That is the single thing the section exists to
  prevent, on a document whose whole point is being printed and shown to whoever is
  paying.
- **Fix**: `print-color-adjust: exact` on the hatch, plus a `border-top: 3px double`
  fallback under `@media print` — a border is never background-suppressed. Verified:
  print at A4 reports `3px double` and `printColorAdjust: exact`; screen still shows
  the 4px gradient and no border.
- **Decision**: FIXED

### F3 — Dimmed clinical text fell to 2.72:1

- **Severity**: ⚠️ WARNING · **Impact**: 🏃 LOW · **Dimension**: Safety & Quality
- **Location**: `src/components/patient/DeferredSection.astro`
- **Detail**: `opacity-65` on the section composed with `text-muted-foreground` on its
  descendants and the two dims multiplied — 5.55:1 became 2.72:1, under the AA floor,
  on patient-facing clinical text about the reader's own mouth. The brief rules out a
  WCAG audit but explicitly keeps text contrast in scope.
- **Fix**: one dimming mechanism, not two — the muted class comes off inside the dimmed
  section. Measured after: **4.65:1** in the deferred section, 13.74:1 undimmed.
- **Decision**: FIXED

### F4 — An out-of-plan tooth row read as disabled while fully live

- **Severity**: ⚠️ WARNING · **Impact**: 🔎 MEDIUM · **Dimension**: Safety & Quality
- **Location**: `src/components/admin/ToothRow.tsx`
- **Detail**: `out-of-current-plan` dimmed the whole row to 65%, but every control inside
  stayed enabled — and the control you need in order to put the tooth _back_ in the plan
  is the Status select, which was itself dimmed. Same contrast composition as F3 applied
  to the note placeholder and the item-removal buttons.
- **Fix**: status is signalled by outline and a muted ground, never by opacity, matching
  the rule already used for `uncertain`. Controls stay at full strength.
- **Decision**: FIXED

### F5 — The action bar's height was a hard-coded guess

- **Severity**: ⚠️ WARNING · **Impact**: 🔎 MEDIUM · **Dimension**: Safety & Quality
- **Location**: `src/components/admin/QuoteEditor.tsx`
- **Detail**: A `fixed` bar sits outside the flow, so the container reserved its height by
  hand (`pb-28`, 112px). That reserve is wrong the moment the bar grows a wrapped error
  line — measured at 91px with one reason line, and it takes only one more to exceed the
  reserve and cover the last tooth row. A fixed bar can also park over a control
  Playwright has just scrolled to and eat the click, failing a spec with a message that
  never mentions a bar.
- **Fix**: `position: sticky` instead. It occupies real space at the end of the flow, so
  it cannot overlap anything by construction, and still pins to the bottom while there is
  more form below. The reserve — and the guess — is gone. Measured at 375px with 20 teeth:
  16px gap below the last section, approve reason inside the bar.
- **Decision**: FIXED

### F6 — `CLAUDE.md` pointed at a file this branch deletes

- **Severity**: ⚠️ WARNING · **Impact**: 🏃 LOW · **Dimension**: Pattern Consistency
- **Location**: `CLAUDE.md:31`, `context/deployment/deploy-plan.md:19`, `context/foundation/roadmap.md:55`
- **Detail**: "Protected page example: `src/pages/dashboard.astro`". This is the live
  agent-rules file, so a dead pointer here is read as current by the next session — more
  costly than a stale planning document.
- **Fix**: repointed to `src/pages/admin/index.astro`; the deploy plan and the roadmap's
  page inventory corrected in the same pass.
- **Decision**: FIXED

### F7 — A blanket `section { break-inside: avoid }` prints worse than no rule

- **Severity**: ⚠️ WARNING · **Impact**: 🏃 LOW · **Dimension**: Safety & Quality
- **Location**: `src/styles/global.css`
- **Detail**: Applied to every `<section>`, including blocks that grow with the tooth
  count. `break-inside: avoid` on a block taller than a page is a hint the engine must
  eventually violate, usually by pushing the whole block to a fresh page and leaving a
  blank one behind.
- **Fix**: scoped to the units that are actually page-sized — the quadrant blocks, list
  items, and `.variant`.
- **Decision**: FIXED

### F8 — Print chrome was hidden by positioning utility rather than by intent

- **Severity**: 💡 OBSERVATION · **Impact**: 🏃 LOW · **Dimension**: Pattern Consistency
- **Location**: `src/styles/global.css`
- **Detail**: `header.sticky, .fixed { display: none }` would silently eat any future
  dialog, toast or consent bar that happens to be fixed, with nothing to grep for. It also
  broke the moment the action bar stopped being `fixed` (F5).
- **Fix**: a `no-print` class, applied explicitly to the Topbar and the action bar.
- **Decision**: FIXED

### F9 — `URGENCY_MARK` was defined twice, and S-06 would have made three

- **Severity**: 💡 OBSERVATION · **Impact**: 🏃 LOW · **Dimension**: Architecture
- **Location**: `src/components/admin/ToothRow.tsx`, `src/components/patient/ToothGroups.astro`
- **Detail**: Character-identical lookup tables in two files, with the same comment
  explaining the same reasoning. This codebase already has the right home for exactly this
  shape — `src/lib/quote/labels.ts`, shared by the editor and the patient page.
- **Fix**: extracted to `src/lib/quote/marks.ts` alongside it, so S-06 finds it rather than
  writing a third copy.
- **Decision**: FIXED

### F10 — Patient prose never reached the brief's type spec

- **Severity**: ⚠️ WARNING · **Impact**: 🏃 LOW · **Dimension**: Plan Adherence
- **Location**: `src/components/patient/PatientQuote.astro`
- **Detail**: The brief specifies 17px Literata at 1.65 with the measure capped at 68
  characters. Actual was `max-w-3xl` (~95ch) with sections at 14px `text-sm` — a form size
  inherited from the admin conventions the components were built alongside. Phase 4's
  contract did not restate the spec, so it passed the phase gate unnoticed.
- **Fix**: the reading setting moved onto the container, where it belongs.
- **Decision**: FIXED

### F11 — Two smaller drifts and one stale contract

- **Severity**: 💡 OBSERVATION · **Impact**: 🏃 LOW · **Dimension**: Plan Adherence
- **Detail**: `PatientError.astro` set only its heading in Literata, so its body copy came
  out in Archivo while `PatientQuote` uses the opposite convention. `ToothGroups`' comment
  claimed "right before left within a jaw", which is not what `GROUPS` does — it is FDI
  quadrant order (1,2,3,4, clockwise), and the brief's ASCII diagram was wrong too. The
  plan still named `standard.css` after the font change shipped, and criterion 5.1's grep
  wording counted an explanatory comment as a hit.
- **Fix**: all corrected. `label.tsx` also picked up `leading-snug` — shadcn's
  `leading-none` assumes a one-word label beside a checkbox, and this editor uses Label for
  two wrapping sentences.
- **Decision**: FIXED

### F12 — Unlisted scope

- **Severity**: 💡 OBSERVATION · **Impact**: 🏃 LOW · **Dimension**: Scope Discipline
- **Detail**: Accepted, recorded rather than reverted: the emoji dropped from
  `confirm-email.astro`; `←` removed from the editor's back link; tooth-entry warnings moved
  from destructive red to the warning ochre (the plan sanctioned this only for
  `ParseWarnings`); `@utility numeric` and the `--chart-*` remap onto the clinical ramp. All
  follow the brief's rules; none were named in the plan. The landing's sample tabs were
  `<h2>`s duplicating two heading names the patient-page contract owns — changed to `<p>`,
  since they are an illustration rather than document structure.
- **Decision**: ACCEPTED (landing headings FIXED)
