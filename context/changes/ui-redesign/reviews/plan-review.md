<!-- PLAN-REVIEW-REPORT -->

# Plan Review: UI redesign implementation plan

- **Plan**: `context/changes/ui-redesign/plan.md`
- **Mode**: Deep — codebase verification done in the main context rather than through a
  sub-agent, because this session's method keeps the implementation thread single-threaded
  and the files under review were already read in full while planning.
- **Date**: 2026-09-05
- **Verdict**: REVISE → SOUND after fixes
- **Findings**: 0 critical, 4 warnings, 1 observation

## Verdicts

| Dimension             | Verdict | After fixes |
| --------------------- | ------- | ----------- |
| End-State Alignment   | WARNING | PASS        |
| Lean Execution        | WARNING | PASS        |
| Architectural Fitness | PASS    | PASS        |
| Blind Spots           | WARNING | PASS        |
| Plan Completeness     | WARNING | PASS        |

## Grounding

10/10 paths exist, 2/2 symbols found (`publicMissingConfigs` in `Layout.astro` and
`config-status.ts`), brief↔plan consistent, `## Progress` well-formed (5 phases, every
Success Criteria bullet mirrored, no stray checkboxes in phase blocks).

`docs/reference/contract-surfaces.md` was checked: none of its three surfaces
(`F-01 — Quotes Data Foundation`, `F-02 — Pricelist Seed`,
`Invariant — content is patient-visible verbatim`) appear in the plan, and the change
shapes no `content`, so no surface is touched.

## Findings

### F1 — `bg-cosmic` is deleted in phase 1 but has consumers until phase 5

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 §2 (Tokens) vs Phase 2 and Phase 5
- **Detail**: Phase 1 removed `@utility bg-cosmic` from `global.css`, but `grep -rn bg-cosmic src/`
  finds six consumers: `auth/{signin,signup,confirm-email}.astro` and `dashboard.astro`
  (phase 5), plus `Welcome.astro` (phase 5). Tailwind emits nothing for an undefined
  utility rather than failing the build, so the effect is silent: those pages lose their
  background for three phases, and phase 1's own manual check ("no cosmic gradient
  remains") passes while the class is still throughout `src/`.
- **Fix**: Phase 1 stops using it; phase 5 deletes it alongside its last consumers.
- **Decision**: FIXED

### F2 — Ownership of the Topbar adoption is specified in two phases

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 §5 and Phase 3 §§1–2
- **Detail**: Phase 1 said "rebuild as the panel's chrome **and adopt it in the three admin
  pages**"; phase 3's contracts also say each admin page "adopts Topbar". Neither lint nor
  `astro check` flags an unused `.astro` component, so whichever phase skips it does so
  silently, and the admin pages sit chrome-less in between.
- **Fix**: Phase 1 builds it, phase 3 adopts it — stated explicitly in both.
- **Decision**: FIXED

### F3 — A bottom-anchored action bar can cover the form's last row and the save confirmation

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Lean Execution
- **Location**: Phase 3 §3 (The editor)
- **Detail**: Moving `Zatwierdź` / `Zapisz szkic` into a viewport-anchored bar without
  reserving space overlays the last tooth row at 375px. It also sits exactly where
  `Zapisano <time>` renders — the string `seed.spec.ts:47` waits for to confirm a save —
  so an overlay there turns a layout slip into a red E2E run that reads as a behaviour
  regression.
- **Fix**: Keep `Zapisano`, `approveReason` and the error lines _inside_ the bar, and
  reserve bottom padding equal to the bar height on the scrolling content.
- **Decision**: FIXED

### F4 — Desired End State promises screenshots no phase produces

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Desired End State vs Phase 5
- **Detail**: The verification line ends "…and screenshots of all seven surfaces at 1280px
  and 375px", but no phase captures them. A success criterion with no backing step is the
  kind of thing that gets quietly dropped at the end of a long session.
- **Fix**: Added as phase 5 manual verification 5.8, with the seven surfaces named.
- **Decision**: FIXED

### F5 — Byte-identity of the error page is sensitive to anything per-request in the layout

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 §3 (Layout)
- **Detail**: `patient-link-probe.spec.ts:52` asserts the two probe responses are
  byte-identical. Astro's scoped-style hashes are deterministic, so restyling `Layout.astro`
  is safe as planned. But a nonce, a generated id, or a rendered timestamp introduced there
  would break that assertion — and it would surface as a failing _security_ test, which is a
  confusing way to learn you added a random number to a layout.
- **Fix**: Recorded as a caution in the plan's Critical Implementation Details rather than
  changed — there is no defect to fix, only a trap to mark.
- **Decision**: FIXED (recorded)
