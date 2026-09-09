# Diagnosis prefill evaluations

This directory contains a paid, manual Promptfoo regression gate for the model
that reads a dentist's synthetic diagnosis note into `ParsedDiagnosis`. It runs
against Anthropic directly so Promptfoo can report the exact model cell, provider
usage, cost and latency. It is intentionally not a CI job: provider output is
non-deterministic, each matrix run costs money, and CI does not hold the API key.

## Run

Use Node 22.14.0 and configure `ANTHROPIC_API_KEY` in `.env`, then run:

```bash
npm run eval
```

The command prepares the provider-compatible schema from the production Zod
contract, loads the production prompt and eight source-controlled synthetic
cases, disables Promptfoo's cache, runs one request at a time, writes volatile
details below `evals/prefill/.generated/`, and produces `summary.json`. Generated
files are ignored because they contain complete prompts and model responses.

The production mapper is not part of scoring. Assertions validate the raw model
response with `ParsedDiagnosisSchema` before checking exact teeth, catalog ids,
statuses, urgencies, warnings and canonical visit groups.

## Fixed selection rule

This rule was committed with the corpus before any candidate prompt exists:

1. A prompt/model pair that fails any safety atom is ineligible.
2. Among eligible pairs, higher macro case pass rate wins, followed by higher
   micro atom pass rate.
3. An exact quality tie is broken by lower cost per case, then lower median
   latency.
4. If every recorded measure ties at report precision, retain the current Polish
   prompt and Sonnet model.

## Complete matrix — 2026-09-09

The retained run `eval-m7a-2026-09-09T03:48:01` compared the strengthened
Polish production prompt and English candidate across `claude-sonnet-5` with
medium effort and `claude-haiku-4-5` without an effort option: 8 cases × 2
prompts × 2 providers = 32 uncached calls, with no provider errors. Strict
macro pass means that every deterministic atom for the case passed.

| Prompt / model          | Safety eligible | Strict cases |           Atoms | Input / output / total tokens | Median input / output / total | Cost (USD) | Cost / case |       Median / p95 |
| ----------------------- | --------------- | -----------: | --------------: | ----------------------------: | ----------------------------: | ---------: | ----------: | -----------------: |
| Polish / Sonnet medium  | **yes**         |  3/8 (37.5%) | 137/152 (90.1%) |       49,803 / 7,608 / 57,411 |           6,227 / 750 / 6,985 |  $0.175686 |   $0.021961 | 7.555 s / 20.544 s |
| English / Sonnet medium | **yes**         |  3/8 (37.5%) | 137/152 (90.1%) |       43,459 / 7,126 / 50,585 |           5,434 / 699 / 6,125 |  $0.158178 |   $0.019772 | 7.928 s / 16.473 s |
| Polish / Haiku          | **no**          |   0/8 (0.0%) | 125/152 (82.2%) |       38,543 / 2,683 / 41,226 |           4,819 / 352 / 5,174 |  $0.051958 |   $0.006495 | 8.695 s / 12.817 s |
| English / Haiku         | **no**          |  1/8 (12.5%) | 130/152 (85.5%) |       33,047 / 2,258 / 35,305 |           4,132 / 294 / 4,429 |  $0.044337 |   $0.005542 | 8.462 s / 11.266 s |

### Decision

**Use the English instruction prompt with Sonnet 5 at medium effort.** Both
Sonnet cells were safety-eligible and tied exactly on macro and micro quality,
so the predeclared cost tie-break selected English/Sonnet: $0.019772 per case
versus $0.021961 for Polish/Sonnet. Both Haiku cells remained ineligible after
inventing clinical content or catalog assignments. No safety failure was waived
for a cheaper or faster call.

### Production adoption

The measured winner is active in production configuration: `buildInstructions()`
is the single production prompt path, the default model is `claude-sonnet-5`, and
Anthropic effort is `medium`. The Polish text remains only as an eval baseline.
Production prompt SHA-256:
`970fddd5678a51e1f5e91e2cc8bba50a13a70743c40b5a188340a78ae831d5b1`.

The prompt unit suite hashes the fully rendered production instructions and
compares them with this report. Before changing the prompt or default model, run
the complete uncached matrix and update the decision here; do not update the hash
from an unevaluated prompt.

| Case                     | Polish / Sonnet                       | English / Sonnet                    | Polish / Haiku                                                    | English / Haiku                                              |
| ------------------------ | ------------------------------------- | ----------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------ |
| `catalog-grounding`      | urgency: 16, 24, 54                   | urgency: 16, 24, 54                 | wrong items: 16, 24 (safety); urgency: 16, 24, 54                 | wrong items: 16, 24 (safety); urgency: 16, 24, 54            |
| `unknowns-and-fdi`       | —                                     | —                                   | invented treatment/item on 17; missing warning (safety)           | invented treatment/item on 17; missing warning (safety)      |
| `status-and-urgency`     | `urgencyFromNote`: 24                 | `urgencyFromNote`: 24; visit groups | wrong items: 16, 24 (safety); `urgencyFromNote`: 24; visit groups | wrong item: 16 (safety); `urgencyFromNote`: 24; visit groups |
| `visit-topology`         | urgency: 24, 26, 45, 46; visit groups | urgency: 24, 26, 45, 46             | urgency: 45, 46; visit groups                                     | visit groups                                                 |
| `explicit-plan`          | urgency: 14, 15                       | urgency: 14, 15                     | urgency: 14, 15                                                   | —                                                            |
| `anaesthesia-considered` | —                                     | —                                   | urgency: 16, 17, 24, 25                                           | urgency: 16, 17, 24, 25                                      |
| `anaesthesia-explicit`   | urgency: 16, 17, 24, 25               | urgency: 16, 17, 24, 25             | urgency: 16, 17, 24, 25                                           | urgency: 16, 17, 24, 25                                      |
| `empty-noisy`            | —                                     | —                                   | invented clinical warning (safety)                                | invented clinical warning (safety)                           |

### Reproducibility record

- Timestamp: `2026-09-09T03:48:01.136Z`
- Source revision: `624b02d6549f7c9aac7f5f32f5424be34072b5c3`
- Node: `22.14.0`; Promptfoo: `0.120.19`; cache: disabled; concurrency: 1
- Timeout: 45,000 ms; retries: 1; output caps: Sonnet 128,000, Haiku 64,000
- Production prompt SHA-256:
  `8e1a3566f5bbfaa3d13dc1c87807391a97059167993184e6cb585ec7418a57a3`
- English candidate prompt SHA-256:
  `970fddd5678a51e1f5e91e2cc8bba50a13a70743c40b5a188340a78ae831d5b1`
- Corpus SHA-256 by checked-in file:
  - `01-catalog-grounding.json`:
    `c234573b7ecf6abd08d4cd01469e0410faa4d85f750e319820e827adb88c9b2d`
  - `02-unknowns-and-fdi.json`:
    `558c1ff0c0deb60f9677975ffac465fd76901d469d2c015da9653dd98352df66`
  - `03-status-and-urgency.json`:
    `9c68604b5b973696e7fc839e746bb776274434bec2ced5aa96b2c01c2352c639`
  - `04-visit-topology.json`:
    `8f14396a0d858b1d553d4d1f67a74f9d9be432cad0c2469eb90827466434da2b`
  - `05-explicit-plan.json`:
    `9213e65d7a42ff7d03ff7dcf2a97a647c0accab2076db215c600814e9ab63092`
  - `06-anaesthesia-considered.json`:
    `e373aab7cfcdb2fa943d2e8aca6330b01e3377dbc32ab47bb8880776f10576f6`
  - `07-anaesthesia-explicit.json`:
    `3b71f2911e52f8674c53da1480dc5ea9398bd6c9223ac658882d2c8d73f34be7`
  - `08-empty-noisy.json`:
    `83f219a383fdf514cbdd2e1164535d7500f1f1ff439e93a1bafc17bc55c70800`

Promptfoo 0.120.19 does not know the newer model ids and reports zero provider
cost, so the summarizer derives cost from required per-call token telemetry and
freezes Anthropic's 2026-09-09 standard prices: Sonnet 5 at $2 / $10 and Haiku
4.5 at $1 / $5 per million input/output tokens. The source is Anthropic's
[current pricing table](https://platform.claude.com/docs/en/about-claude/pricing).

Before the phase-1 baseline, the harness rejected two shakedowns: one exposed
Promptfoo's implicit 1,024-token output cap through three truncated Sonnet
responses, and one had five transport errors. A subsequent `--retry-errors`
attempt also exposed a Promptfoo relative-path limitation and made no valid model
calls. Those runs are not mixed into the table. Their findings changed only the
provider configuration and summarizer; no case oracle was changed after seeing
model output.

The implementation review found that the earlier scorer treated an invented
billable item as quality-only. After the scorer fix, run
`eval-tvE-2026-09-09T03:35:09` made every cell ineligible because both Sonnet
prompts guessed a treatment for the unsupported `flow-injection` phrase. The
prompt's existing no-guess rule was made explicit for unknown phrases, without
changing any case or oracle, and the retained matrix above measured that exact
revision. A preceding transport-only shakedown exposed Promptfoo 0.120.19's
implicit `temperature: 0` for unknown Sonnet ids; explicit adaptive thinking and
medium effort now match production and omit that deprecated parameter.

The phase-1 baseline was not perfect, so the hard-case rule did not apply. The
retained matrix used the same eight corpus files and unchanged hashes; no oracle
was altered after a model response was observed.

Configuration follows the [Promptfoo Anthropic provider](https://www.promptfoo.dev/docs/providers/anthropic/),
[JavaScript assertion](https://www.promptfoo.dev/docs/configuration/expected-outputs/javascript/),
and [JSON output](https://www.promptfoo.dev/docs/configuration/outputs/) contracts.
