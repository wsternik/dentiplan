# Prompt evals implementation plan

## Overview

Build a repeatable, paid-on-demand Promptfoo evaluation for DentiPlan's diagnosis
prefill. The suite compares the current Polish instructions and one English
instruction variant across `claude-sonnet-5` and `claude-haiku-4-5`, using eight
synthetic notes and deterministic assertions over the raw wire response. Its
recorded pass rate, latency, token use and cost select the production prompt/model
pair; the result becomes the regression gate for later prompt changes.

The change is evidence infrastructure, not a new patient or dentist feature. It
must not use patient material, run on every CI push, or let the production safety
mapper hide errors made by the model.

## Current State Analysis

Production uses `buildInstructions()` with a live Polish catalog, sends only the
diagnosis note, and requests `ParsedDiagnosisSchema` through AI SDK structured
output (`src/lib/llm/client.ts:60-70`). The selected model is pinned to
`claude-sonnet-5`, the call uses `effort: "medium"`, and the timeout was sized from
one manually measured six-tooth call (`src/lib/llm/client.ts:20-38`). That proves
one prompt/model can answer once; it does not compare alternatives or guard
against future reading regressions.

The unit suite starts after the provider boundary. It proves schema and mapper
behaviour using recorded objects, including the fact that application code drops
invalid teeth and ids (`src/lib/llm/parse-diagnosis.ts:57-150`). It cannot prove
that a live model recognized the note, chose correct catalog ids, respected
negation or proposed sensible visit groups. This is the gap named by risk #10.

No `eval` script or Promptfoo dependency exists in `package.json`. There is no
`evals/` directory and no checked-in corpus or measured comparison.

## Desired End State

From a clean checkout with Node 22 and `ANTHROPIC_API_KEY` configured, one
`npm run eval` command prepares an Anthropic-compatible schema from the production
Zod contract and runs the complete 2×2 matrix without cache. Every cell is graded
against the same precommitted eight-note synthetic corpus. Raw generated output is
ignored; `evals/README.md` contains enough aggregate and per-case evidence
to reproduce and audit the decision.

The production prompt and default model match the measured winner. If no cheaper
or English alternative matches the current pair's quality, the valid outcome is
to keep Polish/Sonnet and document why. Future prompt/model changes have an
explicit manual gate: run the eval suite and update its evidence before changing
production.

### Key Discoveries

- `prompt.ts` and `schema.ts` are safe standalone imports; `client.ts` is not,
  because it owns `astro:env/server` (`research.md` §1).
- The evaluator must grade raw `ParsedDiagnosis`; `mapParsedDiagnosis` repairs the
  exact mistakes the eval is meant to expose (`research.md` §4).
- Promptfoo's native Anthropic provider supports the pinned models, structured
  output, external assertions and result exports (`research.md` §2).
- The provider-facing JSON Schema needs an eval-only sanitizer, while final
  response validation must still use the unmodified `ParsedDiagnosisSchema`
  (`research.md` §3).
- Sonnet runs with production's `effort: "medium"`; Haiku omits unsupported effort
  configuration. The matrix compares configurations that can actually ship.

## What We're NOT Doing

- Reading, copying, anonymizing or evaluating anything in
  `example-doctor-input/`.
- Calling an LLM judge or using non-deterministic semantic scoring.
- Running Promptfoo in CI or changing the existing E2E specifications.
- Evaluating the code-owned visit labels/order after `mapParsedDiagnosis`.
- Adding OpenRouter, model routing, prompt caching or a model picker in the UI.
- Translating the Polish catalog, patient UI or PRD example.
- Evaluating the diff-review agent; no labelled review corpus exists.
- Shipping both prompt variants or adding a runtime prompt-language switch.

## Implementation Approach

Keep the experiment in `evals/prefill/` and the reusable preparation logic in
`scripts/evals/`. Prompt modules import the live `buildInstructions()`/catalog
rather than copying production text. The assertion module imports
`ParsedDiagnosisSchema`, parses the raw JSON, canonicalizes visit membership and
checks fixed per-case atoms. A preparation command generates only the
provider-compatible schema and metadata; Promptfoo remains the network runner and
matrix reporter.

Quality is the primary decision axis. Candidate prompt/model pairs are ranked by
this fixed rule, written into the README before the full run:

1. Any pair that fails a safety atom (invented tooth/id, missing required warning,
   or invalid wire shape) is ineligible.
2. Among eligible pairs, higher macro case pass rate wins; then higher micro atom
   pass rate.
3. On an exact quality tie, lower measured/derived cost per case wins; then lower
   median latency.
4. If every recorded measure ties at report precision, retain the current Polish
   prompt and Sonnet model to avoid an unproven production change.

The three phases deliberately separate corpus construction from candidate
comparison and production adoption. Phase 1 freezes the oracles before the first
call. Phase 2 produces the complete decision table without touching `src/`.
Phase 3 changes production only after that evidence exists.

## Critical Implementation Details

### Corpus immutability and anti-overfitting

All eight initial notes and assertion atoms land before the baseline call. Paid
results may expose an implementation bug in the evaluator; fixing such a bug is
allowed and must be recorded. They must not cause an expected answer to be
softened. If both baseline cells score 100%, add one harder synthetic note before
phase 2, document the addition and update the matrix size/call count. Never edit
an existing oracle to accommodate a model response.

### Raw-output boundary

The assertion entry point receives Promptfoo's raw response. It first JSON-parses
and validates against `ParsedDiagnosisSchema`; only then does it inspect exact
teeth, ids, statuses, urgencies, general items and canonicalized visit groups. It
must not import or call `mapParsedDiagnosis`, because dropping tooth 99 would turn
a model safety failure into a passing case.

### Prompt parity

Both prompt variants use the same live catalog, example/output contract and user
wrapper. The candidate changes only the instruction prose to English. Catalog ids
and Polish item names remain identical. Every result records a hash of the fully
rendered system prompt, not merely the source file, so a catalog change is visible.

### Schema parity

The generated provider schema is disposable and ignored. Its source is always
`ParsedDiagnosisSchema`; a pure adapter strips only Anthropic-documented
unsupported validation keywords. Tests prove nested removal and preservation of
type, enum, required, description, object and array structure. Model responses
are still checked against the original Zod schema.

### Measurement integrity

Disable Promptfoo cache for measured runs. Record exact timestamp, git SHA, model
ids, provider options, prompt hashes, call count, case count, aggregate rates,
per-case failures, token counts, cost basis and latency statistics. If Promptfoo
does not return provider cost, derive it from recorded token usage and freeze the
pricing source/date beside the calculation. Never print or write the API key.

## Phase 1: Baseline harness and synthetic corpus

### Overview

Create the reusable harness, freeze eight synthetic cases and run only the
current Polish production prompt against both models. This phase establishes
that the machinery grades raw answers correctly before an alternative prompt
exists. Nothing under `src/` changes.

Risk covered: an eval that always passes because its corpus mirrors the existing
prompt or its scorer observes mapper-repaired output.

### Changes Required

#### 1. Promptfoo dependency and root command

**Files**: `package.json`, `package-lock.json`

**Intent**: Make the suite reproducible from the committed dependency graph and
discoverable through the repository's normal command surface.

**Contract**: Add Promptfoo as a development dependency and an `eval` script that
runs the preparation step and Promptfoo from the repository root with cache
disabled. The command loads `.env` if present, relies on `ANTHROPIC_API_KEY`, and
must fail clearly without revealing the secret when it is absent.

#### 2. Provider-schema preparation

**Files**: `scripts/evals/anthropic-schema.ts`,
`scripts/evals/anthropic-schema.test.ts`, `scripts/evals/prepare-prefill.ts`,
`.gitignore`

**Intent**: Reuse the production Zod schema while respecting Anthropic's narrower
structured-output keyword support.

**Contract**: Export a pure recursive adapter that removes the documented
unsupported constraint keys at any depth and preserves structural keywords.
`prepare-prefill.ts` imports `ParsedDiagnosisSchema`, writes the adapted schema
and run metadata only below `evals/prefill/.generated/`, and verifies the API key
exists without logging it. Ignore the generated directory.

#### 3. Polish prompt adapter and Promptfoo configuration

**Files**: `evals/prefill/promptfooconfig.yaml`,
`evals/prefill/prompts/production.mjs`

**Intent**: Exercise the exact production Polish instructions and live catalog
through Promptfoo's native Anthropic provider.

**Contract**: The prompt adapter imports `buildInstructions()` and emits a system
message plus the same `Notatka dentystki:\n\n<text>` user wrapper used in
`client.ts:64-66`. The baseline config labels the Polish prompt and defines
`anthropic:messages:claude-sonnet-5` with medium effort and
`anthropic:messages:claude-haiku-4-5` without effort. Both use the generated
structured-output schema and the same output-token/timeout/retry policy where the
provider supports it.

#### 4. Eight-case corpus and deterministic scorer

**Files**: `evals/prefill/cases/*`, `evals/prefill/assertions.mjs`, supporting
unit tests under `scripts/evals/`

**Intent**: Make failure conditions reviewable before any model answer exists.

**Contract**: Add exactly the eight cases specified in `research.md` §5:
catalog/synonym/mixed-dentition grounding; unknown terms plus invalid FDI; combined
status/urgency/negation; six-tooth visit topology; explicit visits plus a general
item; anaesthesia considered; anaesthesia explicit; empty/noisy input. Each case
contains its synthetic note and fixed atoms. The scorer validates the raw wire
shape, rejects duplicates, checks exact domain values and canonical visit groups,
and uses stable warning tokens rather than exact generated prose. No source may
come from `example-doctor-input/` or an existing output fixture. The empty/noisy
case forbids invented clinical content but permits either no warning or a warning
that preserves the noise.

#### 5. Baseline evidence

**Files**: `scripts/evals/summarize-prefill.ts`,
`scripts/evals/summarize-prefill.test.ts`, `evals/README.md`

**Intent**: Prove the harness works on the current production prompt and expose
whether the starting corpus is too easy.

**Contract**: A deterministic summarizer parses Promptfoo's JSON export, rejects
an unexpected matrix shape, and emits aggregate plus per-case data into the
ignored generated directory. Run Polish × both models (16 calls for eight cases)
and use that summary to record reproducibility metadata, macro/micro pass rates,
per-case failures, latency, tokens and cost in `evals/README.md`. State why native
Anthropic is used directly and why the suite is manual rather than CI. If both
cells pass every atom, add and document one harder synthetic case before phase 2
without weakening existing oracles.

### Success Criteria

#### Automated Verification

- `npx vitest run scripts/evals/anthropic-schema.test.ts` proves recursive schema
  sanitization without touching the network.
- A local preparation/config validation run loads the production prompt and Zod
  schema under Node 22, recognizes every case, and fails cleanly when required
  metadata is malformed.
- `npm test`, `npm run lint`, `npx astro check` and `npm run build` pass.
- `git diff --check` passes and `src/` has no phase-1 diff.

#### Manual Verification

- `npm run eval` completes the Polish × Sonnet/Haiku baseline with cache disabled
  and the README numbers reconcile with the generated result.
- Review confirms all notes are synthetic and every expected atom predates the
  first model call; if the baseline is perfect, the documented hard-case rule has
  been applied before phase 2.

**Implementation Note**: After this phase's paid run and verification, commit the
phase and stamp its SHA in `## Progress` before adding the English candidate.

## Phase 2: English candidate and complete matrix

### Overview

Add one English instruction variant, run all prompt/model combinations and apply
the predeclared ranking rule. This phase produces the decision; it still leaves
production untouched.

Risk covered: selecting a cheaper model or shorter English prompt from anecdote,
token count alone or incomparable cached runs.

### Changes Required

#### 1. English instruction variant

**Files**: `evals/prefill/prompts/english.mjs`, shared prompt helpers only if
needed to keep catalog/example construction identical

**Intent**: Test whether English instruction prose improves consistency or token
use without translating DentiPlan's Polish domain data.

**Contract**: Translate only the instruction prose. Reuse the same live catalog,
schema semantics, Polish item names and user-message wrapper as the production
adapter. Preserve every safety, FDI, status, urgency, visit-grouping, warning and
anaesthesia rule; do not simplify the candidate into a different product policy.

#### 2. Full 2×2 matrix

**File**: `evals/prefill/promptfooconfig.yaml`

**Intent**: Compare all four candidate pairs under one corpus, scorer and
measurement configuration.

**Contract**: Add the labelled English prompt and run both prompts against both
pinned models with cache disabled. The complete run is 32 calls for the initial
eight-case corpus, or the documented adjusted count if phase 1 triggered a hard
case. Store generated details only under the ignored results directory.

#### 3. Decision report

**File**: `evals/README.md`

**Intent**: Turn raw outputs into an auditable production choice.

**Contract**: Replace the baseline-only section with a full table containing
macro and micro pass rates, safety eligibility, total/median token use, cost per
case, median and tail latency for every prompt/model pair. Include per-case failure
reasons, prompt hashes, git SHA and pricing basis. Apply the fixed ranking rule
without changing an oracle and state one unambiguous winner for prompt language
and model. “Keep Polish/Sonnet” is valid when the numbers select it.

### Success Criteria

#### Automated Verification

- Configuration validation sees two labelled prompts, two providers and all
  frozen cases, with no duplicate ids or missing assertions.
- Deterministic scorer tests cover valid pass, schema failure, a safety failure,
  canonical visit comparison and warning-token matching.
- `npm test`, `npm run lint`, `npx astro check` and `npm run build` pass.
- `git diff --check` passes and `src/` still has no phase-2 diff.

#### Manual Verification

- One uncached full matrix completes and the README aggregates reconcile with
  the generated JSON result.
- The recorded winner follows the predeclared quality-first ranking rule and no
  failed safety atom is waived for cost or speed.

**Implementation Note**: Commit the report and candidate together, then stamp the
phase SHA. Do not edit production until that commit contains the full verdict.

## Phase 3: Adopt and document the measured winner

### Overview

Make production match the winning matrix cell and establish the eval suite as the
manual regression gate for later prompt/model changes. This is the only phase
that may change `src/`.

Risk covered: evaluation evidence existing beside production while production
silently continues using a different prompt or model.

### Changes Required

#### 1. Production prompt and model configuration

**Files**: `src/lib/llm/prompt.ts`, `src/lib/llm/prompt.test.ts`, and only if
Haiku wins, `src/lib/llm/client.ts` plus a pure model-config seam/test if required

**Intent**: Ship exactly the measured prompt/model pair without keeping an unused
production variant.

**Contract**: If Polish wins, retain the existing instruction prose; if English
wins, replace the instruction prose while keeping the live Polish catalog and
same wire rules. `buildInstructions()` remains the single production entry point.
If Haiku wins, update `DEFAULT_MODEL` and omit Sonnet-only effort configuration
for that model without changing `LLM_MODEL` override behaviour. Prompt tests
assert safety/catalog/contract invariants rather than freezing one language's
sentences. The fully rendered production prompt hash must equal the winning hash
recorded in the report.

#### 2. Technical decision and operating instructions

**Files**: `context/foundation/tech-stack.md`, `README.md`, `evals/README.md`

**Intent**: Make the measured decision and the paid manual gate discoverable.

**Contract**: Extend the LLM-provider section with the date, winning pair,
quality/cost/latency evidence and rejected alternative. Document `npm run eval`,
the existing `ANTHROPIC_API_KEY` requirement, generated-output location and the
rule that the suite runs before later prompt/model changes. State explicitly why
it is not a CI job. Refresh the report's production-adoption status/hash after the
code change.

#### 3. Roadmap and risk model

**Files**: `context/foundation/roadmap.md`, `context/foundation/test-plan.md`

**Intent**: Record the delivered slice and the distinct provider-reading
regression that unit mapping tests cannot catch.

**Contract**: Add roadmap slice S-08 `prompt-evals` as done with this change id,
outcome and manual-gate rationale. Add risk #10: a prompt/model change silently
degrades note reading and forces the dentist to correct increasingly bad prefills.
Map its protection to the on-demand deterministic eval suite, distinguish it from
risk #7's application mapper tests, and add the completed rollout entry.

### Success Criteria

#### Automated Verification

- The production prompt hash equals the winning prompt hash recorded by the eval
  report; the production default model equals the reported winner.
- Prompt and any model-config unit tests cover the selected language-independent
  invariants and the Haiku effort omission when applicable.
- `npm run validate:pricing`, `npm test`, `npm run lint`, `npx astro check`,
  `npm run build` and `git diff --check` pass under Node 22.
- Documentation consistently names S-08, risk #10, the winning pair and
  `npm run eval`; no secret or generated raw result is tracked.

#### Manual Verification

- Compare the adopted production prompt/model configuration to the phase-2
  winning cell and confirm there is exactly one production prompt path.
- Inspect the final report for pass-rate, cost and latency evidence and verify its
  command can be followed without reading the change-plan internals.

**Implementation Note**: Commit the adoption and documentation as phase 3, stamp
all remaining Progress steps with the closing SHA, then proceed to the repository's
implementation review and PR gates. Do not rerun a paid full matrix unless the
adopted prompt content differs from the measured winner.

## Testing Strategy

### Unit Tests

- Anthropic schema sanitization removes unsupported keywords recursively while
  retaining structural schema semantics.
- Assertion logic rejects malformed JSON/schema values, duplicate teeth/items,
  invented domain values, incorrect statuses/urgencies and visit partitions.
- Warning matching checks required evidence tokens without freezing prose.
- Prompt invariants ensure every catalog id and every safety/grouping rule remains
  represented after adoption.
- If Haiku wins, pure model configuration tests prove unsupported effort is
  omitted while Sonnet/overrides remain valid.

### Integration Tests

- A preparation/config validation path imports the real prompt and schema under
  Node 22 and resolves all Promptfoo file references without network access.
- The paid Promptfoo baseline and full matrix exercise the native Anthropic API;
  they are manual release evidence, never CI.
- Existing unit/build checks ensure eval tooling does not break the Astro Worker
  application.

### Manual Testing Steps

1. Confirm `ANTHROPIC_API_KEY` is present exactly once without printing its value.
2. Run `npm run eval` from the repository root with Promptfoo cache disabled.
3. Reconcile matrix dimensions, aggregate scores, token totals, costs and latency
   statistics between generated JSON and the checked-in README.
4. Inspect failures by synthetic case and confirm no oracle changed after output
   was observed.
5. Compare the chosen prompt hash/model id to production after phase 3.

## Performance Considerations

The initial phase-2 matrix performs 32 calls; phase 1 adds 16 baseline calls. A
hard-case contingency increases both the recorded call count and expected cost.
No run belongs in CI. Cache is disabled for measured latency and cost, and the
report uses per-case/aggregate statistics rather than treating one outlier as the
whole result. Prompt caching is intentionally excluded because current traffic is
too sparse to make its five-minute reuse window representative.

The eval dependency is development-only and the generated/raw results stay out of
the Worker bundle. Production request latency changes only if phase 3 selects a
different prompt or model, and that change is justified by the measured table.

## Migration Notes

No database, API payload or patient-data migration is required. Rollback is a
normal revert of the phase-3 prompt/model commit; the phase-2 result remains the
historical rationale. `LLM_MODEL` continues to override the default in deployed
environments. If the winner is Haiku, deployment configuration should be checked
for an existing override before claiming that the new default is live.

## References

- Research: `context/changes/prompt-evals/research.md`
- Session contract: `/Users/wojtek/code/10x-szkolenie/PLAN-ROZSZERZENIE.md` §3
  “Sesja 12” (planning source only; not a repository artifact)
- Production prompt: `src/lib/llm/prompt.ts:20-66`
- Production schema: `src/lib/llm/schema.ts:24-69`
- Provider boundary: `src/lib/llm/client.ts:13-23,29-38,60-70`
- Safety mapper: `src/lib/llm/parse-diagnosis.ts:57-150`
- Test strategy: `context/foundation/test-plan.md:13-28,45-56,74-81`
- Promptfoo Anthropic provider:
  https://www.promptfoo.dev/docs/providers/anthropic/
- Promptfoo prompt configuration:
  https://www.promptfoo.dev/docs/configuration/prompts/
- Promptfoo JavaScript assertions:
  https://www.promptfoo.dev/docs/configuration/expected-outputs/javascript/

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Baseline harness and synthetic corpus

#### Automated

- [x] 1.1 Schema sanitizer unit tests prove recursive sanitization without touching the network — 9c7e2d4
- [x] 1.2 Local preparation and configuration validation load the real prompt, schema and every case under Node 22 — 9c7e2d4
- [x] 1.3 Repository unit, lint, type and build gates pass — 9c7e2d4
- [x] 1.4 Diff checks pass and phase 1 has no src changes — 9c7e2d4

#### Manual

- [x] 1.5 Uncached Polish baseline and README evidence reconcile with generated results — 9c7e2d4
- [x] 1.6 Synthetic corpus and pre-call oracles pass provenance review — 9c7e2d4

### Phase 2: English candidate and complete matrix

#### Automated

- [x] 2.1 Configuration validation sees two prompts, two providers and every frozen case — b205288
- [x] 2.2 Deterministic scorer edge-case tests pass — b205288
- [x] 2.3 Repository unit, lint, type and build gates pass — b205288
- [x] 2.4 Diff checks pass and phase 2 has no src changes — b205288

#### Manual

- [x] 2.5 Uncached full matrix and README decision report reconcile with generated results — b205288
- [x] 2.6 Winner satisfies the quality-first ranking rule without waiving a safety failure — b205288

### Phase 3: Adopt and document the measured winner

#### Automated

- [x] 3.1 Production prompt hash and default model match the winner
- [x] 3.2 Selected prompt and model configuration tests pass
- [x] 3.3 Full repository verification passes under Node 22
- [x] 3.4 S-08, risk 10, README and report documentation are consistent

#### Manual

- [x] 3.5 Production has one prompt path matching the measured cell
- [x] 3.6 Final report is reproducible from its public repository instructions
