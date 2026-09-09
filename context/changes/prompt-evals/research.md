---
date: 2026-09-08T14:49:25+02:00
researcher: Codex
git_commit: d39eb7c0a561d0f424ec02089a0e24a2a5a9ed71
branch: feat/prompt-evals
repository: wsternik/dentiplan
topic: "Whether the production prompt and ParsedDiagnosis schema can be reused in Promptfoo, and how to evaluate Anthropic models deterministically"
tags: [research, promptfoo, anthropic, llm-prefill, evals, ai-sdk]
status: complete
last_updated: 2026-09-08
last_updated_by: Codex
---

# Research: production-faithful prompt evaluations

**Date**: 2026-09-08T14:49:25+02:00
**Researcher**: Codex
**Git Commit**: `d39eb7c0a561d0f424ec02089a0e24a2a5a9ed71`
**Branch**: `feat/prompt-evals`
**Repository**: wsternik/dentiplan

## Research Question

Before planning the first repeatable evaluation of the note prefill:

1. Can `buildInstructions()` and `ParsedDiagnosisSchema` be reused from a
   standalone Promptfoo run without importing Astro's runtime environment?
2. Does Promptfoo support the two required Anthropic models, two prompt variants,
   JavaScript assertions, reusable TypeScript modules and result exports with
   latency/token/cost data?
3. What synthetic cases and deterministic assertions distinguish a genuinely
   safer prompt/model choice from a suite that is merely easy to pass?

## Summary

**The production prompt and wire schema are safe to import from a standalone
`tsx` process.** `prompt.ts` imports only the pricing catalog and the visit
ceiling (`src/lib/llm/prompt.ts:20-23`); `schema.ts` imports Zod and the runtime
enum schemas (`src/lib/llm/schema.ts:28-31`). Neither graph reaches
`astro:env/server`. A Node 22 smoke run loaded both through `tsx`, built the
8,971-character prompt and exposed the four expected schema keys. The unsafe
edge is `client.ts`, the only LLM module that imports `astro:env/server`
(`src/lib/llm/client.ts:13-18`); an eval must not import it.

**Promptfoo covers the matrix without a custom provider.** Its Anthropic
provider accepts `anthropic:messages:<model>` identifiers, reads
`ANTHROPIC_API_KEY`, supports structured-output configuration and records usage.
Its config supports labelled dynamic prompts, external JavaScript assertions
and JSON/CSV/HTML output. TypeScript imports are viable when Promptfoo is
started with the `tsx` loader; this matches the repository's existing script
convention (`package.json:16,19,69`). The matrix can therefore stay the fixed
2 prompts × 2 models × 8 synthetic cases = 32 paid calls.

**One adapter is required for production parity.** Zod's generated JSON Schema
adds numeric constraints such as `minimum`/`maximum`, while Anthropic structured
outputs reject those keywords. The production AI SDK provider silently sanitizes
the schema before sending it; Promptfoo receives a literal `output_format` and
does not perform that AI SDK step. The eval runner should generate its schema
from `ParsedDiagnosisSchema`, remove only Anthropic's documented unsupported
constraint keywords into an ignored generated directory, then let every result
pass through the original Zod schema again. That reuses the contract without
copying it and keeps provider compatibility out of production code.

**The evaluator must score the raw `ParsedDiagnosis`, not
`mapParsedDiagnosis`.** The mapper deliberately drops invalid teeth and catalog
ids, corrects visit references, orders and names visits, and composes warnings
(`src/lib/llm/parse-diagnosis.ts:57-150`). Grading after it would award the model
for mistakes repaired by code. The eval target is narrower: whether the model
read the note into the wire contract accurately enough before the safety layer.

**The corpus must be difficult before the first paid run.** Eight synthetic
notes should cover catalog morphology, unsupported phrases and invalid FDI,
uncertainty/status, urgency evidence and negation, side-aware visit topology,
explicit visit instructions plus a general item, contrasting mentions of general
anaesthesia, and mixed synonyms/dentition. If the baseline is perfect, phase 2
must add a harder synthetic case before comparing prompts; changing an oracle
after seeing which model failed it is prohibited.

## Detailed Findings

### 1. The reusable import boundary is already present

`buildInstructions()` is assembled from live source data on every invocation
(`src/lib/llm/prompt.ts:38-41`). Its catalog dependency is intentional: the model
must see the same allowed ids that production resolves. `ParsedDiagnosisSchema`
is likewise the production wire contract (`src/lib/llm/schema.ts:53-67`). Direct
reuse protects the eval from two kinds of drift:

- a new catalog item cannot be available in production but absent from the eval;
- a new required response field cannot land in production while the eval keeps
  accepting the old shape.

The module graph was checked rather than inferred. It terminates in pricing seed
and pure helpers for the prompt, and in `zod` plus `src/types.ts` for the schema.
The database import in `types.ts` is type-only. By contrast, importing
`anthropicModel()` would cross into `astro:env/server` and couple a local CLI to
the Worker build environment. The standalone runner should reproduce the call
configuration explicitly and cite `client.ts` as its production reference;
sharing that client would be the wrong abstraction.

### 2. Promptfoo can express the required experiment

Promptfoo's current official documentation establishes the necessary pieces:

- the [Anthropic provider](https://www.promptfoo.dev/docs/providers/anthropic/)
  uses `anthropic:messages:<model>`, `ANTHROPIC_API_KEY`, provider config including
  `effort`, and structured output through `output_format`;
- [prompt configuration](https://www.promptfoo.dev/docs/configuration/prompts/)
  supports external files, named functions and labels, so both prompts can share
  the same user-message wrapper without hiding which variant ran;
- [JavaScript assertions](https://www.promptfoo.dev/docs/configuration/expected-outputs/javascript/)
  may live in external modules and return structured pass/fail reasons;
- [modular configuration](https://www.promptfoo.dev/docs/configuration/modular-configs/)
  supports file references from YAML, which keeps cases and assertions reviewable;
- [output files](https://www.promptfoo.dev/docs/configuration/outputs/) preserve
  machine-readable evaluation results for the aggregate report.

Use the native providers required by the session rather than a custom AI SDK
provider. A custom provider would make production invocation parity slightly
closer, but it would replace the specified provider ids, obscure the model matrix
in Promptfoo's report, and add code where configuration suffices.

There is one model-specific fairness detail. Sonnet 5 production explicitly uses
`effort: "medium"` (`src/lib/llm/client.ts:29-38,69`), so its eval provider should
do the same. Haiku 4.5 does not expose that effort control; its provider should
omit it rather than pretending both models have identical reasoning settings.
The comparison is therefore between the configurations that could actually ship,
not between syntactically identical but invalid provider options. Model ids remain
pinned, consistent with production's rationale (`src/lib/llm/client.ts:20-23`).

### 3. Structured output needs an eval-only compatibility adapter

`ParsedDiagnosisSchema` intentionally leaves domain bounds to code because the
provider rejects numeric bounds (`src/lib/llm/schema.ts:24-26`). Even so, Zod's
JSON Schema conversion emits generic safe-integer bounds for `z.number().int()`.
The installed AI SDK Anthropic provider strips unsupported validation keywords
before sending `output_config`, then validates the returned value against the
original Zod schema. A direct experiment confirmed both facts.

Promptfoo accepts a JSON Schema for structured output, but its documentation
states that Anthropic does not support constraints such as `minimum`, `maximum`
and `minLength`. The safe design is:

1. a small TypeScript preparation step imports `ParsedDiagnosisSchema` and
   converts it to JSON Schema;
2. a pure recursive adapter removes only the documented unsupported constraint
   keys and writes the generated provider schema below an ignored eval directory;
3. Promptfoo sends that generated schema as `output_format`;
4. the assertion module parses every raw result with `ParsedDiagnosisSchema`
   before applying domain or case expectations.

Do not import `@ai-sdk/anthropic/internal` merely to reuse its sanitizer. It is an
internal surface, can move independently of the public provider API, and would
make an eval runner depend on implementation details. A tiny adapter with a unit
test is the smaller and more legible contract. It does not duplicate the
application schema; it only expresses the provider boundary already documented
in `schema.ts`.

### 4. Score model reading before application repair

`mapParsedDiagnosis` is a safety boundary, not part of the model's answer. It:

- drops invalid FDI numbers (`parse-diagnosis.ts:98-105`);
- resolves ids against the catalog and warns when they are absent or invalid for
  the context (`parse-diagnosis.ts:109-114`);
- disconnects uncertain/out-of-plan teeth and undeclared visits
  (`parse-diagnosis.ts:116-123`);
- later orders and labels visits in code.

Passing model output through it before grading creates false positives: tooth 99
would disappear, a hallucinated id would be omitted, and a broken visit reference
would become `null`. Assertions therefore parse the raw JSON only with
`ParsedDiagnosisSchema` and then compare canonical values. Visit groups are
canonicalized as sorted sets of tooth numbers; labels and visit order are not
scored because production code owns them. Rationale wording is not scored.

The primary metric is **macro pass rate**: a case passes only when every
must-pass atom for that case succeeds. Record **micro assertion pass rate** as a
diagnostic so a near miss is visible without weakening the decision criterion.
Safety atoms—no invented tooth, no invented catalog id, correct warning for an
unsupported phrase—remain must-pass even if aggregate quality is otherwise high.

### 5. Synthetic corpus and fixed oracles

Create the corpus before any paid call. Each case stores a made-up Polish note,
a short purpose, exact expectations and the assertion atoms that count toward
its score. No case may be copied or adapted from `example-doctor-input/`.

| Case                   | Synthetic challenge                                                                          | Deterministic oracle                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| catalog-grounding      | Endodontic and filling synonyms across permanent and milk teeth, plus an OPG                 | Exact teeth and catalog ids; permanent/milk and tooth morphology resolved; root canal alone is not urgent             |
| unknowns-and-fdi       | Bare teeth 17/16, an unsupported flow-injection phrase, extraction of tooth 99               | Only valid teeth remain; bare teeth use `unknown`; no invented item; warnings contain `99` and the unsupported phrase |
| status-and-urgency     | Painful 36, painless caries 24, symptom-free root canal 16, `(32?)`, and 48 outside the plan | Exact status, urgency and `urgencyFromNote`; negation must not create urgency; 32 and 48 have visit 0                 |
| visit-topology         | Left-side root canals 24/26/27, with pain on 27, and right-side fillings 45/46               | Exact tooth membership per visit; no mixed sides; root canals carry double grouping weight                            |
| explicit-plan          | 14/15 assigned to visit 2, painful extraction 46 and hygiene in visit 1                      | Explicit associations survive; hygiene is a general item attached to visit 1                                          |
| anaesthesia-considered | A multi-side plan that merely says anaesthesia is being considered                           | The standard plan remains multi-visit and side-aware; no false single-session interpretation                          |
| anaesthesia-explicit   | The same treatment with an explicit instruction that all work happens under anaesthesia      | Exactly one proposed visit and a warning containing the anaesthesia phrase                                            |
| empty-noisy            | Blank lines and punctuation with no diagnosis                                                | No tooth, item, urgency or visit; warnings may be empty or preserve noise rather than inventing treatment             |

Warnings are free text, so assertions require a warning containing a stable token
or phrase; they never demand exact prose. Catalog ids, tooth numbers, statuses,
urgencies, visit membership and general-item placement are exact. Duplicate arrays
are rejected rather than silently normalized away.

Existing unit fixtures are not an eval corpus. They contain deliberately invalid
wire values to prove the mapper's defenses, and the clean fixture reflects a
historical test oracle rather than a reviewed gold answer. Reusing them would mix
“can our code contain a bad response?” with “did the model read this note well?”.

### 6. Results and reproducibility contract

`npm run eval` should perform preparation and then one Promptfoo invocation from
the repository root. It must fail before spending money when the API key is
missing, validate all cases and the generated schema, and write raw generated
results to an ignored directory. The checked-in `evals/README.md` records:

- timestamp, git SHA, prompt hashes and exact provider/model configuration;
- corpus version/case count and matrix size;
- macro pass rate and micro assertion pass rate per prompt/model pair;
- latency, input/output tokens and provider-reported or reproducibly derived cost;
- per-case failure reasons, the chosen prompt language and the chosen model;
- the explicit rule used to choose a cheaper/faster model without waiving a
  must-pass safety failure.

Promptfoo's generic deterministic `cost` assertion is not the decision mechanism
for Anthropic. Cost belongs in the exported result/report, calculated from usage
with the pricing basis recorded when provider-reported cost is unavailable. This
prevents a pricing change from silently rewriting an old decision.

The production prompt changes only after the complete matrix is recorded. The
second prompt remains an eval variant until then; after the decision, exactly one
variant is the production `buildInstructions()`. If Haiku ties the winner on all
must-pass cases and materially improves cost or latency, `DEFAULT_MODEL` may
change. Otherwise Sonnet remains the conservative choice.

## Recommended File Shape

```text
evals/
  README.md                     aggregate evidence and final decision
evals/prefill/
  promptfooconfig.yaml          matrix, provider settings, prompt labels
  cases/                        8 synthetic notes and fixed expectations
  prompts/                      production adapter + English candidate
  assertions.mjs               raw schema parse and deterministic case grading
  .generated/                   ignored provider schema and raw results
scripts/evals/
  prepare-prefill.ts            schema generation/validation and key guard
  anthropic-schema.ts           pure unsupported-key adapter
  anthropic-schema.test.ts      adapter contract
  summarize-prefill.ts          deterministic matrix aggregation
  summarize-prefill.test.ts     aggregation contract
```

The exact split between case files may be simplified during implementation, but
the boundaries must remain: source-controlled synthetic inputs and oracles,
generated raw outputs ignored, production prompt/schema imported rather than
copied, and one root command.

## What We're NOT Doing

- No real or anonymized patient notes, and no use of `example-doctor-input/`.
- No Promptfoo run in CI; this suite is paid and intentionally manual.
- No LLM-as-judge, model-authored rubric or second “review” call.
- No prompt caching, UI model selector, fallback router or provider migration.
- No OpenRouter and no unpinned “latest” model aliases.
- No changes to E2E specs; this evaluates a provider, not the browser contract.
- No production prompt/model change before the recorded 2×2 result exists.
- No catalog translation project. The English candidate may give instructions in
  English while preserving Polish input, exact ids and the Polish-facing domain.

## Planning Implications

The implementation naturally divides into three evidence-producing commits:

1. Build the runner, schema adapter, fixed synthetic corpus and deterministic
   assertions; run the current Polish prompt against both models and record the
   baseline. If it scores 100%, add one harder case before phase 2 and record why.
2. Add the English instruction variant, run the full 2×2 matrix, and record the
   complete quality/latency/token/cost table and failures.
3. Adopt the measured winner in production, add a prompt invariant test, record
   the provider/language decision in `tech-stack.md`, add eval risk #10 to the
   test plan, and mark roadmap S-08 done.

Phase 1 must not choose the production winner from a two-cell baseline. Phase 2
must not change an oracle in response to a model result. Phase 3 must not claim a
cost advantage unless the pricing basis is recorded beside the measurement.

## Open Questions and Resolved Decisions

All product-shaping choices for this session are settled; none blocks planning.

| Question             | Decision                                                            |
| -------------------- | ------------------------------------------------------------------- |
| Evaluation framework | Promptfoo, local/manual only                                        |
| Matrix               | Polish production prompt + English candidate × Sonnet 5 + Haiku 4.5 |
| Corpus               | Eight synthetic cases, written before the first run                 |
| Judge                | Deterministic schema/domain/case assertions only                    |
| Eval target          | Raw `ParsedDiagnosis`, before `mapParsedDiagnosis` repairs it       |
| Sonnet effort        | `medium`, matching production                                       |
| Haiku effort         | Omitted because Haiku 4.5 does not support it                       |
| Generated output     | Ignored raw results; checked-in aggregate README                    |
| Production change    | Only after the full matrix selects a winner                         |

## Sources

### Repository

- `src/lib/llm/prompt.ts:20-66` — live-catalog prompt and pure dependency graph.
- `src/lib/llm/schema.ts:24-69` — provider-compatible wire contract.
- `src/lib/llm/client.ts:13-23,29-38,60-70` — Astro boundary, pinned model and
  production effort.
- `src/lib/llm/parse-diagnosis.ts:57-150` — safety repairs that must stay outside
  the evaluated model answer.
- `package.json:5-19,69` — root scripts and established `tsx` runtime.
- `context/foundation/test-plan.md:13-28,51-56,74-81` — risk-first test doctrine
  and the separation between model output and application-owned safety.

### External primary documentation

- [Promptfoo Anthropic provider](https://www.promptfoo.dev/docs/providers/anthropic/)
- [Promptfoo prompt configuration](https://www.promptfoo.dev/docs/configuration/prompts/)
- [Promptfoo JavaScript assertions](https://www.promptfoo.dev/docs/configuration/expected-outputs/javascript/)
- [Promptfoo modular configuration](https://www.promptfoo.dev/docs/configuration/modular-configs/)
- [Promptfoo output files](https://www.promptfoo.dev/docs/configuration/outputs/)
- [Anthropic model lifecycle](https://docs.anthropic.com/en/docs/about-claude/model-deprecations)
- [Anthropic Claude 4 migration and effort controls](https://docs.anthropic.com/en/docs/about-claude/models/migrating-to-claude-4)
