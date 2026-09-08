# Prompt evals — plan brief

> Full plan: `context/changes/prompt-evals/plan.md`  
> Research: `context/changes/prompt-evals/research.md`

## What & Why

DentiPlan's tests prove that application code contains a bad model response, but
they do not prove that the live model read a diagnosis note correctly. This change
adds a manual Promptfoo gate over synthetic notes, compares Polish versus English
instructions and Sonnet versus Haiku, then adopts the winner only when pass rate,
cost and latency support it.

The central risk is an eval that flatters the current prompt: easy cases, oracles
written after seeing the output, or scoring after the mapper repaired mistakes.
The corpus and deterministic raw-output assertions therefore land before the
first paid call.

## Starting Point

Production uses a Polish `buildInstructions()`, `claude-sonnet-5` and medium
effort. One six-tooth call was measured while sizing the timeout, but there is no
repeatable corpus, comparison matrix or prompt regression gate. Unit fixtures
begin after the provider response and cannot measure live reading quality.

The good news is that both production assets needed by an eval are already pure:
`prompt.ts` and `schema.ts` load under standalone `tsx`. Only `client.ts` reaches
Astro environment bindings, so the eval can reuse the prompt/schema while using
Promptfoo's native Anthropic provider.

## Desired End State

`npm run eval` runs an uncached 2 prompts × 2 models matrix against eight
synthetic notes. A checked-in report records schema/case pass rate, safety
eligibility, failures, tokens, cost, latency, hashes and exact model settings.
Production uses the winning pair, and later prompt/model changes must refresh the
same evidence first.

## Key Decisions Made

| Decision       | Choice                                                | Why                                                            |
| -------------- | ----------------------------------------------------- | -------------------------------------------------------------- |
| Framework      | Promptfoo, local/manual                               | Paid non-deterministic provider calls do not belong in CI      |
| Providers      | Native Anthropic Sonnet 5 and Haiku 4.5               | One existing account; preserves clear provider/model reporting |
| Prompt matrix  | Current Polish plus one English-instruction candidate | Measures the open language choice without a runtime switch     |
| Corpus         | Eight made-up notes, frozen before the first run      | Prevents patient-data use and answer-shaped oracles            |
| Eval target    | Raw `ParsedDiagnosis`                                 | The mapper would hide invalid teeth, ids and visits            |
| Judge          | Zod plus deterministic JavaScript atoms               | Expected facts are known; an LLM judge adds cost and ambiguity |
| Visit scoring  | Canonical tooth groups, not labels/order/rationale    | Production code owns numbering, names and visible sentences    |
| Model settings | Sonnet medium effort; Haiku without effort            | These are the valid configurations that could ship             |
| Winner rule    | Safety eligibility → macro → micro → cost → latency   | Quality cannot be traded away silently for price               |
| Generated data | Ignored raw output; checked-in aggregate report       | Keeps evidence reviewable without committing volatile payloads |

## Scope

**In scope:** Promptfoo dependency/configuration; one root command; production
prompt/schema reuse; Anthropic schema adapter; eight synthetic cases; deterministic
assertions; Polish baseline and full 2×2 run; result report; winner adoption;
prompt tests; tech-stack, README, roadmap S-08 and test-plan risk #10 updates.

**Out of scope:** patient material, `example-doctor-input/`, Promptfoo in CI,
LLM-as-judge, review-agent evals, OpenRouter, prompt caching, UI model selection,
catalog translation and E2E spec changes.

## Architecture / Approach

```text
buildInstructions ───────┐
live pricing catalog ────┼─▶ labelled PL/EN prompts ─┐
                         │                            │
ParsedDiagnosisSchema ───┴─▶ sanitized output schema ┼─▶ Promptfoo × Sonnet/Haiku
                                                      │             │
8 synthetic notes + fixed assertion atoms ───────────┘             ▼
                                                           raw JSON results
                                                                  │
ParsedDiagnosisSchema + deterministic scorer ◀────────────────────┘
                              │
                              ▼
                  pass / failures / tokens / cost / latency
                              │
                              ▼
                    measured production winner
```

The provider schema is generated and disposable; every response is still
validated with the original Zod schema. Prompt hashes cover the fully rendered
instructions including the live catalog. Raw results stay ignored.

## Phases at a Glance

| Phase                           | Delivery                                                                                 | Boundary                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1. Baseline harness and corpus  | Runner, schema adapter/tests, eight fixed notes, raw scorer, Polish × two-model baseline | No `src/` change; if both models score 100%, add a harder case before phase 2 |
| 2. English candidate and matrix | English instruction variant, uncached full 2×2 results, quality-first verdict            | Still no production change and no oracle edits after seeing output            |
| 3. Adopt and document           | Winning prompt/model in production, invariant tests, tech-stack/README, S-08, risk #10   | Exactly one production prompt; Haiku gets no unsupported effort option        |

## Open Risks & Assumptions

- Provider outputs vary. The report records one dated run, prompt hashes and exact
  settings; it is a regression gate, not a timeless benchmark.
- Promptfoo may expose tokens without a provider cost. In that case cost is derived
  from a cited, dated pricing basis and that basis stays beside the result.
- A perfect baseline is evidence that the corpus may be too easy, not automatic
  evidence of model quality. The plan requires an additional hard case before the
  candidate comparison in that situation.
- An English winner changes instruction prose only. Polish catalog names, ids,
  user notes and patient UI remain Polish.
- `LLM_MODEL` can override the default in deployment. If Haiku wins, deployment
  configuration is checked before claiming the selected default is live.

There are no open product questions. The ranking rule and all scope decisions are
fixed before implementation.

## Success Criteria (Summary)

- Eight synthetic notes and their oracles exist before the first paid run; no
  patient-derived content is used.
- The scorer rejects raw schema/domain/safety errors and never calls the mapper.
- The full uncached 2×2 matrix records pass rate, failures, cost, tokens and
  latency with exact prompt/model metadata.
- The winner follows the published quality-first rule; no safety failure is waived
  for speed or price.
- Production's single prompt hash and default model match the winning cell.
- `npm run eval` is documented as the manual gate before future prompt/model
  changes, and roadmap S-08 plus test-plan risk #10 capture that contract.
