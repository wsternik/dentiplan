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

## Complete matrix — 2026-09-08

The retained run `eval-ILg-2026-09-08T16:23:37` compared the production Polish
prompt and the English-instruction candidate across `claude-sonnet-5` with
medium effort and `claude-haiku-4-5` without an effort option: 8 cases × 2
prompts × 2 providers = 32 uncached calls, with no provider errors. Strict
macro pass means that every deterministic atom for the case passed.

| Prompt / model          | Safety eligible | Strict cases |          Atoms | Input / output tokens | Cost (USD) | Cost / case |       Median / p95 |
| ----------------------- | --------------- | -----------: | -------------: | --------------------: | ---------: | ----------: | -----------------: |
| Polish / Sonnet medium  | **yes**         |  2/8 (25.0%) | 91/110 (82.7%) |        49,035 / 8,466 |  $0.274095 |   $0.034262 | 7.366 s / 29.529 s |
| English / Sonnet medium | **no**          |  1/8 (12.5%) | 92/110 (83.6%) |        42,899 / 6,494 |  $0.226107 |   $0.028263 | 8.597 s / 15.154 s |
| Polish / Haiku          | **no**          |   0/8 (0.0%) | 87/110 (79.1%) |        38,007 / 2,712 |  $0.051567 |   $0.006446 | 9.536 s / 13.330 s |
| English / Haiku         | **no**          |   0/8 (0.0%) | 88/110 (80.0%) |        32,695 / 2,456 |  $0.044975 |   $0.005622 | 8.585 s / 10.636 s |

### Decision

**Keep the Polish production prompt and Sonnet 5 with medium effort.** It is the
only safety-eligible cell, so the first ranking rule selects it before cost or
latency can act as tie-breakers. The English/Sonnet cell was cheaper and passed
one more atom overall, but it treated the unsupported `flow-injection` phrase as
a filling and omitted the required warning. Both Haiku cells failed safety atoms,
including invented clinical content for the empty/noisy note. No safety failure
is waived for a cheaper or faster call.

### Production adoption

The measured winner is active in production configuration: `buildInstructions()`
is the single production prompt path, the default model is `claude-sonnet-5`, and
Anthropic effort is `medium`. Production prompt SHA-256:
`7a70760cf6711f883897c38c30476552f983f2942005e510f97c8f7bc6494266`.

The prompt unit suite hashes the fully rendered production instructions and
compares them with this report. Before changing the prompt or default model, run
the complete uncached matrix and update the decision here; do not update the hash
from an unevaluated prompt.

The full run reproduced the broad baseline result despite ordinary provider
variation: Polish/Sonnet again passed `unknowns-and-fdi` and `empty-noisy` with
no safety failure, while Polish/Haiku remained ineligible. Its Polish/Sonnet
micro score moved from 92/110 in the baseline to 91/110 here; that variation did
not affect eligibility, macro rank, or the selected pair.

| Case                     | Polish / Sonnet              | English / Sonnet                   | Polish / Haiku                                    | English / Haiku                    |
| ------------------------ | ---------------------------- | ---------------------------------- | ------------------------------------------------- | ---------------------------------- |
| `catalog-grounding`      | tooth details 16, 24, 54     | tooth details 16, 24, 54           | tooth details 16, 24, 54                          | tooth details 16, 24, 54           |
| `unknowns-and-fdi`       | —                            | tooth 17; missing warning (safety) | tooth 17; missing warning (safety)                | tooth 17; missing warning (safety) |
| `status-and-urgency`     | tooth details 16, 24         | tooth details 16, 24               | teeth 16, 24; visit groups; general item (safety) | teeth 16, 24; visit groups         |
| `visit-topology`         | tooth details 24, 26, 45, 46 | visit groups                       | tooth details 45, 46; visit groups                | tooth details 45, 46; visit groups |
| `explicit-plan`          | tooth details 14, 15         | tooth details 14, 15               | tooth details 14, 15                              | tooth details 14, 15               |
| `anaesthesia-considered` | tooth details 16, 17, 24, 25 | tooth details 16, 17, 24, 25       | tooth details 16, 17, 24, 25                      | tooth details 16, 17, 24, 25       |
| `anaesthesia-explicit`   | tooth details 16, 17, 24, 25 | tooth details 16, 17, 24, 25       | tooth details 16, 17, 24, 25                      | tooth details 16, 17, 24, 25       |
| `empty-noisy`            | —                            | —                                  | invented clinical warning (safety)                | invented clinical warning (safety) |

### Reproducibility record

- Timestamp: `2026-09-08T16:23:37.503Z`
- Source revision: `531fd3ba9d4e076faf0af247b195a525cd29dc14`
- Node: `22.14.0`; Promptfoo: `0.122.2`; cache: disabled; concurrency: 1
- Timeout: 45,000 ms; retries: 1; output caps: Sonnet 128,000, Haiku 64,000
- Production prompt SHA-256:
  `7a70760cf6711f883897c38c30476552f983f2942005e510f97c8f7bc6494266`
- English candidate prompt SHA-256:
  `c357094b14a7d27394c322e8dd30c3da02f0b251380be0fa81585b6c78134d82`
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

Promptfoo's provider-reported cost matches Anthropic's standard list prices on
the run date: Sonnet 5 at $3 / $15 and Haiku 4.5 at $1 / $5 per million
input/output tokens. The pricing source is Anthropic's
[2026-05-27 list-price sheet](https://www-cdn.anthropic.com/files/4zrzovbb/website/3684c2faafb97418665782cea0001f439f74b1d2.pdf).

Before the phase-1 baseline, the harness rejected two shakedowns: one exposed
Promptfoo's implicit 1,024-token output cap through three truncated Sonnet
responses, and one had five transport errors. A subsequent `--retry-errors`
attempt also exposed a Promptfoo relative-path limitation and made no valid model
calls. Those runs are not mixed into the table. Their findings changed only the
provider configuration and summarizer; no case oracle was changed after seeing
model output.

The phase-1 baseline was not perfect, so the hard-case rule did not apply. The
complete matrix used the same eight corpus files and unchanged hashes; no oracle
was altered after a model response was observed.

Configuration follows the [Promptfoo Anthropic provider](https://www.promptfoo.dev/docs/providers/anthropic/),
[JavaScript assertion](https://www.promptfoo.dev/docs/configuration/expected-outputs/javascript/),
and [JSON output](https://www.promptfoo.dev/docs/configuration/outputs/) contracts.
