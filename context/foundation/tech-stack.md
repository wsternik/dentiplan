---
starter_id: 10x-astro-starter
package_manager: npm
project_name: dentiplan
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
---

## Why this stack

DentiPlan is a 3-week MVP for a single dental practice: an authenticated admin panel for the dentystka plus a token-protected public page for patients, with an LLM call to parse the raw diagnosis text. 10x-astro-starter is the recommended default for the `(web, js)` cell and clears all four agent-friendly gates (typed via TypeScript + Zod, convention-based via Astro, popular in training data, well-documented). It bundles auth + Postgres + storage (Supabase) and edge deploy (Cloudflare Pages/Workers) out of the box, so FR-001–003 (auth), FR-050 (pricelist snapshot), and FR-051/060 (token-protected public route) land without assembling a database layer. TypeScript + Zod give a natural place to validate the LLM parsing output against a schema (FR-012). The Cloudflare runtime cleanly serves the public `/p/<token>` page at low cost for 1 gabinet. Standard path — no quality gates failed, no overrides. Bootstrapper confidence is `first-class` (not `verified`); expect occasional manual steps during scaffold.

## LLM provider

**Anthropic through the AI SDK** (`ai` + `@ai-sdk/anthropic`), model `claude-sonnet-5`,
overridable per environment with `LLM_MODEL`. One `generateText` call with
`Output.object` against a Zod schema — no tool loop, because there is nothing for
the model to call.

Chosen because the repo already speaks this stack: `scripts/review/agent.ts` runs
the same SDK against the same provider, so S-02 adds a second caller, not a second
SDK. Structured output validated by Zod is what FR-012 needs, and the adapter in
`src/lib/llm/` keeps the provider behind one file (per `infrastructure.md`, Risk:
AI Gateway lock-in) if that ever stops being true.

Rejected: OpenAI and OpenRouter — both would put a second SDK in the repo for a
single call, and neither buys anything the Polish-language parsing quality bar
does not already get. A local model was rejected on runtime: Workers cannot host
one, so it would mean a second piece of infrastructure for the MVP's only AI call.

Privacy is enforced structurally rather than by policy: `parseDiagnosis` takes a
`string` and nothing else, so `patient_email` has no path into a prompt (FR-011,
FR-072).

**Measured 2026-09-09:** the paid, uncached Promptfoo matrix selected the English
instruction prompt with `claude-sonnet-5` at medium effort. English/Sonnet and
Polish/Sonnet were both safety-eligible and tied at 3/8 strict cases and 137/152
atoms, so the predeclared cost tie-break selected English ($0.019772/case versus
$0.021961/case). Both Haiku cells failed safety atoms. Polish catalog names,
ids, dentist notes and patient UI remain Polish; only the model-facing
instruction prose is English. The full decision and prompt hash are in
`evals/README.md`.

`npm run eval` is therefore a paid manual gate before any production prompt or
default-model change. It runs eight synthetic cases against the English
production prompt and Polish baseline
and both models, with cache disabled, and keeps raw results only under the ignored
`evals/prefill/.generated/` directory. It is not a CI job because model output is
non-deterministic, every matrix run costs money, and CI does not hold the provider
key.

This closes PRD Open Q #12 and Open Roadmap Question #1.

## Vendored code

**`react-odontogram` 0.5.6 (MIT), path data only.** S-06's tooth chart needs a
drawing of a dental arch. The eight crown outlines, the four quadrant transforms
and the viewBox were **copied** into `src/lib/tooth-chart/paths.ts` rather than
installed from npm. Attribution and the licence notice are in
`THIRD-PARTY-NOTICES.md` at the repo root.

Why copied and not a dependency: what the library offers that we want is its
geometry, and what it offers that we cannot use is everything else — its
`readOnly` mode disables interaction rather than freezing it (the patient page
needs a chart that is inert but still hoverable and keyboard-reachable), its
styling is a `:root` palette of its own that would fight the S8 tokens, its
labels are English, and **its FDI quadrant mapping is wrong** (it draws quadrant
3 on the viewer's left, where quadrant 4 belongs). Depending on it would mean
overriding almost all of it while inheriting a defect we would have to patch.
Copying the inert half leaves the mapping ours to get right, in `layout.ts`,
with a test.

What this means for updates: **nothing.** Tooth geometry is frozen — there is no
upstream fix to track, no version to bump, and no supply-chain surface. If the
drawing ever needs to change it changes here, as our own file.
