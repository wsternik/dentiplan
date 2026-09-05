<!-- PLAN-REVIEW-REPORT -->

# Plan Review: LLM prefill from the diagnosis note

- **Plan**: `context/changes/llm-parsing-prefill/plan.md`
- **Mode**: Deep
- **Date**: 2026-09-05
- **Verdict**: REVISE → SOUND (after fixes)
- **Findings**: 3 critical, 2 warnings, 0 observations

## Verdicts

| Dimension             | Verdict | After fixes |
| --------------------- | ------- | ----------- |
| End-State Alignment   | PASS    | PASS        |
| Lean Execution        | PASS    | PASS        |
| Architectural Fitness | PASS    | PASS        |
| Blind Spots           | FAIL    | PASS        |
| Plan Completeness     | WARNING | PASS        |

## Grounding

12/12 existing paths ✓, 2/2 new paths correctly absent ✓, 8/8 symbols ✓, brief↔plan ✓.
Verified directly: zod 4.4.3 `z.enum([...Schema.options, "unknown"])` works; `wrangler.jsonc`
carries `nodejs_compat`; `@ai-sdk/anthropic@4.0.49` pulls only two AI-SDK packages.

## Findings

### F1 — The config banner would render on the patient page

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2, change 3 (`src/lib/config-status.ts`)
- **Detail**: `missingConfigs` is rendered by `src/layouts/Layout.astro:26`, and
  `src/pages/p/[token].astro:17` uses that layout. Adding an Anthropic entry to
  `configStatuses` therefore puts "prefill is unavailable — missing
  configuration" **on the patient's quote page** whenever the key is unset. That
  page's own header states the NO-DISCLOSURE INVARIANT (FR-060): "unknown,
  draft, missing-env, parse-failure, and RPC-error cases ALL render the identical
  generic error page. We never distinguish causes and never surface internals."
  A configuration banner is surfacing internals. This is not hypothetical — the
  key is a per-environment secret and drift is exactly what the banner exists to
  catch. The existing Supabase entry does not have this problem in practice
  because a patient page cannot render at all without Supabase.
- **Fix ⭐**: give `ConfigStatus` an audience and filter in the layout — add
  `adminOnly: true` to the new entry, and have `Layout.astro` show admin-only
  statuses only when `Astro.locals.user` is set. Supabase keeps its current
  always-visible behaviour.
  - Strength: fixes the class of problem, not the instance — the next
    admin-only dependency inherits it. Two-line change in each file.
  - Tradeoff: touches `Layout.astro`, which `ui-redesign` will rewrite next
    session; the flag survives a restyle, the markup may not.
  - Confidence: HIGH — verified both call sites.
  - Blind spot: none significant.
- **Decision**: FIXED (Fix ⭐)

### F2 — Phase 1's tests cannot import `parse-diagnosis.ts` as designed

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1, changes 5 and 6
- **Detail**: The plan puts `parseDiagnosis(text, model = anthropicModel())` in
  `parse-diagnosis.ts` and the pure `mapParsedDiagnosis` in the same file, then
  has `parse-diagnosis.test.ts` import it. A default parameter is lazy, but the
  `import` of `client.ts` is not — and `client.ts` must read
  `ANTHROPIC_API_KEY` from `astro:env/server`. `vitest.config.ts` aliases only
  `@` and has no `astro:env` stub, so the whole Phase 1 suite would die on an
  unresolved import before a single assertion runs. Nothing in the repo catches
  this today because the two files that import `astro:env/server`
  (`config-status.ts`, `supabase.ts`) have no unit tests.
- **Fix ⭐**: make the model an explicit required parameter —
  `parseDiagnosis(text: string, model: DiagnosisModel)` — so `parse-diagnosis.ts`
  never imports `client.ts`. The endpoint is the only module that composes the
  two, and it is the only one allowed to touch `astro:env`.
  - Strength: keeps the four-file layout, and the dependency direction now
    points away from the framework — the pure core cannot reach the network even
    by accident. The "no hidden default" is also the honest signature.
  - Tradeoff: one extra import line in the endpoint.
  - Confidence: HIGH — verified `vitest.config.ts` and the two existing
    `astro:env` importers.
- **Decision**: FIXED (Fix ⭐)

### F3 — Phase 1's name differs between the phase block and Progress

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: `plan.md:117` vs `plan.md:528`
- **Detail**: `## Phase 1: The parsing boundary — schema, prompt, mapper, and the
risk #7 tests` against `### Phase 1: The parsing boundary`. The Progress
  contract requires the names match; `/10x-implement` keys on them. Phases 2–4
  match.
- **Fix**: rename the phase block heading to `## Phase 1: The parsing boundary`.
- **Decision**: FIXED

### F4 — `contract-surfaces.md` names this slice and the plan does not update it

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4
- **Detail**: `docs/reference/contract-surfaces.md:76-88` carries the invariant
  "`content` is patient-visible verbatim" and closes with: "Downstream slices
  (S-01 form payloads, **S-02 LLM prefill**) must honor it when shaping
  `content`." This slice is that S-02. It is the moment "must honor" becomes
  "honors it, and here is how" — the `note` decision and the server-side id
  resolution are precisely the mechanism. Phase 4 updates the PRD, test plan,
  roadmap and README but leaves the one document that already asked the question
  unanswered.
- **Fix**: add `docs/reference/contract-surfaces.md` to Phase 4 — record under
  the invariant that S-02 honours it by never letting the model write `note` and
  by resolving pricelist ids server-side from the seed.
- **Decision**: FIXED

### F5 — "Build succeeds" is not evidence the SDK runs on workerd

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2, Success Criteria
- **Detail**: `@ai-sdk/anthropic` has only ever run here under `tsx` in Node
  (`scripts/review/agent.ts`), never inside a request handler. `npm run build`
  bundles; it does not execute. If the provider reaches for a Node API that
  `nodejs_compat` does not cover, the first symptom is a 500 in production. The
  plan's manual criterion "a real note returns 200" would catch it, but only if
  it is run against the workerd dev server rather than any Node harness — and
  the plan does not say which.
- **Fix**: name the runtime in the criterion: the 200 must come from
  `npm run dev` (workerd, per `CLAUDE.md`), and the production sanity check is
  the second, independent proof.
- **Decision**: FIXED

## Notes

Dimensions that passed, briefly, so the absence of findings is not mistaken for
absence of review:

- **End-State Alignment** — every success criterion traces to a phase, and the
  production check the session's DoD demands is in Phase 3's manual list.
- **Lean Execution** — nothing in the four phases can be removed and still reach
  the end state. `ParseWarnings.tsx` was considered as possible over-extraction
  and kept: the editor is already 510 lines and the warnings need their own
  accessible heading to be distinguishable from the tooth warnings above them.
- **Architectural Fitness** — the plan reuses the existing payload contract, the
  file-local `jsonError` convention, and the existing warnings markup rather
  than introducing parallel versions of any of them. `parse.ts` as a static
  route alongside `[id].ts` follows the precedent `approve.ts` already set.
