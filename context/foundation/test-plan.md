# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-09-04

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the team
   is worried about X, and the failure would surface somewhere in <area>"
   carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents _what
   could fail_ and _why we believe it's likely_ — drawn from documents,
   interview, and codebase _signal_ (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/` (excluding `dist`,
`.astro`, `node_modules`, `supabase/migrations`). **The scan produced no
usable signal** — the scoped git log holds 4 commits in the last 30 days,
below the 5-commit threshold, because the project paused between June and
September. Likelihood ratings below rest on the PRD, the roadmap, the
archived S-01 review, and the Phase 2 interview instead.

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the _evidence that surfaced
this risk_ — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| #   | Risk (failure scenario)                                                                                                                                                                                                                                                                                                                                      | Impact | Likelihood | Source (evidence — not anchor)                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | A quote is frozen and sent to a patient carrying data the server never checked — a tooth number outside FDI range, a pricelist item that is not in the snapshot. Because approved quotes are read-only, the dentist cannot correct it; she must rebuild the quote and re-send a new link.                                                                    | High   | High       | archived slice `first-thin-quote-and-patient-link`, impl-review finding F1; interview Q3 ("approval path — most layers, zero tests"); PRD FR-053                                                       |
| 2   | An approved quote changes after the link has been handed to the patient, so the patient sees different amounts than the ones discussed in the surgery.                                                                                                                                                                                                       | High   | Medium     | PRD FR-050, FR-053; roadmap S-01 Risk note (snapshot kept inline so an approved record is self-contained)                                                                                              |
| 3   | The patient page shows something the patient must never see — the e-mail the dentist stored for her own reference, or the raw diagnosis text she pasted in.                                                                                                                                                                                                  | High   | Medium     | PRD FR-066, FR-072, Access Control ("e-mail is kept on the admin side only"); archived slice `first-thin-quote-and-patient-link`, impl-review finding F2 (patient-visible note is unbounded free text) |
| 4   | Someone probing `/p/<token>` learns more than they should: the response distinguishes "no such quote" from "quote exists but is not yours", or tokens turn out to be guessable at scale.                                                                                                                                                                     | High   | Medium     | PRD FR-051, FR-060; NFR Privacy & security ("attacker guessing 1M tokens/s finds nothing in 10 years")                                                                                                 |
| 7   | The note prefill puts something in the form the dentystka never wrote — a pricelist item that is not in the catalog, a tooth number outside FDI, or a treatment nobody proposed — and because it arrives pre-filled rather than typed, it is approved without being noticed. Approved quotes are immutable, so the correction is a new quote and a new link. | High   | Medium     | roadmap S-02 / PRD FR-011, FR-012; `context/changes/llm-parsing-prefill/research.md` (Anthropic's structured output rejects numeric bounds, so an out-of-range tooth number is schema-valid)           |
| 5   | The patient is shown a number that does not follow the surgery's own rules — the anaesthesia fee, the range arithmetic, or the automatic removal of local-anaesthesia items.                                                                                                                                                                                 | High   | Low        | PRD FR-026, FR-040 – FR-044; existing suite already covers the cost engine (23 tests in `src/lib/quote/`)                                                                                              |
| 6   | An unauthenticated request reaches the admin panel, or the dentist — the single operator — is locked out of it.                                                                                                                                                                                                                                              | High   | Low        | PRD FR-003, Access Control; roadmap S-05 (`ready`, not yet implemented)                                                                                                                                |

Two notes on how this map was built, so a later reader can argue with it:

- **#5 and #6 are High impact × Low likelihood and stay anyway.** The usual
  advice is to hand those to observability rather than to a test, and that
  advice is aimed at things nobody can cheaply reproduce, like a cloud
  provider outage. Both of these are cheap: #5 is an assertion against
  rules already written down in the PRD, #6 is one request without a
  cookie. Dropping them would buy nothing.
- **Interview question 1 ("what worries you most, independent of the
  docs") was skipped.** So the "what could hurt" axis rests on the PRD and
  on the archived review rather than on lived fear. Questions 2, 3 and 5
  were answered; Q2 came back as "nothing concrete yet", which is itself
  why likelihood ratings here are conservative.

### Risk Response Guidance

| Risk | What would prove protection                                                                                                                                                                                                                                   | Must challenge                                                                                                                                                                          | Context `/10x-research` must ground                                                                                                              | Likely cheapest layer                           | Anti-pattern to avoid                                                                                                                                            |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1   | Approving a quote whose payload carries an out-of-range tooth or an item absent from the pricelist is rejected, and nothing is persisted — no row, no token.                                                                                                  | That client-side Zod validation implies the server validates. The browser is not a trust boundary.                                                                                      | The approval entry point, what the server re-derives versus what it accepts from the request, and where the pricelist snapshot is taken.         | integration (endpoint-level)                    | Asserting the current response shape instead of the rule: a test that accepts whatever the handler returns today will freeze a bug (oracle problem).             |
| #2   | A second write against an already-approved quote leaves the stored amounts, snapshot and token untouched, and the caller is told no.                                                                                                                          | That "the UI hides the edit button" is immutability. Immutability has to hold against a direct request.                                                                                 | Where immutability is actually enforced — application code, a database constraint, or a trigger — and what the caller observes when it trips.    | integration                                     | Testing only through the UI, which never sends the request that would break the rule.                                                                            |
| #3   | For a given approved quote, the bytes served at `/p/<token>` contain no e-mail address and no raw diagnosis text, whatever the dentist typed into the form.                                                                                                   | That "the component does not render it" is enough. Server-rendered pages can carry data in serialised island props.                                                                     | What the patient route actually loads from storage and what it hands to the client, including island props and error bodies.                     | integration on the rendered response            | Asserting on the rendered component tree rather than on the response body the browser receives.                                                                  |
| #4   | An unknown token and a well-formed but non-existent token produce the same generic page, with no field, status code, or timing that separates the two.                                                                                                        | That a 404 is automatically safe. "Not found" versus "found but not yours" is exactly the leak.                                                                                         | How the token is looked up, how a miss is translated into a response, and where the token is generated.                                          | integration + one e2e for the user-visible path | Testing only the happy path with a valid token; the abuse case is the whole point of this row.                                                                   |
| #7   | For a model answer that is VALID against the wire schema, the tree handed to the form contains only FDI teeth and only items that are in the seed and valid in the context they were offered for — and everything dropped is named in a warning she can read. | That schema validation is validation. The provider rejects `minimum`/`maximum` on a number, so tooth 99 is schema-valid; and catalog membership alone lets a general item onto a tooth. | Where the model's answer stops being the model's and becomes the form's, and which of the domain's rules are checked there rather than upstream. | unit, on recorded model answers                 | Calling the real API from the suite. The verdict would then depend on what the model said that day — a flaky test of someone else's service, not of our mapping. |
| #5   | For a fixture quote, the anaesthesia fee, the ranges, and the excluded local-anaesthesia items match the rules in the PRD — not the numbers the current code emits.                                                                                           | That the existing 23 tests already cover this. They cover the engine; the rules also travel through the snapshot.                                                                       | Which of the PRD rules are engine-level and which are decided at approval time against the snapshot.                                             | unit, extending the existing suite              | Copying the expected value from the implementation. The oracle is the PRD, FR-040 – FR-044.                                                                      |
| #6   | A request to an admin route without a session ends at the login page and never reaches the handler or the data.                                                                                                                                               | That "middleware exists" equals "middleware is applied to this route".                                                                                                                  | The route-matching rules and the order in which session lookup and route protection run.                                                         | integration                                     | Checking only that a redirect happens, without confirming the protected handler did not run.                                                                     |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| #   | Phase name                 | Goal (one line)                                                                                   | Risks covered | Test types        | Status      | Change folder                                                                                                           |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------- | ------------- | ----------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | Approval boundary          | Prove that nothing is frozen without the server checking it, and that a frozen quote stays frozen | #1, #2        | integration       | not started | —                                                                                                                       |
| 2   | Patient link contract      | Prove the patient page carries only quote content, and that a bad token tells a prober nothing    | #3, #4        | integration + e2e | complete    | — (standalone `/10x-e2e` run, one risk at a time: `e2e/patient-link-content.spec.ts`, `e2e/patient-link-probe.spec.ts`) |
| 3   | Cost rules against the PRD | Prove the amounts follow FR-040 – FR-044 rather than the current implementation                   | #5            | unit              | not started | —                                                                                                                       |
| 4   | Access boundary            | Prove admin routes are unreachable without a session                                              | #6            | integration       | not started | —                                                                                                                       |
| 5   | Note prefill boundary      | Prove nothing the model invents reaches the form unnamed                                          | #7            | unit              | complete    | `context/changes/llm-parsing-prefill/` (`src/lib/llm/parse-diagnosis.test.ts`, `prompt.test.ts`)                        |

## 4. Stack

The classic test base for this project. AI-native tools (if any) carry a
`checked:` date so future readers can see which lines need re-verification.

| Layer         | Tool                | Version    | Notes                                                                                                                                             |
| ------------- | ------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| unit          | Vitest              | 4.1.8      | Configured in `vitest.config.ts`; 2 test files, 23 tests, all covering the cost engine. Runs in CI via `npm test`.                                |
| integration   | Vitest              | 4.1.8      | None yet — see §3 Phase 1. The runner is in place; what is missing is the harness for Astro endpoints and a Supabase boundary.                    |
| e2e           | Playwright          | 1.62.1     | `playwright.config.ts`; `npm run test:e2e`. Chromium against `npm run dev` (`webServer`), signed in once via `storageState`. Local only — see §5. |
| API mocking   | none yet            | —          | Decide during §3 Phase 1 research. The only external boundary today is Supabase.                                                                  |
| accessibility | none                | —          | Out of scope: the PRD puts full WCAG-AA compliance in "consciously omitted for MVP".                                                              |
| lint / format | ESLint 9 + Prettier | 9.29 / 3.8 | Wired locally through husky + lint-staged and in CI.                                                                                              |

**Stack grounding tools (current session):**

- Docs: Context7 MCP available — not queried; versions above were read directly from `package.json`, which is the stronger source for what this repo actually runs; checked: 2026-09-04
- Search: none exposed in current session; checked: 2026-09-04
- Runtime/browser: no Playwright MCP in current session — a browser layer would have to be added as a project dependency; checked: 2026-09-04
- Provider/platform: Supabase MCP available (read-only inspection of tables, policies and logs) — usable to confirm that RLS policies match what a test asserts, not as a substitute for one; GitHub reachable through the `gh` CLI rather than an MCP; checked: 2026-09-04

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required after §3 Phase N" means the gate is enforced once that rollout
phase lands; before that, the gate is planned.

| Gate                                     | Where                                   | Required?                 | Catches                                                          |
| ---------------------------------------- | --------------------------------------- | ------------------------- | ---------------------------------------------------------------- |
| lint + format on staged files            | local, pre-commit (husky + lint-staged) | required                  | style and syntax drift before it enters a commit                 |
| lint                                     | CI, on push and PR to `main`            | required                  | anything that bypassed the pre-commit hook                       |
| unit tests                               | local + CI, on push and PR to `main`    | required                  | logic regressions; blocks the production deploy job              |
| build                                    | CI, on push and PR to `main`            | required                  | type and bundling errors                                         |
| integration tests                        | local + CI                              | required after §3 Phase 1 | approval-path and patient-page regressions                       |
| e2e                                      | local, before opening a PR              | required                  | broken critical user path end to end                             |
| post-edit hook (lint on the edited file) | local, agent loop                       | recommended               | mistakes at edit time, fed back to the agent in the same session |

**E2E runs locally before a PR; unit tests run in CI.** The pipeline has no
Supabase environment to point a browser at, and production is not a place to
create test data — so putting e2e in CI would mean either standing up a second
Supabase project or writing quotes into the live one on every push. Until that
trade changes, the gate is the dentystka's own machine: `npm run test:e2e` green
before opening a PR.

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see §3 Phase N."

### 6.1 Adding a unit test

- **Location**: next to the unit under test, e.g. `src/lib/quote/cost.test.ts`.
- **Naming**: `<module>.test.ts`.
- **Reference test**: `src/lib/quote/cost.test.ts`.
- **Run locally**: `npm test`.

### 6.2 Adding an integration test

- TBD — see §3 Phase 1, for the "nothing is frozen without server-side validation" pattern.

### 6.3 Adding an e2e test

- **Location**: `e2e/<feature>.spec.ts`, one test per file.
- **Naming**: the test name opens with the risk it protects (`risk #3: …`), so a
  failure names the scenario rather than a file.
- **Reference test**: `e2e/seed.spec.ts` — the exemplar every new test is
  modelled on. Read it before writing one; the conventions it fixes (role
  locators, one self-contained test with its own cleanup, waiting for state) are
  what keeps this layer from becoming the flaky one.
- **Hydration**: this app is Astro SSR with React islands, so acting on an island
  before it hydrates is silently discarded. Call `waitForIslands(page)` from
  `e2e/support/app.ts` after landing on a page with an interactive island —
  never a timeout.
- **Auth**: `e2e/auth.setup.ts` signs in once and stores the session; specs start
  authenticated. A spec that needs an anonymous visitor opts out with
  `test.use({ storageState: { cookies: [], origins: [] } })` or opens its own
  context, which is also how "the patient has no session" gets asserted rather
  than assumed.
- **Credentials**: `E2E_EMAIL` / `E2E_PASSWORD` in `.env` (gitignored; see
  `.env.example`).
- **Data**: there is no local Supabase in this setup, so e2e runs against the
  real project. Tag every record with a `Date.now()` stamp and clean up at the
  end of the test. Approved quotes are the exception — FR-053 makes them
  immutable, so a test that approves one cannot delete it; that is why only one
  spec approves, and why unique data, not cleanup, is what keeps runs isolated.
- **Run locally**: `npm run test:e2e` (add a path for a single spec).

### 6.4 Adding a test for a new API endpoint

- TBD — see §3 Phase 1.

### 6.5 Per-rollout-phase notes

**Phase 2 — Patient link contract.** Two things are worth carrying into the
later phases:

- The leak assertions run against `response.text()`, not the rendered tree, as
  §2's anti-pattern column demands. Assert _absence_ only next to evidence the
  data exists at all (this spec first confirms the e-mail on the admin list),
  otherwise "it is not on the page" is also true of a page that never had it.
- Both specs were break-verified rather than trusted: rendering the diagnosis
  note on the patient page turns risk #3 red, and answering `400` instead of
  `404` for a malformed token turns risk #4 red. A test that stays green when
  its risk materialises is decorative, and that is only knowable by breaking the
  thing on purpose.

Phase 2's **integration** half is not covered by these two specs — they are the
browser-level layer over the same risks. It stays open.

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Future
contributors should respect these unless the underlying assumption changes.

- **Supabase internals** — password hashing, session validity, and whether RLS itself works. That is the provider's contract. Re-evaluate if we ever move auth in-house. (Source: Phase 2 interview Q5.)
- **Astro and framework behaviour** — island hydration, routing, the render pipeline. Testing someone else's code. Re-evaluate on a major framework upgrade that changes SSR semantics. (Source: Phase 2 interview Q5.)
- **Pricelist seed data** — `npm run validate:pricing` already checks the seed's shape and the `local-anesthesia` flags. Re-evaluate if the pricelist ever gets an editing UI. (Source: Phase 2 interview Q5.)
- **Visual snapshots of pages and components** — they break on every style change and catch little. Re-evaluate if the patient page ever ships a graphical tooth chart. (Source: Phase 2 interview Q5.)
- **The note prefill end-to-end, in a browser** — risk #7 is covered by unit tests on recorded model answers instead. A browser test would have to call the real API for its verdict, which makes it a paid, non-deterministic test of Anthropic's output rather than of our mapping; what we actually own is the code that decides which of that output is allowed into the form, and that is pure and testable on fixtures. Re-evaluate if the prefill ever gains behaviour that only exists in the browser. (Source: `llm-parsing-prefill` plan.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-09-05 (risk #7 added with the note prefill)
- Stack versions last verified: 2026-09-04
- AI-native tool references last verified: 2026-09-04

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
