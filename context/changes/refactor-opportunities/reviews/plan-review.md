<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Move `PickerOption` into the pricing layer

- **Plan**: `context/changes/refactor-opportunities/plan.md`
- **Mode**: Deep
- **Date**: 2026-09-04
- **Verdict**: REVISE — the approach is right and was reproduced end to end; every finding is an edit to the plan text, not to the approach
- **Findings**: 0 critical, 4 warnings, 2 observations

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | WARNING |
| Blind Spots           | WARNING |
| Plan Completeness     | WARNING |

## Grounding

9/9 paths ✓ (`src/components/admin/{types.ts,QuoteEditor.tsx,ToothRow.tsx,PricelistPicker.tsx,GeneralItems.tsx}`, `src/lib/pricing/{picker-options.ts,index.ts}`, `.github/workflows/ci.yml`, `.dependency-cruiser.cjs`).
Symbols ✓ — `PickerOption` declared at `src/components/admin/types.ts:13`; the upward import at `src/lib/pricing/picker-options.ts:16`; `PickerOptions` at `picker-options.ts:20`, re-exported at `index.ts:17`. Brief↔plan ✓ (five decisions in the brief all appear in the plan with the same rationale).
`## Progress` mechanically consistent ✓ — one `## Progress` heading, both `## Phase N:` headings matched by `### Phase N:`, all 6+1 Phase-1 criteria and both Phase-2 criteria enumerated as `- [ ] N.M`, zero checkboxes in phase bodies.

**The file/usage list is complete.** `grep -rn "PickerOption\b" src | grep -v PickerOptions` returns 20 lines across exactly the six files the plan names, and nothing else in the repo references the symbol — no `.astro` route, no barrel other than `src/lib/pricing/index.ts`, no unit test, no Playwright spec (`grep -rn "PickerOption" e2e playwright` → empty). One line is off in the Current State table: `PricelistPicker.tsx` is listed as `:9,12,13` but also uses the type at `:21` (`new Map<string, PickerOption[]>()`) and names it in a comment at `:4`. Same file, no consequence for the edit.

**The claimed verification was reproduced, not taken on trust.** At HEAD, `npm run depcruise` prints the one `lib-not-to-components` error and exits `1`. I copied the working tree to a scratch directory, applied Phase 1 exactly as written, and ran the gates there:

```
npx depcruise src --output-type err
  ✔ no dependency violations found (90 modules, 159 dependencies cruised)   EXIT=0
npx astro check      → 0 errors, 0 warnings (82 files)
npx vitest run       → 3 files, 40 passed
npx eslint src/components/admin src/lib/pricing → EXIT=0
```

So the plan's central claim — 1 violation → 0, nothing else moves — holds. No new edge or cycle is created: after the move `src/components/admin/types.ts → src/lib/pricing/index.ts → ./picker-options` runs in the permitted direction, `picker-options.ts` no longer points back, and `no-circular` (severity `warn`) stays silent. No rule in `.dependency-cruiser.cjs` constrains `src/lib/pricing` or the barrel as a _destination_; the only rules that could plausibly fire on the new edges are `no-circular` and `no-cross-component-family-imports`, and neither matches. Dependency count moves 157 → 159.

## Findings

### F1 — Change #3's contract leaves a now-unused import behind, and orphans the type's doc comment

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1, change #3 (`src/components/admin/types.ts`); also change #1
- **Detail**: The contract says only "remove the `export interface PickerOption` block at `:13`; add `import type { PickerOption } from "@/lib/pricing"`". Followed literally, `PricelistItemRef` stays in the `@/types` import at `types.ts:3` with no remaining referent — `PickerOption extends PricelistItemRef` was its only use in the file. I ran that exact variant in the scratch copy: `astro check` reports **0 errors**, but eslint fails —

  ```
  src/components/admin/types.ts
    4:28  error  'PricelistItemRef' is defined but never used …  @typescript-eslint/no-unused-vars
  ✖ 1 problem (1 error, 0 warnings)                                        EXIT=1
  ```

  That matters twice over. First, the plan's Implementation Note says "if any automated check other than `depcruise` changes state, stop and look rather than pressing on" — following the contract as written makes criterion 1.4 (`npm run lint` exits 0) fail, so the plan's own stop-signal fires on the plan's own instructions. Second, the `PostToolUse` eslint hook in `.claude/settings.json` will surface it mid-edit, which reads as a surprise rather than a step.
  Separately, the eight-line JSDoc at `types.ts:5-12` (FR-025 name non-uniqueness, "the resolved `price` here is preview-only and is never trusted for the server-side freeze") documents the type, not `QuoteEditorProps`. Neither change #1 nor change #3 says it travels with the declaration; left behind it is orphaned prose, dropped it is lost rationale.

- **Fix**: Extend change #3's contract to "…and drop `PricelistItemRef` from the `@/types` import, which has no other use in the file", and add to change #1 "the declaration's doc comment (`types.ts:5-12`) moves with it."
- **Decision**: ACCEPTED — change #3 now drops `PricelistItemRef` from the `@/types` import and moves the doc comment with the declaration (change #1).

### F2 — Change #3 contradicts its own note on re-exporting, and the note's technical reason is wrong

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1, change #3 contract and the "Note on re-exporting"
- **Detail**: The contract instructs: "Re-export it **if and only if** that keeps the four island imports unchanged — see the note below." A re-export from `admin/types.ts` _would_ keep the four island imports unchanged, so the stated condition evaluates true and the instruction says re-export. The note two paragraphs later says the opposite ("It is rejected"), and change #4 assumes the rejection. An implementer reading top-to-bottom is handed a conditional that resolves against the plan's actual decision.
  The note's second justification is also incorrect: "dependency-cruiser would still record a `components → lib` edge carrying the name." `components → lib` is the **permitted** direction — `.dependency-cruiser.cjs:219-227` only forbids `^src/lib/ → ^src/components/`, and no rule constrains the reverse. Both options record that edge; it distinguishes nothing. The first half of the note (a re-export leaves the type looking like it belongs to the UI folder) is the whole argument, and it is a good one.
- **Fix**: Replace the conditional with the flat instruction "do not re-export; `admin/types.ts` imports `PickerOption` for `QuoteEditorProps` only", and delete the depcruise clause from the note, keeping the ownership argument.
- **Decision**: ACCEPTED — the conditional is replaced with a flat "do not re-export"; the depcruise clause is struck and the reason it was wrong is recorded in its place.

### F3 — Four island files are pointed at `@/lib/pricing`, which the repo has a recorded constraint against — the plan never mentions it

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 1, change #4 (the four islands)
- **Detail**: `context/archive/2026-06-04-first-thin-quote-and-patient-link/plan.md` (change #2, admin page shell) records: "Pricelist picker data is serialized from the server into the island as props **so the client doesn't re-import the seed bundle**." The live code repeats it at `src/components/admin/QuoteEditor.tsx:32-36`: "duplicating Zod here would drag the pricing seed into the browser bundle for nothing." Today `ToothRow.tsx`, `PricelistPicker.tsx` and `GeneralItems.tsx` have **no edge to `@/lib/pricing` at all** — their only `@/lib` imports are `@/lib/quote/labels` and `@/lib/quote/tooth-name` (`ToothRow.tsx:12-13`); `PricelistPicker.tsx` imports nothing from `@/lib`. Change #4 gives all four of them one.
  The move is in fact safe, and for two reasons the plan does not state: `verbatimModuleSyntax: true` is inherited from `astro/tsconfigs/base.json`, so an `import type` is provably erased and a value import of an interface will not compile; and `research.md` §2 C1 already established by inspecting `dist/client/_astro/QuoteEditor.*.js` that the seed (`leczenie-zachowawcze`, `baseMilk`) **already ships** via `QuoteEditor.tsx:15 → @/lib/quote/cost → @/lib/pricing`. But nothing in the plan or the brief connects those facts to this decision, so the next reviewer meets an apparent contradiction with an archived architectural constraint and has to re-derive the answer — or, worse, blocks the change on it.
- **Fix**: Add one sentence to change #4's contract: the new edge is `import type` only, erased under `verbatimModuleSyntax`, and the seed bundle the archived constraint protects is already shipped through `cost.ts` — so the constraint is untouched. Cite `research.md` §2 C1 for the bundle evidence.
- **Decision**: ACCEPTED — change #4 now names the archived constraint, and states both reasons it is untouched (`verbatimModuleSyntax` erasure; the seed already ships via `cost.ts`).

### F4 — Phase 2 makes the layer rules a gate but leaves this change's actual verifier out of CI

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2, change #1 (`.github/workflows/ci.yml`)
- **Detail**: The Phase 2 contract ("a step invoking `npm run depcruise`, placed next to `lint` and before `build`… the same trigger as the existing checks") is accurate about the file: `ci.yml:9-25` is a single `ci` job whose steps run `npm ci` → `npx astro sync` → `npm run lint` → `npm test` → `npm run build`, triggered on push to `main` and PR to `main` (`:3-7`). Dropping `- run: npm run depcruise` between lint and test fits exactly.
  What the contract misses is the shape of _this_ change's safety net. The plan states its own verifier plainly — "the verifier is the compiler, not a test", criterion 1.2 is `astro check` clean — and `astro check` **is not in `ci.yml`**; it runs only in `.husky/pre-commit`. `research.md` §3 measured precisely this ("`astro check` is a separate command that runs at pre-commit and is **absent from `ci.yml`**… For the type-level candidates the real verifier is `astro check`"), and the plan cites §3's sibling finding but not this one. The result: Phase 2 ships a gate for the boundary rules while the type check that actually proves Phase 1 correct remains reviewable only by whoever runs the hook locally — and no CI run for this PR can show criterion 1.2 passing.
  A second consequence of Phase 2 the plan does not state: `deploy-production` has `needs: ci` (`ci.yml:27-28`), so a future depcruise violation now blocks the **production deploy**, not just the PR. That is almost certainly wanted — the error-severity rules are narrow and `no-circular` / `no-orphans` are `warn` and do not affect the exit code — but it belongs in the contract as a consequence someone signed off on.
- **Fix A ⭐ Recommended**: Add `- run: npx astro check` alongside the depcruise step in the same Phase 2 edit, and note the deploy-gate consequence in the contract.
  - Strength: One line, in a file Phase 2 already opens, and it closes the exact gap `research.md` §3 measured. It also makes Phase 1's criterion 1.2 something a reviewer can see rather than something the author asserts. `astro sync` already runs at `ci.yml:19`, so the prerequisite is in place.
  - Tradeoff: Widens Phase 2 past its one-line title, and adds ~6s to every CI run. If any pre-existing hint in the repo ever becomes an error the whole pipeline stops.
  - Confidence: HIGH — `npx astro check` reports 0 errors / 0 warnings on the post-move tree (82 files) in the scratch run, so it goes in green.
  - Blind spot: Whether `astro check` is stable across CI's node 22 image was not verified; only the local run was.
- **Fix B**: Leave CI as the plan has it, and add "not adding `astro check` to CI" to "What We're NOT Doing" with the reason.
  - Strength: Keeps Phase 2 to the single mechanical step it claims to be; the pre-commit hook does cover every commit made through the normal path.
  - Tradeoff: The gap stays, and it stays undocumented in the one plan that had the evidence in front of it.
  - Confidence: HIGH — the hook at `.husky/pre-commit` genuinely runs `npx astro check`.
  - Blind spot: `--no-verify` commits and agent-authored commits bypass the hook entirely.
- **Decision**: ACCEPTED, Fix A — Phase 2 adds `npx astro check` alongside `npm run depcruise`, and the contract now names the `deploy-production` `needs: ci` consequence explicitly.

### F5 — "Cannot change runtime behaviour" and the manual verification's rationale cannot both be true

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Key Discoveries; Phase 1 Manual Verification
- **Detail**: Key Discoveries states "a pure type move **cannot** change runtime behaviour." The Manual Verification bullet then justifies itself as covering "the one behaviour a wrong import path could plausibly break at runtime despite compiling." Under `verbatimModuleSyntax: true` (inherited from `astro/tsconfigs/base.json`) a wrong import path does not compile at all, and an `interface` has no runtime form to break — the named failure mode does not exist. The manual step is still worth two minutes, but on honest grounds: it confirms nothing _else_ was disturbed while six files were open, which is a different claim.
- **Fix**: Reword criterion 1.7's rationale to "a smoke check that nothing else was disturbed across the six edited files", and drop the "could plausibly break at runtime despite compiling" clause.
- **Decision**: ACCEPTED — criterion 1.7's rationale is reworded to a smoke check.

### F6 — The C2-over-C1 justification leans on leverage the evidence does not support

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Overview; plan-brief "Which candidate to implement"
- **Detail**: The stated reason for taking C2 first is that it is "the only one that _unblocks the others_ by making the cruise usable as a gate." Checked against the ranking, that is thinner than it reads. `research.md` §3's verification table lists the verifier for every candidate: C3 is `astro check` + build + `seed.spec.ts`, C4 is `astro check` + build + a new unit test, C6-write is `npm test`, C1 is `astro check` + `npm test`. **None of them is gated by depcruise**, and none is a layer-direction problem, so a green cruise unblocks none of them. The one thing it concretely unblocks is `context/domain/03-anti-corruption-layer.md:299` (A6: "add `only-infra-knows-supabase`, and wire `npm run depcruise` into CI"), which the plan does cite in References.
  **The counter-case for C1 first, honestly.** C1 is the ranking's highest-value candidate, and the exploration's single most consequential finding was that its blocking objection is stale — the built client bundle already carries `ZodError` and the pricing seed, so the "don't drag the bundle in" reason for not sharing `QuotePayload` no longer holds. Its producer is 16 lines (`QuoteEditor.tsx:181-196`) and its target type is already exported with zero importers (`quote-payload.ts:68`). "Restructures a 691-line component" overstates a function extraction.
  **It still does not overturn the choice, and the reason is a better one than leverage.** C1's phase 1 has no safety net at the moment it needs one: `research.md` §2 C1 records that `quote-payload.test.ts` builds its own literals and "stays green under any producer rename", and vitest here is `environment: "node"` with `include: src/**/*.test.ts`, so `treePayload()` cannot be tested where it sits. Its only behavioural cover is one e2e spec that is not in CI. C2's verifier, by contrast, is complete and mechanical — `depcruise` 1 → 0, `astro check`, `verbatimModuleSyntax` — and I reproduced all of it. So: C2 first because its cost is ~30 minutes and its proof is total, not because it pays for the others.
- **Fix**: Rewrite the Overview's second sentence and the brief's "why" cell to the cost-and-proof argument, and narrow the leverage claim to what it actually unblocks (`03-anti-corruption-layer.md` A6).
- **Decision**: ACCEPTED — this was the most useful finding in the review. The plan's Overview now says outright that the change does _not_ unblock the others, names the one thing it does unblock, and rests the choice on cost and completeness of proof instead. The same correction was propagated to `plan-brief.md` and to `context/architect-report.md` §4 and §6, and the "restructures a 691-line component" overstatement was removed from all three.

## On the "no test" decision — the plan is right, not rationalizing

Asked directly whether "a type-only move needs no test" is reasoning or excuse: it is reasoning, and it is correct. A unit test can only assert about values at runtime, and after this change there is no new value, no new function, and no changed call. The three things that _could_ go wrong are each already covered by a mechanical gate that runs on this repo today:

| Failure mode                                         | Caught by                                                                        | Verified                                                         |
| ---------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Wrong import path / missing export                   | `astro check`, and `npm run build`                                               | 0 errors on the post-move tree                                   |
| The upward edge reappears                            | `npm run depcruise`                                                              | 1 → 0 reproduced; re-adding the import restores the error        |
| A value import sneaks in where a type import belongs | `verbatimModuleSyntax: true` (`astro/tsconfigs/base.json`) — it will not compile | inherited, confirmed in `node_modules/astro/tsconfigs/base.json` |

A test asserting `PickerOption` "exists" would compile-time-assert something the compiler already asserts, and would be the only test in the repo doing so. Declining it is the right call. The honest residual — which the brief already states and the plan should keep stating — is that "40 tests still pass" proves nothing here; the proof is `astro check` plus `depcruise`, which is exactly why F4's placement of `astro check` in CI is worth a decision rather than a shrug.

## Scope discipline

Clean. Nothing in the phases exceeds the stated change: two phases, seven files total, no rename, `QuoteEditorProps` untouched, no data or schema. Nothing listed under "What We're NOT Doing" is unavoidable — C1, C5 and C6's read side are all genuinely separable, and the C6 read-side exclusion in particular is the correct call for the reason given (a bound applied to already-stored immutable rows would silently 404 patient links). The only near-miss is F1's `PricelistItemRef` cleanup, which is not scope creep but a necessary consequence the contract omitted.

## Ordering and prerequisites

No problems. The brief's claim of no prerequisites checks out: `npm run lint` exits **0** at HEAD (`f0e916e`), so `4ddf54d`'s repair is in place and Phase 2's CI step will not land on a red pipeline. Phase 1 before Phase 2 is the right order and the plan's reason for the split — "enforcement is switched on as its own step, after the code already complies" — matches the convention already recorded at `context/domain/03-anti-corruption-layer.md:301` ("A6 is deliberately last and deliberately separate"). Phase 2's `npx astro sync` prerequisite is already satisfied at `ci.yml:19`, ahead of where the new step goes.

## Summary

```
  0 critical, 4 warnings, 2 observations

  The mechanic is verified: depcruise 1 → 0, astro check clean,
  40 tests, lint clean, no new edge or cycle.

  Every finding is a correction to the plan document.
  None of them changes the approach.

  ► Overall: REVISE — apply F1–F3 (all one-line contract edits),
    take a decision on F4, and the plan is ready to implement.
```
