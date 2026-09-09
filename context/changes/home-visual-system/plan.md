# Home and visual system implementation plan

## Overview

Turn the approved local home prototype into the production `/` page and use its
typography, semantic palette, geometry, identity, and spacing across every
DentiPlan surface. The work changes presentation only: routes, data, APIs,
application state, accessible names, and approval semantics stay fixed.

## Current State Analysis

The live application already has a coherent visual system, but it is the
previous direction. `src/styles/global.css` defines enamel/blue-black base
tokens, Archivo as the interface face, Literata as the patient reading face,
and a small global radius. Every route imports those foundations through
`src/layouts/Layout.astro`.

The approved prototype changes the brand anchors to cream, plum, coral, and
lavender, replaces both fonts with Manrope and Fraunces, makes primary marketing
actions pill-shaped, and expands the home into a full narrative. Because the
live code assigns semantic meaning to `font-sans`, `font-serif`, base tokens,
and radius, copying the prototype's stylesheet would create two conflicting
systems rather than migrate one.

Three structural boundaries constrain the migration:

1. `Layout.astro` wraps public and authenticated pages. It filters configuration
   banners by `Astro.locals.user` and must remain free of request-generated
   output because the patient-token probe compares unavailable responses byte
   for byte (`src/layouts/Layout.astro:20-56`).
2. The product uses three distinct content measures: broad marketing, dense
   workspace, and narrow patient document. The editor island owns its current
   shell, while Topbar is explicit authenticated chrome rather than global
   layout (`src/components/Topbar.astro:12-42`,
   `src/components/admin/QuoteEditor.tsx:566-820`).
3. Clinical colours and status marks are domain semantics. Urgency uses mark/ink
   pairs; tooth status uses words, stroke, and hatch; destructive and focus are
   separate roles (`src/styles/global.css:36-76`,
   `src/lib/quote/marks.ts:24-89`). Brand coral cannot replace them by accident.

### Key Discoveries

- The prototype's later CSS pass is authoritative: Manrope is the working/body
  face and Fraunces is a selective editorial accent
  (`prototypes/dentiplan-home/index.html:11-28`).
- `font-serif` currently reaches patient body copy as well as headings, so a
  global font alias swap without consumer edits would render long text in
  Fraunces (`src/components/patient/PatientQuote.astro:49-54`).
- No current E2E spec visits `/`; a single home-only spec is needed for route,
  anchor, semantic, and 375 px overflow contracts.
- Existing specs freeze accessible names on auth, admin, editor, confirmation,
  patient, and QR surfaces. They also require the admin list to remain a table.
- Print already forces the treatment comparison into two columns at 717 px and
  preserves status without relying on background graphics
  (`src/styles/global.css:174-318`, `e2e/patient-print-layout.spec.ts:65-93`).
- The prototype directory contains a minified HTML file and two obsolete Archivo
  binaries. None belongs in product history.

## Desired End State

The production home matches the prototype's composition, hierarchy, copy, and
character at 1440, 768, and 375 px. All product surfaces use Manrope/Fraunces,
the new semantic base palette, one shared wordmark, and named marketing,
workspace, and document measures. The admin remains a dense tool, while the
patient page remains a calm printable document.

Clinical meaning, keyboard focus, accessible roles/names, banner disclosure,
and route behaviour are unchanged. At A4 width the two treatment variants stay
side by side, statuses survive without colour/backgrounds, and the QR plus full
address remains readable.

Verification is complete when lint, Astro check, 167 unit tests or more, build,
and the full E2E suite are green; the only E2E addition is the home spec;
Archivo/Literata and the previous base anchors have no active consumers; the
prototype path is narrowly ignored and has no tracked files; and a real A4 PDF
passes the document contract.

## What We're NOT Doing

- Changing API routes, database schema, LLM behaviour, calculations, auth, or
  approval state.
- Adding patient data, a live example quote, or a database/session dependency to
  the home.
- Copying or editing prototype HTML, CSS, fonts, or other assets.
- Loading fonts from Google Fonts or another CDN.
- Replacing clinical urgency/status semantics with the brand accent.
- Introducing an animation library, a formal WCAG audit, or a designed dark
  mode.
- Editing existing E2E specs or their locators.
- Adding application behaviour beyond the home navigation links and anchors.

## Implementation Approach

Work bottom-up and keep each commit revertable: establish the shared visual
foundation, build the home, migrate the entry/workspace surfaces, migrate the
editor, migrate the patient document/print, then remove dead visual vocabulary
and update product documentation. Every UI phase ends with the full existing
E2E suite, so a regression is attributable to one bounded surface change.

Marketing-specific illustration styles stay local to the home. Shared semantic
roles and layout utilities live in `global.css`; shared identity lives in a
small Astro wordmark component; authenticated chrome remains explicit in
Topbar; domain renderers continue to own clinical status.

## Critical Implementation Details

**The font migration must be atomic at the semantic level.** Phase 1 maps both
the default working role and the temporary legacy `font-serif` compatibility
role to Manrope, while exposing Fraunces only through a new explicit editorial
utility. Phases 2–5 replace every legacy use according to intent; Phase 6 proves
zero consumers and removes the compatibility alias. Fraunces is never the
automatic meaning of an old `font-serif` class.

**Nothing request-specific enters `Layout.astro`.** Preserve the existing banner
filter exactly in behaviour and keep the unavailable patient page deterministic.
The global stylesheet must also avoid the substrings guarded by the byte-level
patient probe.

**Print verification uses the medium's width.** A print-emulated 1280 px page is
not proof. Use the existing 717 px geometry check and generate a real A4 PDF;
status meaning must survive with backgrounds disabled.

---

## Phase 1: Visual foundation and shared primitives

### Overview

Replace the global brand foundations while preserving clinical semantics and
layout/security boundaries. Establish reusable identity, measures, and control
geometry before migrating page composition.

### Changes Required

#### 1. Prototype boundary

**File**: `.gitignore`

**Intent**: Keep the approved local input out of product history without hiding
other prototype work.

**Contract**: Add exactly `/prototypes/dentiplan-home/`. Both
`git check-ignore prototypes/dentiplan-home/index.html` and zero output from
`git ls-files -- prototypes/dentiplan-home` are required before every commit.

#### 2. Bundled font dependencies and imports

**Files**: `package.json`, `package-lock.json`, `src/layouts/Layout.astro`

**Intent**: Replace Archivo/Literata with Manrope/Fraunces as bundled variable
fonts including Polish glyphs.

**Contract**: Dependencies are `@fontsource-variable/manrope` and
`@fontsource-variable/fraunces`; `Layout.astro` imports local package entrypoints
with latin-ext coverage and no CDN. Preserve title/lang slots, the banner filter,
and request-deterministic markup.

#### 3. Semantic tokens, type roles, and layout measures

**File**: `src/styles/global.css`

**Intent**: Translate the prototype anchors into the product token vocabulary
and define reusable marketing/workspace/document measures and gutters.

**Contract**: Base roles use the design brief's OKLCH targets; a dedicated brand
accent does not alias urgency/destructive/ring; `font-sans` and `numeric` use
Manrope with tabular figures. During the surface migration, legacy `font-serif`
also resolves to Manrope; Fraunces is exposed only through an explicit editorial
utility. Three named shell utilities replace page-level container arithmetic.
Dark tokens remain complete but are not a designed deliverable. Existing print
rules stay in force until Phase 5.

#### 4. Shared identity and chrome

**Files**: `src/components/Wordmark.astro`, `src/components/Topbar.astro`,
`src/components/Banner.astro`

**Intent**: Provide one tooth mark/wordmark and align shared chrome with the new
palette and measures.

**Contract**: Wordmark supports link and non-link contexts without duplicated
accessible text. Topbar remains admin-only, sticky, and `no-print`, keeps the
signed-in e-mail and `Wyloguj`, and does not add `Nowy kosztorys`. Banner keeps
its `alert`/`status` roles and authenticated/public filtering.

#### 5. Shared controls

**Files**: `src/components/ui/button.tsx`, `src/components/ui/input.tsx`,
`src/components/ui/textarea.tsx`, `src/components/ui/badge.tsx`,
`src/components/ui/info-hint.tsx`, `src/components/admin/controls.tsx`

**Intent**: Introduce the prototype's pill action treatment without turning
fields, tables, cards, badges, or chart surfaces into pills.

**Contract**: Primary/panel-entry actions can render a pill with a circular icon
field; fields and cards retain moderate radii; badges retain their token shape;
focus-visible, disabled, invalid, warning, and destructive states remain
distinguishable on the new surfaces.

### Success Criteria

#### Automated Verification

- Prototype ignore is narrow and the directory has zero tracked files.
- Manrope/Fraunces are installed and imported with no active Archivo/Literata references.
- Base-token contrast checks pass for foreground, muted text, primary controls, focus, and clinical text on the new surfaces.
- `npm run lint`, `npx astro check`, `npm test`, and `npm run build` pass.
- `npm run test:e2e` passes without edits to existing specs.

#### Manual Verification

- Shared wordmark and representative controls render coherently on home, auth, admin, and patient shells; final aesthetic approval remains in the later visual review.

---

## Phase 2: Production home

### Overview

Replace the current compact landing page with the full approved composition and
add the only new E2E spec in this change.

### Changes Required

#### 1. Home composition

**Files**: `src/pages/index.astro`, `src/components/home/TreatmentPlanIllustration.astro`

**Intent**: Recreate the prototype's header, hero transformation, ribbon, three
steps, closing CTA, and footer in maintainable Astro/Tailwind.

**Contract**: Header and footer use `Wordmark.astro`. The illustration is static,
accessible, and labelled as invented; monetary values pass through
`formatAmount`. `Jak to działa` targets `#jak-to-dziala`; `Dla pacjenta` and
`Zobacz przykładowy plan` target `#dla-pacjenta`; all practice CTAs are real
links to `/auth/signin`. Nothing reads session, token, database, or price-list
state. The prototype footer note does not ship.

#### 2. Home behaviour contract

**File**: `e2e/home-page.spec.ts`

**Intent**: Protect navigation, landmarks, and narrow-screen containment without
freezing decorative markup or pixels.

**Contract**: Assert one `h1`, both anchor targets, every practice CTA's
`/auth/signin` destination, and `document.documentElement.scrollWidth <=
document.documentElement.clientWidth` at 375 px. Exercise 1440, 768, and 375 px
layouts without visual snapshots.

### Success Criteria

#### Automated Verification

- `e2e/home-page.spec.ts` passes at the three target widths and proves CTA/anchor destinations plus no 375 px overflow.
- `npm run lint`, `npx astro check`, and `npm run build` pass.
- `npm run test:e2e` passes, and the only E2E diff is the new home spec.
- The home ships no prototype asset, external font request, session data, or client-side JavaScript for static decoration.

#### Manual Verification

- Captures at 1440, 768, and 375 px are ready for the non-blocking final visual review against the prototype.

---

## Phase 3: Entry and workspace surfaces

### Overview

Apply the shared system to sign-in, admin chrome, the quote list, approval, and
page-level empty/error states without changing their semantic contracts.

### Changes Required

#### 1. Sign-in states

**Files**: `src/pages/auth/signin.astro`, `src/components/auth/SignInForm.tsx`,
`src/components/auth/FormField.tsx`, `src/components/auth/PasswordToggle.tsx`,
`src/components/auth/SubmitButton.tsx`, `src/components/auth/ServerError.tsx`

**Intent**: Make authentication feel like the same product while retaining its
existing form behaviour.

**Contract**: Use the document language `en`, the shared wordmark, workspace
geometry, and existing endpoint. Accessible names remain `Email`, `Password`,
and `Sign in`; the password control retains `Show password` / `Hide password`;
no sign-up path appears; loading, invalid, and server-error states remain visible
and keyboard reachable.

#### 2. Admin list and page shells

**Files**: `src/pages/admin/index.astro`, `src/pages/admin/quotes/new.astro`,
`src/pages/admin/quotes/[id].astro`

**Intent**: Replace scattered container classes with the workspace measure and
align headings, empty/error states, table, and route shells.

**Contract**: The list remains a real table with horizontal overflow handling.
Keep `Kosztorysy`, `Nowy kosztorys`, `Szkic`, `Usuń`, and `Na pewno?` and all
route/auth behaviour. New and existing quote pages keep Topbar explicit; the
editor continues to own its inner shell.

#### 3. Approval and row actions

**Files**: `src/components/admin/ApprovalConfirmation.tsx`,
`src/components/admin/CopyLink.tsx`, `src/components/admin/DeleteQuoteButton.tsx`

**Intent**: Bring terminal and destructive actions into the new hierarchy.

**Contract**: Approval keeps heading `Kosztorys zatwierdzony`, exactly one link
textbox, QR/link content, and return navigation. Delete retains its two-step
accessible-name transition. Styling does not change requests or state.

### Success Criteria

#### Automated Verification

- Auth E2E retains `Email`, `Password`, `Sign in`, no sign-up, and successful redirect.
- Admin E2E retains the semantic table, strict `Nowy kosztorys` locator, draft row actions, and approval confirmation.
- `npm run lint`, `npx astro check`, `npm test`, and `npm run build` pass.
- `npm run test:e2e` passes without edits to existing specs.

#### Manual Verification

- Sign-in, populated/empty/error list states, approval, and not-found state use one visual hierarchy at desktop and 375 px.

---

## Phase 4: Quote editor

### Overview

Migrate the longest and densest surface section by section while leaving React
state, disclosure, validation, calculations, and request payloads untouched.

### Changes Required

#### 1. Editor shell, disclosure, and actions

**File**: `src/components/admin/QuoteEditor.tsx`

**Intent**: Apply the workspace measure, typography, section rhythm, operation
overlay, and sticky-action geometry to the editor.

**Contract**: Preserve prefill merge/reveal/focus behaviour, manual disclosure,
scroll stability, validation, save/approve handlers, and button names. The sticky
bar remains in flow, `no-print`, and usable at 375 px with long content and long
warnings.

#### 2. Editor sections and totals

**Files**: `src/components/admin/ToothRow.tsx`,
`src/components/admin/GeneralItems.tsx`,
`src/components/admin/PricelistPicker.tsx`,
`src/components/admin/ParseWarnings.tsx`,
`src/components/admin/TotalsPreview.tsx`, `src/components/admin/VisitList.tsx`

**Intent**: Apply the new moderate card/input geometry and typographic rhythm to
all editor sections.

**Contract**: Keep labels and control roles, live enabled states, urgency/status
marks, visit ordering and editing, price formatting, and error/warning meaning.
Do not apply container opacity to interactive rows.

#### 3. Interactive odontogram and patient-link block

**Files**: `src/components/tooth-chart/ToothChart.tsx`,
`src/components/tooth-chart/ToothTooltip.tsx`,
`src/components/tooth-chart/ChartLegend.tsx`, `src/components/admin/QrCode.tsx`

**Intent**: Place the chart, tooltip, legend, and QR/link output on the new soft
surfaces without changing their data or interaction model.

**Contract**: Tooth fill/stroke still comes from clinical marks; click, focus,
hover, and tooltip behaviour remain intact; QR remains black/white with quiet
zone and region name `Kod QR linku dla pacjenta`; the full URL remains available.

### Success Criteria

#### Automated Verification

- Editor disclosure, prefill success/failure focus, save/reopen, approve, visit, and odontogram E2E contracts pass unchanged.
- Computed chart fills and status strokes still agree with the written tooth list and legend.
- `npm run lint`, `npx astro check`, `npm test`, and `npm run build` pass.
- `npm run test:e2e` passes without edits to existing specs.

#### Manual Verification

- The editor remains operable at 375 px with a long note, long warnings, multiple visits, and the sticky actions visible without covering content.

---

## Phase 5: Patient document and A4 print

### Overview

Apply the new brand system to the patient document and generic error while
preserving document hierarchy, disclosure boundaries, clinical redundancy, and
the paper contract.

### Changes Required

#### 1. Patient document hierarchy

**Files**: `src/components/patient/PatientQuote.astro`,
`src/components/patient/VariantComparison.astro`,
`src/components/patient/ToothGroups.astro`,
`src/components/patient/DeferredSection.astro`,
`src/components/patient/ScenariosSection.astro`,
`src/components/patient/Disclaimer.astro`

**Intent**: Use Manrope for reading/figures and Fraunces for selected editorial
headings, with new surfaces and spacing around the existing content order.

**Contract**: Keep all patient headings/copy located by E2E, comparison first,
odontogram plus accessible list, one dimming mechanism, word/stroke/hatch status
carriers, disclaimer role, and no admin-only fields. Recommendation remains
textual plus structural.

#### 2. Deterministic patient error

**Files**: `src/components/patient/PatientError.astro`, `src/pages/p/[token].astro`

**Intent**: Align the unavailable-link surface with the document system.

**Contract**: All unavailable-token branches emit the same static component,
status, and bytes; no route-, token-, time-, or request-dependent output is
introduced; protected substrings remain absent.

#### 3. Print tokens and geometry

**File**: `src/styles/global.css`

**Intent**: Reconcile the new base palette/type with the existing black-on-white
A4 document.

**Contract**: At approximately 717 px printable width, variants use two columns;
recommendation survives through text/edge; deferred/uncertain status survives
without background graphics; chart and legend remain bounded; QR stays 2.5 cm
with quiet zone; full `Wersja online:` address wraps; disclaimer remains. Print
does not depend on screen breakpoints.

#### 4. Reproducible A4 verifier

**File**: `scripts/verify-patient-print.ts`

**Intent**: Make the non-E2E part of the print contract repeatable without
editing the frozen browser specs.

**Contract**: The script accepts an absolute patient URL and output path, opens
Chromium at a 717 px printable viewport with `print` media and background
graphics disabled, asserts both variant headings and status labels, measures the
variant top edges, footer bounds, and approximately 2.5 cm QR box, then emits an
A4 PDF. Run it as
`node --import tsx scripts/verify-patient-print.ts <patient-url> /tmp/dentiplan-patient-a4.pdf`.

### Success Criteria

#### Automated Verification

- Existing patient content, no-disclosure, tooth-chart, QR, and 717 px print-layout E2E specs pass unchanged.
- `node --import tsx scripts/verify-patient-print.ts <patient-url> /tmp/dentiplan-patient-a4.pdf` generates A4 and passes variant, status, URL, QR-size, and footer-bound checks.
- `npm run lint`, `npx astro check`, `npm test`, and `npm run build` pass.
- `npm run test:e2e` passes without edits to existing specs.

#### Manual Verification

- The generated A4 PDF is ready for non-blocking visual confirmation of the chart, disclaimer, QR, and full address with background graphics disabled.

---

## Phase 6: Contract cleanup and product documentation

### Overview

Remove obsolete visual vocabulary, record the new regression risk, and make
product documentation describe the system that now ships.

### Changes Required

#### 1. Visual-regression risk

**File**: `context/foundation/test-plan.md`

**Intent**: Add risk #14 for a product-wide style change silently breaking home
navigation/phone containment or a protected product surface.

**Contract**: Name the risk in user terms; map deterministic home navigation and
375 px overflow to the new spec; map existing surface semantics to unchanged
E2E; keep aesthetic judgement and pixel snapshots out of the automated suite;
retain A4 geometry as its separate print contract.

#### 2. Roadmap state

**File**: `context/foundation/roadmap.md`

**Intent**: Record `home-visual-system` as the delivered product slice.

**Contract**: Add S-11 to the at-a-glance table and detailed/done history with
the production outcome, source brief, dependencies, and status `done`; update
the baseline's typography/palette description so it no longer claims
Archivo/Literata and the old anchors are current.

#### 3. Public project description

**File**: `README.md`

**Intent**: Correct only statements made false by the home and font migration.

**Contract**: Replace the stack's Archivo/Literata statement with
Manrope/Fraunces and update any old-home description or image if present. Do not
broaden the product claims.

#### 4. Dead visual vocabulary and final gate

**Files**: `src/styles/global.css`, affected files under `src/`

**Intent**: Remove obsolete aliases, classes, comments, imports, and old base
values after all consumers have migrated.

**Contract**: `rg` finds no active Archivo/Literata references, legacy
`font-serif` consumers/compatibility alias, or previous base anchors
(`oklch(0.985 0.004 95)`, `oklch(0.28 0.042 205)`,
`oklch(0.33 0.055 205)`), except immutable historical/archive content; no raw
prototype base colours are repeated in components; the prototype remains
ignored/untracked; existing E2E specs and Playwright configuration have an empty
diff, with `e2e/home-page.spec.ts` the sole addition.

### Success Criteria

#### Automated Verification

- `rg` confirms no active Archivo/Literata, legacy `font-serif`, previous base anchors, stale font-role comments, or raw repeated prototype anchors in `src/` and package manifests.
- `git check-ignore` identifies the narrow prototype rule and `git ls-files -- prototypes/dentiplan-home` is empty.
- `git diff main...HEAD -- e2e playwright.config.ts` contains only `e2e/home-page.spec.ts`.
- `npm run lint`, `npx astro check`, `npm test`, `npm run build`, and `npm run test:e2e` all pass.
- `context/foundation/test-plan.md`, `context/foundation/roadmap.md`, and `README.md` describe the shipped system and risk boundary.

#### Manual Verification

- Final desktop/mobile/document captures and the A4 PDF are ready for product-owner visual review without blocking integration.

---

## Testing Strategy

### Unit Tests

- Keep all existing domain, pricing, QR, clinical-style, and configuration tests
  green; presentation work must not change their inputs or outputs.
- Add no unit test for static home decoration. Its meaningful contracts live at
  the browser level.
- Use computed-style/contrast checks only for semantic token pairs where a
  deterministic numeric assertion protects clinical readability.

### Integration and End-to-End Tests

- Add only `e2e/home-page.spec.ts` for home routes, anchors, one `h1`, and 375 px
  containment.
- Run the full E2E suite after each phase touching `src/components/`,
  `src/pages/`, or `src/layouts/`.
- Keep every existing spec and locator unchanged. A red existing spec means the
  implementation broke a product contract.
- Preserve the 717 px print geometry test and supplement it with a real A4 PDF
  check rather than a visual snapshot suite.

### Manual Testing Steps

1. Compare captured home at 1440, 768, and 375 px with the approved prototype.
2. Keyboard-navigate home, sign-in, admin list, and editor; confirm focus is
   visible and navigation order follows reading order.
3. Exercise populated, empty, loading, validation, server-error, approval, and
   unavailable-link states at desktop and 375 px.
4. Print the known patient page to A4 with background graphics disabled; confirm
   comparison, statuses, disclaimer, QR, and URL remain legible.

The product-owner visual review is tracked separately and does not stop the
implementation phases; deterministic checks and existing behaviour gates do.

## Performance Considerations

- Use the two variable font families from npm with latin-ext coverage and no
  remote requests. Check emitted font assets after build and avoid importing
  unused axes/subsets.
- Keep the home illustration server-rendered Astro/SVG/HTML with no hydrated
  island and no animation dependency.
- Preserve current React-island boundaries; the visual migration must not add a
  new client bundle to static pages.

## Migration and Rollback Notes

There is no data or API migration. Each phase is one commit and can be reverted
independently. If a surface regression cannot be corrected in one focused pass,
revert that phase rather than weakening an existing E2E contract. The prototype
never enters history, so rollback does not depend on deleting imported assets.

## References

- Approved direction: `context/changes/home-visual-system/design-brief.md`
- Codebase map: `context/changes/home-visual-system/research.md`
- Prior visual system: `context/archive/2026-09-05-ui-redesign/design-brief.md`
- Recurring print/contrast rules: `context/foundation/lessons.md`
- Test strategy: `context/foundation/test-plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `.claude/skills/10x-plan/references/progress-format.md`.

### Phase 1: Visual foundation and shared primitives

#### Automated

- [x] 1.1 Prototype ignore is narrow and the directory has zero tracked files. — f2836e7
- [x] 1.2 Manrope/Fraunces are installed and imported with no active Archivo/Literata references. — f2836e7
- [x] 1.3 Base-token contrast checks pass for foreground, muted text, primary controls, focus, and clinical text on the new surfaces. — f2836e7
- [x] 1.4 `npm run lint`, `npx astro check`, `npm test`, and `npm run build` pass. — f2836e7
- [x] 1.5 `npm run test:e2e` passes without edits to existing specs. — f2836e7

#### Manual

- [x] 1.6 Shared wordmark and representative controls render coherently on home, auth, admin, and patient shells; final aesthetic approval remains in the later visual review. — f2836e7

### Phase 2: Production home

#### Automated

- [x] 2.1 `e2e/home-page.spec.ts` passes at the three target widths and proves CTA/anchor destinations plus no 375 px overflow. — 84207fc
- [x] 2.2 `npm run lint`, `npx astro check`, and `npm run build` pass. — 84207fc
- [x] 2.3 `npm run test:e2e` passes, and the only E2E diff is the new home spec. — 84207fc
- [x] 2.4 The home ships no prototype asset, external font request, session data, or client-side JavaScript for static decoration. — 84207fc

#### Manual

- [x] 2.5 Captures at 1440, 768, and 375 px are ready for the non-blocking final visual review against the prototype. — 84207fc

### Phase 3: Entry and workspace surfaces

#### Automated

- [x] 3.1 Auth E2E retains `Email`, `Password`, `Sign in`, no sign-up, and successful redirect. — 97c41c8
- [x] 3.2 Admin E2E retains the semantic table, strict `Nowy kosztorys` locator, draft row actions, and approval confirmation. — 97c41c8
- [x] 3.3 `npm run lint`, `npx astro check`, `npm test`, and `npm run build` pass. — 97c41c8
- [x] 3.4 `npm run test:e2e` passes without edits to existing specs. — 97c41c8

#### Manual

- [x] 3.5 Sign-in, populated/empty/error list states, approval, and not-found state use one visual hierarchy at desktop and 375 px. — 97c41c8

### Phase 4: Quote editor

#### Automated

- [x] 4.1 Editor disclosure, prefill success/failure focus, save/reopen, approve, visit, and odontogram E2E contracts pass unchanged.
- [x] 4.2 Computed chart fills and status strokes still agree with the written tooth list and legend.
- [x] 4.3 `npm run lint`, `npx astro check`, `npm test`, and `npm run build` pass.
- [x] 4.4 `npm run test:e2e` passes without edits to existing specs.

#### Manual

- [x] 4.5 The editor remains operable at 375 px with a long note, long warnings, multiple visits, and the sticky actions visible without covering content.

### Phase 5: Patient document and A4 print

#### Automated

- [ ] 5.1 Existing patient content, no-disclosure, tooth-chart, QR, and 717 px print-layout E2E specs pass unchanged.
- [ ] 5.2 `node --import tsx scripts/verify-patient-print.ts <patient-url> /tmp/dentiplan-patient-a4.pdf` generates A4 and passes variant, status, URL, QR-size, and footer-bound checks.
- [ ] 5.3 `npm run lint`, `npx astro check`, `npm test`, and `npm run build` pass.
- [ ] 5.4 `npm run test:e2e` passes without edits to existing specs.

#### Manual

- [ ] 5.5 The generated A4 PDF is ready for non-blocking visual confirmation of the chart, disclaimer, QR, and full address with background graphics disabled.

### Phase 6: Contract cleanup and product documentation

#### Automated

- [ ] 6.1 `rg` confirms no active Archivo/Literata, legacy `font-serif`, previous base anchors, stale font-role comments, or raw repeated prototype anchors in `src/` and package manifests.
- [ ] 6.2 `git check-ignore` identifies the narrow prototype rule and `git ls-files -- prototypes/dentiplan-home` is empty.
- [ ] 6.3 `git diff main...HEAD -- e2e playwright.config.ts` contains only `e2e/home-page.spec.ts`.
- [ ] 6.4 `npm run lint`, `npx astro check`, `npm test`, `npm run build`, and `npm run test:e2e` all pass.
- [ ] 6.5 `context/foundation/test-plan.md`, `context/foundation/roadmap.md`, and `README.md` describe the shipped system and risk boundary.

#### Manual

- [ ] 6.6 Final desktop/mobile/document captures and the A4 PDF are ready for product-owner visual review without blocking integration.
