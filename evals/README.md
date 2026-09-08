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

## Baseline — 2026-09-08

The retained run `eval-o2A-2026-09-08T15:29:43` completed the production Polish
prompt against `claude-sonnet-5` with medium effort and
`claude-haiku-4-5` without an effort option: 8 cases × 2 providers = 16 uncached
calls, with no provider errors. Strict macro pass means that every deterministic
atom for the case passed.

| Model configuration  | Safety eligible | Strict cases |          Atoms | Input / output tokens | Cost (USD) | Cost / case |       Median / p95 |
| -------------------- | --------------- | -----------: | -------------: | --------------------: | ---------: | ----------: | -----------------: |
| Sonnet 5, medium     | yes             |  2/8 (25.0%) | 92/110 (83.6%) |        49,035 / 6,682 |  $0.247335 |   $0.030917 | 7.286 s / 15.981 s |
| Haiku 4.5, no effort | **no**          |   0/8 (0.0%) | 87/110 (79.1%) |        38,007 / 2,712 |  $0.051567 |   $0.006446 | 9.522 s / 13.473 s |

Sonnet passed `unknowns-and-fdi` and `empty-noisy`. Its other six cases failed
quality atoms: defaulted filling/root-canal urgencies remained `unknown`, and
`status-and-urgency` did not preserve the note-derived urgency flag. It had no
safety-atom failure.

Haiku failed all eight strict cases. In addition to urgency and visit-grouping
quality mismatches, three cases failed safety atoms: it invented clinical
content for `empty-noisy`, invented a general hygiene item in
`status-and-urgency`, and converted the unknown `flow-injection` term into a
filling while omitting the required warning in `unknowns-and-fdi`.

| Case                     | Sonnet 5 failures            | Haiku 4.5 failures                                |
| ------------------------ | ---------------------------- | ------------------------------------------------- |
| `catalog-grounding`      | tooth details 16, 24, 54     | tooth details 16, 24, 54                          |
| `unknowns-and-fdi`       | —                            | tooth 17; required warning (safety)               |
| `status-and-urgency`     | tooth 24                     | teeth 16, 24; visit groups; general item (safety) |
| `visit-topology`         | tooth details 24, 26, 45, 46 | tooth details 45, 46; visit groups                |
| `explicit-plan`          | tooth details 14, 15         | tooth details 14, 15                              |
| `anaesthesia-considered` | tooth details 16, 17, 24, 25 | tooth details 16, 17, 24, 25                      |
| `anaesthesia-explicit`   | tooth details 16, 17, 24, 25 | tooth details 16, 17, 24, 25                      |
| `empty-noisy`            | —                            | invented clinical warning (safety)                |

### Reproducibility record

- Timestamp: `2026-09-08T15:29:43.627Z`
- Source revision: `09bfb777bc7554b4394592bf5af8712ba87bf43a`
- Node: `22.14.0`; Promptfoo: `0.122.2`; cache: disabled; concurrency: 1
- Timeout: 45,000 ms; retries: 1; output caps: Sonnet 128,000, Haiku 64,000
- Production prompt SHA-256:
  `7a70760cf6711f883897c38c30476552f983f2942005e510f97c8f7bc6494266`
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

Before the retained run, the harness rejected two shakedowns: one exposed
Promptfoo's implicit 1,024-token output cap through three truncated Sonnet
responses, and one had five transport errors. A subsequent `--retry-errors`
attempt also exposed a Promptfoo relative-path limitation and made no valid model
calls. Those runs are not mixed into the table. Their findings changed only the
provider configuration and summarizer; no case oracle was changed after seeing
model output.

The baseline is not perfect, so the hard-case rule does not apply before phase 2. Existing oracles remain frozen; phase 2 compares the English candidate
against this same corpus and selection rule.

Configuration follows the [Promptfoo Anthropic provider](https://www.promptfoo.dev/docs/providers/anthropic/),
[JavaScript assertion](https://www.promptfoo.dev/docs/configuration/expected-outputs/javascript/),
and [JSON output](https://www.promptfoo.dev/docs/configuration/outputs/) contracts.
