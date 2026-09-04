# Artifact 1 — Territory Map (git history)

> Wide Scan of where this project has actually been touched, derived only
> from git history. Every number below was computed with `git log`
> (`--numstat`, `--name-only`, `-M`) over this repository — nothing is
> estimated.
>
> Produced from `.claude/prompts/m4l2-1-territory-git-history.md`.
>
> Last updated: 2026-09-04

## 0. Scope and method

**Window: the entire history, not the last 12 months.** The prompt series
asks for a 12-month window and a quarterly split; this repo is younger than
that, so both were adapted:

- First commit `7849e75` — 2026-05-24. Last commit `7952e87` — 2026-09-04.
- Span: **104 days (~3.5 months)**, 75 commits, of which 2 are merge commits
  (`--merges` = 2) and contribute no file changes.
- The history is used **whole**. Any "last 12 months" figure would be
  identical to the total, so the 12-month framing is dropped rather than
  faked.

**The calendar is misleading — this project has only 5 working days.**

| Day        | Commits |
| ---------- | ------- |
| 2026-05-24 | 16      |
| 2026-05-25 | 2       |
| 2026-06-03 | 13      |
| 2026-06-04 | 16      |
| 2026-09-04 | 28      |

So "quarterly" is meaningless here. §3 splits the data into the **three work
bursts** the history actually contains (May / June / September), which is the
finest honest granularity available.

**Noise filter.** These paths were excluded from every ranking below:

`package-lock.json`, `.claude/.10x-cli-manifest.json` (the 10xDevs lesson-pack
manifest — 15 touches, pure tooling bookkeeping), `.gitignore`, `.nvmrc`,
`.env.example`, `.dev.vars.example`, `tsconfig.json`, `eslint.config.js`,
`.prettierrc.json`, `components.json`, `astro.config.mjs`, `wrangler.jsonc`,
`vitest.config.ts`, `playwright.config.ts`, `supabase/config.toml` (388 lines
of `supabase init` scaffold), `src/db/database.types.ts` (generated from the
Supabase schema), `src/env.d.ts`, `.vscode/`, `public/`, `.astro/`, `dist/`.

Effect: **293 file-touches → 242**, across 140 distinct paths.

**Two bulk commits are excluded from the co-change analysis only** (§4, §5),
because a single scaffold commit would otherwise couple everything to
everything:

- `f894a85` "/10x-bootstrapper" — 32 filtered files (the Astro starter).
- `db9208e` "feat(first-thin-quote-and-patient-link): admin shell + new-quote
  editor island (p2)" — 19 filtered files (the admin UI landing in one go).

They are kept in the activity rankings (§1–§3), where creation is real work.

**Caveat on statistical power.** 22 commits touch `src/`, `e2e/`,
`supabase/` or `scripts/` after filtering. Co-change supports are therefore
small integers (2–4), not the dozens you would get from a mature repo. The
couplings below are read as _shape_, not as significance.

## 1. Activity — directories and modules (top 10)

Rename-normalised (`context/archive/<date>-<slice>/` folded back into
`context/changes/<slice>/`, see §6). Three signals per row: file-touches,
lines changed (`+` plus `-`), and distinct commits.

| #   | Area                                         | Touches | Lines changed | Commits |
| --- | -------------------------------------------- | ------- | ------------- | ------- |
| 1   | `<root>`                                     | 26      | 1628          | 23      |
| 2   | `context/changes/admin-quote-list/`          | 22      | 813           | 9       |
| 3   | `src/components/admin/`                      | 22      | **1529**      | 6       |
| 4   | `context/changes/first-thin-quote-…-link/`   | 18      | 742           | 8       |
| 5   | `context/changes/pricelist-seed-foundation/` | 18      | 565           | 9       |
| 6   | `context/changes/quotes-data-foundation/`    | 18      | 630           | 9       |
| 7   | `context/foundation/`                        | 15      | 1410          | 15      |
| 8   | `src/lib/pricing/`                           | 11      | 536           | 5       |
| 9   | `src/pages/api/`                             | 9       | 567           | 5       |
| 10  | `src/pages/admin/`                           | 7       | 292           | 5       |

Just below the cut, and worth naming because they carry real weight:
`src/lib/quote/` (7 touches / 617 lines / 4 commits), `src/components/patient/`
(7 / 266 / 1), `src/components/auth/` (6 / 357 / 1), `e2e/` (4 / 248 / 2),
`supabase/migrations/` (3 / 133 / 3).

**Reading it.** Roughly **half the ranking is process documentation, not
code.** `context/` in total accounts for 91 of 242 filtered touches (38%).
That is a genuine property of this repo — it is built with the 10xDevs
plan/implement/review/archive loop, and each slice leaves a `plan.md`,
`change.md` and `reviews/` behind. The code half of the ranking is dominated
by one region: **the admin quote editor and everything it touches**
(`src/components/admin/` + `src/pages/admin/` + `src/pages/api/` = 38 touches,
2388 lines, and the single largest churn block in the repo).

Going one level deeper (as the prompt asks) did matter: at depth 2 the answer
was the uninformative `src/components/` (44 touches). At depth 3 that splits
into `admin/` 22, `patient/` 7, `ui/` 6, `auth/` 6 — and the concentration in
`admin/` becomes visible.

## 2. Activity — files (top 10)

### 2a. All files, by touches

| #   | Touches | Lines   | File                                                  |
| --- | ------- | ------- | ----------------------------------------------------- |
| 1   | 14      | 1097    | `CLAUDE.md`                                           |
| 2   | 8       | 96      | `package.json`                                        |
| 3   | 8       | 554     | `context/changes/admin-quote-list/plan.md`            |
| 4   | 7       | 457     | `context/changes/quotes-data-foundation/plan.md`      |
| 5   | 6       | 286     | `context/foundation/roadmap.md`                       |
| 6   | 6       | 412     | `context/changes/pricelist-seed-foundation/plan.md`   |
| 7   | 6       | 154     | `context/changes/pricelist-seed-foundation/change.md` |
| 8   | 6       | 536     | `context/changes/first-thin-quote-…/plan.md`          |
| 9   | 5       | **691** | `src/components/admin/QuoteEditor.tsx`                |
| 10  | 5       | 175     | `context/changes/quotes-data-foundation/change.md`    |

`CLAUDE.md` tops the list but is a **false hot spot** — see §5.

### 2b. Code files only (`src/`, `e2e/`, `supabase/`, `scripts/`)

Ordered by lines changed, because touch counts here bottom out at 2–5 and
stop discriminating.

| #   | Lines | Touches | File                                         |
| --- | ----- | ------- | -------------------------------------------- |
| 1   | 691   | 5       | `src/components/admin/QuoteEditor.tsx`       |
| 2   | 317   | 3       | `src/pages/api/admin/quotes/approve.ts`      |
| 3   | 243   | 2       | `src/lib/pricing/seed.ts`                    |
| 4   | 242   | 1       | `src/lib/quote/cost.test.ts`                 |
| 5   | 227   | 3       | `src/types.ts`                               |
| 6   | 196   | 2       | `src/components/admin/ToothRow.tsx`          |
| 7   | 181   | 4       | `src/pages/admin/index.astro`                |
| 8   | 158   | 1       | `supabase/tests/quotes_foundation_probe.sql` |
| 9   | 153   | 1       | `src/lib/quote/cost.ts`                      |
| 10  | 134   | 2       | `src/lib/services/quote-payload.test.ts`     |

Also in the tail: `supabase/migrations/20260603194110_quotes_foundation.sql`
(133 lines / 3 touches) and `src/components/admin/types.ts` (3 touches),
which matters more for coupling than for churn — see §4.

**`QuoteEditor.tsx` is the single hottest code file by a factor of two.**
It was created in `db9208e` (June, admin shell) and rewritten in September
during `admin-quote-list` (draft save, reopening drafts, read-only approved
view). It is also the file with the widest code-side coupling (§4).

## 3. Activity over time

Three work bursts, not quarters. Window per burst and top areas by touches
(churn in parentheses):

### May 2026 (2026-05-24 – 05-25, 18 commits) — scaffold and foundation docs

| Area                   | Touches | Lines |
| ---------------------- | ------- | ----- |
| `<root>`               | 11      | 941   |
| `context/foundation/`  | 6       | 974   |
| `src/components/auth/` | 6       | 357   |
| `src/components/`      | 3       | 205   |
| `src/pages/auth/`      | 3       | 80    |
| `context/deployment/`  | 2       | 153   |

Character: shape → PRD → tech stack → bootstrap → infra → first deploy. All
`src/` activity is the Astro/Supabase starter arriving at once. No product
code yet.

### June 2026 (2026-06-03 – 06-04, 29 commits) — the product gets built

| Area                                         | Touches | Lines |
| -------------------------------------------- | ------- | ----- |
| `context/changes/quotes-data-foundation/`    | 14      | 627   |
| `context/changes/pricelist-seed-foundation/` | 14      | 561   |
| `context/changes/first-thin-quote-…-link/`   | 13      | 736   |
| `src/components/admin/`                      | 11      | 850   |
| `<root>`                                     | 8       | 332   |
| `src/lib/quote/`                             | 7       | 617   |
| `src/lib/pricing/`                           | 7       | 494   |
| `src/components/patient/`                    | 7       | 266   |

Character: three vertical slices back-to-back in two days — schema + RLS,
pricelist seed, then the first end-to-end quote and patient link. This is
where the domain (`src/lib/quote/`, `src/lib/pricing/`, `supabase/migrations/`)
came into existence.

### September 2026 (2026-09-04, 28 commits) — one slice, then quality

| Area                                | Touches | Lines |
| ----------------------------------- | ------- | ----- |
| `context/changes/admin-quote-list/` | 17      | 809   |
| `src/components/admin/`             | 11      | 679   |
| `context/foundation/`               | 7       | 421   |
| `<root>`                            | 7       | 355   |
| `src/pages/admin/`                  | 5       | 255   |
| `src/pages/api/`                    | 4       | 356   |
| `e2e/`                              | 4       | 248   |
| `src/lib/services/`                 | 2       | 256   |

Character: a single feature slice (`admin-quote-list`) plus the whole quality
apparatus — test plan, pre-commit hooks, CI unit tests, Playwright harness.
`e2e/` and `src/lib/services/` are both **new in this burst**.

**Shift of emphasis across the three bursts:** infrastructure (May) →
domain and data (June) → admin surface and test infrastructure (September).
The centre of gravity moves steadily _toward the admin editor_: `src/lib/`
was the June leader among code areas, `src/components/admin/` +
`src/pages/admin/` the September leader.

## 4. Co-change couplings

Directory buckets at depth 3, deduplicated per commit, bulk commits excluded.

### 4a. Directory pairs (all areas, support ≥ 3)

| Support | Pair                                                               |
| ------- | ------------------------------------------------------------------ |
| 4       | `src/components/admin/` + `src/pages/admin/`                       |
| 4       | `context/changes/pricelist-seed-foundation/` + `src/lib/pricing/`  |
| 4       | `context/changes/first-thin-quote-…-link/` + `src/lib/quote/`      |
| 4       | `context/changes/admin-quote-list/` + `src/components/admin/`      |
| 3       | `context/changes/quotes-data-foundation/` + `supabase/migrations/` |
| 3       | `context/changes/admin-quote-list/` + `src/pages/admin/`           |
| 3       | `<root>` + `src/`                                                  |

Four of the seven are **`context/changes/<slice>/` paired with the code area
that slice built**. That is the workflow, not an architectural smell: each
phase commit updates the slice's `plan.md` progress table alongside the code.
It is still useful signal — it tells you which plan document describes which
code region, and it is the cleanest available map from _feature_ to
_directory_.

### 4b. Code-only directory pairs (support ≥ 2)

| Support | Pair                                         |
| ------- | -------------------------------------------- |
| 4       | `src/components/admin/` + `src/pages/admin/` |
| 2       | `src/pages/admin/` + `src/pages/api/`        |
| 2       | `src/components/admin/` + `src/pages/api/`   |
| 2       | `src/components/admin/` + `src/lib/quote/`   |
| 2       | `src/` + `src/components/ui/`                |
| 2       | `scripts/` + `src/lib/pricing/`              |

**No code-only directory triple reaches support ≥ 2.** With 22 code commits
that is expected, and it is reported rather than papered over.

### 4c. File pairs and triples (code only, support ≥ 2)

Individual commit counts in parentheses, so confidence is readable.

| Support | Pair                                                                                          |
| ------- | --------------------------------------------------------------------------------------------- |
| 3       | `admin/QuoteEditor.tsx` (5) + `admin/types.ts` (3)                                            |
| 2       | `admin/types.ts` (3) + `pages/admin/quotes/[id].astro` (2)                                    |
| 2       | `admin/types.ts` (3) + `pages/admin/index.astro` (4)                                          |
| 2       | `admin/QuoteEditor.tsx` (5) + `pages/admin/index.astro` (4)                                   |
| 2       | `admin/QuoteEditor.tsx` (5) + `pages/admin/quotes/[id].astro` (2)                             |
| 2       | `admin/{QuoteEditor,ToothRow,VisitList,GeneralItems,ApprovalConfirmation}.tsx` — all pairwise |

Triples (support 2) are all drawn from the same set, e.g.
`QuoteEditor.tsx | types.ts | pages/admin/index.astro` and
`ToothRow.tsx | VisitList.tsx | types.ts`. There is effectively **one
tightly-bound cluster of six files** rather than several independent triples.

### Interpretation — top 3 couplings

**1. `src/components/admin/` ↔ `src/pages/admin/` (support 4, the strongest
in the repo).** The React editor island and the Astro pages that host it move
together every single time either moves. This is the load-bearing seam of the
application: an Astro page loads the quote, serialises a payload, and hands it
to a client island; the island owns all interaction. Any change to what the
editor needs forces a change to what the page passes it. Practical
consequence: **treat `src/components/admin/` + `src/pages/admin/` as one unit
when planning or reviewing.** A change that touches only one of them is
either trivial or incomplete — worth a second look in review.

**2. The `admin/` file cluster around `types.ts` (support 3 with
`QuoteEditor.tsx`, support 2 with four more files).** `src/components/admin/types.ts`
is the local contract for the editor island, and it co-changes with every
component in the folder plus both admin pages. It has only 3 commits, so it is
not churny — but it is the **hub of the densest cluster in the codebase**. It
is the file to read first when picking up any admin-editor work, and the file
whose change should trigger the widest blast-radius check. The cluster's shape
(one shared type file + five leaf components, all pairwise coupled) says the
editor was designed and revised as a whole, not incrementally.

**3. `src/components/admin/` ↔ `src/pages/api/` (support 2), extended by
`src/pages/api/admin/quotes/approve.ts` co-changing with 6 distinct areas
across 3 commits.** The editor and the API it posts to are coupled through an
untyped-at-runtime wire format. `approve.ts` (317 lines changed) sits at the
approval transaction — the point the project's own `context/foundation/test-plan.md`
names as risk #1 and #2 ("a quote frozen and sent carrying data the server
never checked"). **Git history independently confirms the risk map's top
concern**: the file that most often changes with the most distinct areas on
the code side is exactly the approval endpoint. That agreement between two
independently-derived signals is the strongest single finding in this scan.

Runner-up worth naming: `scripts/` ↔ `src/lib/pricing/` (support 2) —
`scripts/validate-pricing.ts` validates the seed data, so the validator and
the data it guards move together. A healthy coupling, not a problem.

## 5. The "common denominator" — is there a repo-wide file?

Measured as: for each file, how many **distinct depth-3 areas** appear
alongside it in the same commit (bulk commits excluded).

| Areas | Commits | File                                         |
| ----- | ------- | -------------------------------------------- |
| 11    | 6       | `package.json`                               |
| 8     | 5       | `context/changes/first-thin-quote-…/plan.md` |
| 7     | 8       | `context/changes/admin-quote-list/plan.md`   |
| 7     | 2       | `src/lib/pricing/index.ts`                   |
| 6     | 6       | `context/foundation/roadmap.md`              |
| 6     | 3       | `src/pages/api/admin/quotes/approve.ts`      |
| 5     | 4       | `src/components/admin/QuoteEditor.tsx`       |
| 5     | 3       | `src/types.ts`                               |
| 5     | 3       | `docs/reference/contract-surfaces.md`        |

**Answer: there is no i18n/translation file, and no generated file, acting as
a repo-wide denominator.** The project has no localisation layer, and the one
generated file that could have played that role — `src/db/database.types.ts` —
is filtered as noise and in any case has almost no history. Three weaker
candidates exist instead:

- **`package.json` (11 areas / 6 commits)** — the only true repo-wide file,
  and a boring one. It spans areas because every new capability (Vitest,
  Playwright, husky/lint-staged, the pricing validator script) adds a
  dependency or a script. Diagnostic value: low, but it is the reliable
  chronological index of _when each tool entered the project_.
- **`context/foundation/roadmap.md` (6 areas / 6 commits)** — the closest
  thing to a _semantic_ denominator. It changes with every slice close-out
  and with all four archive folders. If you want one file that tells you what
  the project thought it was doing at any point in history, this is it.
- **`docs/reference/contract-surfaces.md` (5 areas / 3 commits)** — spans
  `src/lib/pricing/`, `scripts/`, `supabase/tests/` and two slice folders. It
  is a deliberate cross-boundary contract registry, and it is behaving as
  designed.

**`CLAUDE.md` is explicitly NOT the denominator, despite topping §2a.** All
14 of its touches were checked: 11 are **solo commits** (only `CLAUDE.md` in
the commit), 9 of them named `10x get m<N>l<N>` — course-lesson ingestion,
not project work. Only 3 touches co-occur with anything (`ci: run unit tests
in the pipeline`, `chore(hooks): lint the edited file…`, and the initial
`CLAUDE.md.scaffold -> CLAUDE.md` rename). High churn, near-zero coupling.
Anyone ranking hot spots by raw touch count on this repo will be misled by it.

## 6. Files that no longer exist, or were renamed

Cross-checked every historically-touched path against `git ls-files`.

**20 paths appear in history but not in the working tree. All 20 are renames.
Zero are true deletions, and none of them are code.**

| Historical path                                                 | Now                                                              |
| --------------------------------------------------------------- | ---------------------------------------------------------------- |
| `context/changes/quotes-data-foundation/*` (4 files)            | `context/archive/2026-06-03-quotes-data-foundation/*`            |
| `context/changes/pricelist-seed-foundation/*` (4 files)         | `context/archive/2026-06-03-pricelist-seed-foundation/*`         |
| `context/changes/first-thin-quote-and-patient-link/*` (5 files) | `context/archive/2026-06-04-first-thin-quote-and-patient-link/*` |
| `context/changes/admin-quote-list/*` (5 files)                  | `context/archive/2026-09-04-admin-quote-list/*`                  |
| `pricing.json`, `pricing-narkoza.json`                          | `src/lib/pricing/data/pricing.json`, `…/pricing-narkoza.json`    |

Confirmed with `git log -M --numstat`, which reports all 20 in explicit rename
form (`context/{changes/X => archive/DATE-X}/plan.md`,
`pricing.json => src/lib/pricing/data/pricing.json`).

**Consequences for anyone building on this scan:**

1. **`context/changes/` and `context/archive/` are the same body of work.**
   Counted separately they read as 60 and 19 touches; they are one thing.
   §1 folds them together — do the same in any follow-up analysis, or the
   process-documentation weight will be understated by a quarter.
2. **`context/changes/` is currently empty of active slices.** Every slice
   ever planned has been archived. A naive "which folders are hot" query run
   against the current tree would find nothing there.
3. **The pricing JSON moved out of the repo root into `src/lib/pricing/data/`.**
   The root-level `pricing.json` / `pricing-narkoza.json` entries in raw
   history are the same seed data, not separate files.

**Every file named as strongly coupled in §4 still exists**, verified against
`git ls-files`:

`src/components/admin/QuoteEditor.tsx`, `src/components/admin/types.ts`,
`src/components/admin/ToothRow.tsx`, `src/components/admin/VisitList.tsx`,
`src/components/admin/GeneralItems.tsx`,
`src/components/admin/ApprovalConfirmation.tsx`,
`src/pages/admin/index.astro`, `src/pages/admin/quotes/[id].astro`,
`src/pages/api/admin/quotes/approve.ts`, `src/types.ts`,
`src/lib/pricing/index.ts`, `scripts/validate-pricing.ts`,
`docs/reference/contract-surfaces.md`.

No coupling conclusion in this document rests on a path that has been deleted
or moved.

## 7. Summary — where the project lives

- **The centre is the admin quote editor.** `src/components/admin/` +
  `src/pages/admin/` + `src/pages/api/admin/` carry the highest churn, the
  strongest coupling, and the newest work. Start there.
- **The domain core is stable.** `src/lib/quote/` and `src/lib/pricing/` were
  written in June and barely touched since; they are also the only areas with
  meaningful unit-test coverage.
- **The approval endpoint is the risk concentration**, agreed on independently
  by git churn/coupling and by `context/foundation/test-plan.md`'s risk map.
- **A third of all activity is process documentation.** Reading
  `context/archive/*/plan.md` is a legitimate and fast way to understand any
  code region — the co-change data maps each plan to its code directory.
- **Beware `CLAUDE.md` as a hot spot.** It is course bookkeeping, not project
  churn.
