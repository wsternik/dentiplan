# Contributor Map — who knows what, and what to read when there is nobody to ask

> Artifact 3 of the codebase-map series. Built from git history over the last
> 12 months (the whole history: 75 commits, 2026-05-24 → 2026-09-04).
>
> Two deviations from the lesson's script, both deliberate:
>
> 1. **The five areas below were derived independently**, straight from git
>    history and the directory layout, because `artifact-1-territory.md` and
>    `artifact-2-structure.md` were being written in parallel with this one and
>    were not available to read. Expect overlap in naming, not identity.
> 2. **The lesson asks "who do I ask about this area?". This repo has one
>    human.** So the question is re-framed: _what do I read instead of who do I
>    ask?_ That re-framing is the backbone of §4 and is the part of this
>    document worth keeping.
>
> Last updated: 2026-09-04

---

## 1. Top 5 areas that would normally require contact with a contributor

Areas are ranked by how much of their design lives _outside_ the code — in
decisions that a reader cannot recover by reading the files alone. That is the
honest definition of "needs a contributor": not size, not churn, but the ratio
of implicit to explicit.

| #   | Area                                      | Paths                                                                                                                                                                      | Commits | LOC             | Why it needs context beyond the code                                                                                                                                                        |
| --- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Data foundation & DB contract**         | `supabase/migrations/`, `supabase/tests/`, `src/db/database.types.ts`, `src/types.ts`                                                                                      | 11      | 1 644           | RLS policies, the patient-read RPC and the immutability trigger encode access rules that are invisible from the app layer. Renaming a column here is a breaking change across three slices. |
| 2   | **Approval → token → patient link**       | `src/pages/api/admin/quotes/approve.ts`, `src/lib/quote/token.ts`, `src/pages/p/[token].astro`, `src/components/patient/`                                                  | 3       | 343             | The privacy boundary of the whole product. What the patient may _not_ see is a product decision, not a code one. Three of the six test-plan risks live here.                                |
| 3   | **Admin quote editor & draft lifecycle**  | `src/components/admin/`, `src/pages/admin/`, `src/pages/api/admin/`                                                                                                        | 8       | 1 754           | Highest churn and highest LOC in the repo. `QuoteEditor.tsx` is the single most-touched file (5 commits). Draft vs approved state machine is spread across island, page and endpoint.       |
| 4   | **Pricing rules & cost engine**           | `src/lib/pricing/`, `src/lib/quote/cost.ts`, `src/lib/quote/format.ts`, `scripts/validate-pricing.ts`                                                                      | 11      | ~1 000          | The surgery's own business rules — anaesthesia fee, range arithmetic, automatic removal of local-anaesthesia items — are encoded, not documented in-line. Changing a price is a procedure.  |
| 5   | **Runtime, auth session, deploy & gates** | `src/middleware.ts`, `src/lib/supabase.ts`, `src/pages/api/auth/`, `wrangler.jsonc`, `astro.config.mjs`, `.github/`, `.husky/`, `playwright.config.ts`, `vitest.config.ts` | 24      | 538 (auth only) | Secrets, the Cloudflare account, `PROTECTED_ROUTES`, and the three-layer quality gate. Most of this is environment knowledge that never appears in a diff.                                  |

Areas 1–4 are the product; area 5 is everything that has to be true for the
product to run. Together they cover every tracked file except `src/components/ui/`
(vendored shadcn) and `src/components/{Banner,Welcome}.astro` (starter leftovers).

---

## 2. Who actually worked here — the unfiltered answer

`git shortlog -sne --all`:

```
    75  Wojciech Sternik <wsternik@gmail.com>
```

One author. One e-mail. Every commit in the repository, in every area, across
the full 12-month window.

**Bots and automation, filtered as the prompt asks:** there is nothing to
filter on the author side. The only non-human identity in the history is a
_committer_, not an author — `GitHub <noreply@github.com>` on the two merge
commits (`63efe76`, `7a48a4b`), which is just the GitHub web UI recording a PR
merge. No Dependabot, no Renovate, no CI-bot commits.

**Agent commits without clear human authorship:** none. Every commit is
authored by the human. Agent participation is recorded honestly, as a
`Co-Authored-By:` trailer, and the human stays the author of record:

| `Co-Authored-By` value                                 | Commits |
| ------------------------------------------------------ | ------- |
| `Claude Opus 5 <noreply@anthropic.com>`                | 13      |
| `Claude Opus 4.8 (1M context) <noreply@anthropic.com>` | 9       |
| _(no trailer)_                                         | 53      |

22 of 75 commits (29 %) carry an agent co-author trailer. The filtering rule in
the prompt — drop agent commits _without clear human authorship_ — removes zero
commits here, because human authorship is clear on all 75. The trailers are
kept below as a signal about **where the code was written with an agent in the
loop**, which turns out to be the more useful reading.

### The support line, honestly stated

There is no support line. There is one person, and the bus factor is **1** for
every one of the five areas. No area has a second pair of eyes, no area has a
reviewer distinct from the author, and the two PRs in the history (`#1`
`feat/admin-quote-list`, `#2` `test/e2e-playwright`) are self-merged.

Writing a five-name "ask X about Y" table here would be fiction. What follows
instead is the version of that table that is actually actionable.

---

## 3. Thematic activity of the single contributor

Grouping the one author's activity thematically still answers a real question:
_what has this person actually done, and in which order did the knowledge
accumulate?_ Themes are derived from commit subjects and touched paths.

**Wojciech Sternik** &lt;wsternik@gmail.com&gt; — 75/75 commits, 2026-05-24 → 2026-09-04.
Three working days of real activity (24–25 May, 3–4 June, 4 September) with a
three-month pause between June and September.

| Theme                             | Evidence (commits)                                                                                                                                                    | Depth        |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **Product definition**            | `/10x-shape`, `/10x-prd`, `/10x-roadmap`, `/10x-infra-research` — 36 k of shape-notes, 31 k of PRD, 29 k of roadmap                                                   | Deepest      |
| **Data & schema design**          | `aa283a4` core schema & RLS, `dff8048` patient-read RPC & immutability trigger, `5f3a546` type & Zod contract, `3f61548` verification probe & contract registry       | Deep         |
| **Pricing domain**                | `5c5a7a5` price-type extension & source schema, `7146427` seed data & load-time validation, `aea5a9d` resolver + S-01 API + change-price docs, `6a64bf6` review fixes | Deep         |
| **Quote flow & patient boundary** | `83ce4e7` cost engine + Vitest, `acd2320` approval transaction + token + link, `d473201` patient page `/p/<token>`, `9e31fdb` impl-review fixes F1–F3                 | Medium       |
| **Admin UI & draft lifecycle**    | `734e2c9`…`42a856c` (S-03, four phases), `567d1fd` impl-review fix F1, `0cad5a6` epilogue                                                                             | Medium (new) |
| **Quality gates & test strategy** | `49204f3`/`e1145bc` test-plan, `58a329b`/`8219860` husky hooks, `ae024c5` unit tests in CI, `1ad0918`/`eafc935` Playwright harness + patient-link e2e                 | Medium (new) |
| **Runtime & deployment**          | `f894a85` bootstrapper, `23a4970` first Cloudflare deploy, `b450628` Astro upgrade, `e9bdae0` `npm audit fix`                                                         | Shallow      |
| **Toolkit housekeeping**          | 12 × `10x get mXlY` — lesson-pack syncs, no product content                                                                                                           | n/a          |

Two things this table says that a headcount does not:

- The **product-definition** theme is by far the heaviest, and it lives entirely
  in `context/foundation/`. The author's own deepest knowledge is already
  written down, not held in memory.
- The **runtime & deployment** theme is the shallowest in commits (four) but the
  richest in un-committed knowledge — a Cloudflare account id, an API token in
  `~/.zshenv`, GitHub repository secrets. This is the one area where the bus
  factor genuinely bites.

---

## 4. Per area: what to read instead of who to ask

This is the re-framed support line. For each area: where the decision history
actually lives, what the agent-trailer ratio implies, and the one thing that is
still only in the author's head.

### 4.1 Data foundation & DB contract

- **Read first:** `context/archive/2026-06-03-quotes-data-foundation/plan.md`
  (the design), then `reviews/impl-review.md` (what the design got wrong and how
  it was fixed), then `docs/reference/contract-surfaces.md` (which names are
  load-bearing and may not be renamed without a coordinated migration).
- **Then read:** `supabase/migrations/20260603194110_quotes_foundation.sql` and
  `supabase/tests/quotes_foundation_probe.sql` — the probe is the executable
  statement of what the schema promises.
- **Agent-assisted:** 4 of 11 commits carry a trailer, including all three of
  the schema-defining ones (`aa283a4`, `dff8048`, `656030b`). Implication: the
  reasoning behind RLS and the RPC is in the plan and review documents, not in
  someone's recollection of writing the SQL.
- **Still only in the author's head:** nothing material. This is the
  best-documented area in the repo.

### 4.2 Approval → token → patient link

- **Read first:**
  `context/archive/2026-06-04-first-thin-quote-and-patient-link/plan.md`, then
  `reviews/plan-review.md` (findings F1–F4, pre-implementation) and
  `reviews/impl-review.md` (findings F1–F3, notably F2: the patient-visible note
  is unbounded free text).
- **Then read:** `context/foundation/test-plan.md` §2 risks #2, #3 and #4 —
  they name exactly what must never leak to `/p/<token>` and why.
- **And:** `e2e/patient-link-content.spec.ts` and `e2e/patient-link-probe.spec.ts`
  — the only executable statement of the privacy contract.
- **Agent-assisted:** the approval transaction (`acd2320`) is trailered; the
  patient page (`d473201`) is not. The e2e tests that guard this boundary carry
  no trailer either.
- **Still only in the author's head:** the product judgement on _which_ fields
  are patient-safe. The PRD (FR-066, FR-072) states the rule; the case-by-case
  application is unwritten.

### 4.3 Admin quote editor & draft lifecycle

- **Read first:** `context/archive/2026-09-04-admin-quote-list/plan.md` — the
  four-phase decomposition maps one-to-one onto commits `734e2c9`, `d8e1c0f`,
  `5f1e1ac`, `42a856c`, so each phase of the plan explains one diff.
- **Then read:** `reviews/plan-review.md` (1 critical finding, fixed before
  implementation) and `reviews/impl-review.md` (F1, fixed in `567d1fd`).
- **Agent-assisted:** **7 of 8 commits** — the highest ratio of any area. This
  is the newest code, the most churned code, and the code least likely to be
  reconstructible from memory. Treat the plan document as the primary source and
  the diff as secondary.
- **Still only in the author's head:** very little; this area was built
  plan-first and closed with an epilogue (`0cad5a6`).

### 4.4 Pricing rules & cost engine

- **Read first:** `src/lib/pricing/README.md` — a written procedure (in Polish)
  for changing a price, including the deliberate v1 decision to keep the
  pricelist in code rather than behind an admin panel.
- **Then read:**
  `context/archive/2026-06-03-pricelist-seed-foundation/plan.md` and its
  `reviews/impl-review.md`; the JSON sources in `src/lib/pricing/data/` carry
  inline annotations added in `7146427`.
- **And:** `src/lib/quote/cost.test.ts` and `format.test.ts` — 23 unit tests
  that are the de-facto specification of the arithmetic (test-plan risk #5 rests
  on them).
- **Agent-assisted:** 4 of 11 commits. The three phases that shaped the pricing
  model itself (`5c5a7a5`, `7146427`, `aea5a9d`) are all trailer-free.
- **Still only in the author's head:** the surgery's commercial reasoning —
  why a given item is priced as a range rather than a fixed amount. The code
  records the shape, not the motive.

### 4.5 Runtime, auth session, deploy & quality gates

- **Read first:** `context/deployment/runbook.md` — a one-page ops cheat sheet
  for the `dentiplan-production` Cloudflare Worker, and
  `context/deployment/deploy-plan.md` for the first-deploy audit trail
  (worker name, account id, production URL).
- **Then read:** `context/foundation/infrastructure.md` (18 k — why Cloudflare,
  scored against alternatives) and `context/foundation/tech-stack.md` (why this
  starter).
- **And:** `CLAUDE.md` §Quality gates — the three-layer table (per-edit lint,
  pre-commit lint + `astro check`, CI lint/test/build + deploy) with the
  rationale for why typecheck sits at the commit layer and not per-edit.
- **Agent-assisted:** 1 of 24 commits. This area is almost entirely
  hand-written, which is consistent with it being environment work rather than
  code work.
- **Still only in the author's head — and this is the real bus-factor
  exposure:** the Cloudflare account credentials, the `CLOUDFLARE_API_TOKEN`
  exported from `~/.zshenv`, and the values behind the `SUPABASE_URL` /
  `SUPABASE_KEY` repository secrets. The runbook names the commands; it cannot
  hand over the access.

---

## 5. What this means

1. **Bus factor is 1, uniformly.** There is no area with a second contributor,
   so there is no "escalate to X" path for any of the five areas.
2. **Institutional memory is on disk, not in a head — by design.** 47 of 75
   commits touch `context/` or `docs/`. Every implemented slice has a `plan.md`,
   a `plan-review.md` and/or an `impl-review.md` with numbered findings and
   their resolutions. For a solo repo this is the substitute for a colleague,
   and it is unusually complete.
3. **Agent-assisted areas are the best-documented ones, not the worst.** The
   admin slice (7/8 trailered) has the most thorough plan-and-review paper trail
   in the repository, because the agent workflow forced the plan to be written
   before the code. The inverse of the usual worry.
4. **The one genuine gap is credentials and account access**, not code
   comprehension. Everything else in this repository can be reconstructed by a
   competent reader from `context/` plus the diffs.
5. **The onboarding order for a second contributor** would be:
   `context/foundation/prd.md` → `roadmap.md` → `test-plan.md` →
   `CLAUDE.md` → the four `context/archive/*/plan.md` files in date order →
   `docs/reference/contract-surfaces.md`. That sequence replays the project's
   decisions in the order they were made.
