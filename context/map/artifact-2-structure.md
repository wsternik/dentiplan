# Structural map — how this is built (dependency-cruiser)

> Artifact 2 of the code-map series. Produced by running the prompt series in
> `.claude/prompts/m4l2-2-structure-dependency-cruiser.md` against DentiPlan.
> Everything below is evidence-backed: every claim names the command that
> produced it, so a later reader can re-run it and argue with the reading.
>
> Scope: `src/` (75 files). Tool: dependency-cruiser 18.2.0.
>
> Last updated: 2026-09-04

## 0. What was adapted, and why

Two adaptations were forced on the source prompt series. Both change what the
artifact can claim, so they are stated first rather than buried.

**The prompt's target paths do not exist here.** The series was written for
the Mattermost monorepo and names `webapp`, `channels/src/components/admin_console`,
`channels/src/packages`, `channels/src/utils`, `channels/src/actions`,
`platform/client/src`, `platform/types/src`. DentiPlan is a single Astro
application with no monorepo split. Each target was mapped to its nearest real
counterpart:

| Prompt's target (Mattermost)            | DentiPlan equivalent used here                           | Note                                                                      |
| --------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------- |
| `webapp` (cruise root)                  | `src`                                                    | The whole app. `e2e/` cruised separately once, as a cross-check.          |
| `channels/src/components/admin_console` | `src/components/admin/` + `src/pages/admin/`             | The admin quote editor island and the routes that host it.                |
| `channels/src/actions`                  | `src/pages/api/`                                         | Server-side mutations live in API endpoints, not in a Redux action layer. |
| `channels/src/utils`                    | `src/lib/quote/`, `src/lib/pricing/`, `src/lib/utils.ts` | Pure helpers.                                                             |
| `channels/src/packages`                 | `src/lib/services/`                                      | Nearest analogue: extracted business logic with its own tests.            |
| `platform/client`                       | `src/lib/supabase.ts`                                    | The single data-access client.                                            |
| `platform/types`                        | `src/types.ts`, `src/db/database.types.ts`               | The type foundation.                                                      |

**`context/map/artifact-1-territory.md` does not exist.** The prompt series
assumes a preceding territory map (churn / hot-spot analysis) and asks each
table to cite it. That artifact has not been produced for this repo, and
`context/foundation/test-plan.md` §1 already records _why_ a churn scan would
be worthless here: the scoped git log holds 4 commits in the last 30 days,
below the 5-commit threshold, because the project paused between June and
September. So the "link to artifact-1" column is replaced throughout by a link
to the **Risk Map in `context/foundation/test-plan.md` §2**, which is this
project's real record of where change hurts. Where a structural finding has no
counterpart in that map, the cell says so rather than inventing one.

## 1. Tool setup

Installed as a devDependency and configured at the repo root:

```bash
npm install -D dependency-cruiser     # 18.2.0
npx depcruise --init oneshot          # generated .dependency-cruiser.cjs
```

Invocation:

```bash
npm run depcruise                     # = depcruise src --output-type err
npx depcruise src --output-type metrics
npx depcruise src --output-type json
npx depcruise src -T text -R '^src/lib/supabase\.ts$'   # --reaches
npx depcruise src -T text -F '^src/components/admin/QuoteEditor\.tsx$'  # --focus
```

Four edits were made to the generated config. Each is commented in the file:

1. **TypeScript path alias `@/*` → `./src/*`.** Already handled by the
   generated `options.tsConfig.fileName: 'tsconfig.json'` — dependency-cruiser
   reads `compilerOptions.paths` from there. Verified: every `@/...` edge in
   the JSON output carries `dependencyTypes: ["aliased", "aliased-tsconfig",
"aliased-tsconfig-paths", ...]` and resolves to a real file. **No aliased
   import is unresolvable.**
2. **`enhancedResolveOptions.extensions`** widened from `[".ts", ".tsx", ".d.ts"]`
   to include `.astro`, `.js`, `.jsx`, `.mjs`, `.json`.
3. **`extraExtensionsToScan: ['.astro', '.json']`** — see §2 below.
4. **`options.forbidden`** — the `astro:` virtual modules exempted from
   `not-to-unresolvable`, `.astro` exempted from `no-orphans`, and six
   DentiPlan-specific layer rules added (`lib-not-to-components`,
   `lib-not-to-pages`, `components-not-to-supabase`,
   `components-not-to-astro-env`, `db-types-are-a-leaf`,
   `no-cross-component-family-imports`).

## 2. What the graph cannot see — `.astro` is an `unknown`, not a zero

**This is the single most important caveat in the artifact, and the rest of the
reading depends on it.**

dependency-cruiser cannot parse Astro single-file components. There is no
`.astro` parser in the tool; the frontmatter block is never read. Two ways this
can present, and it matters which one you pick:

- **Leave `.astro` out of `extraExtensionsToScan` (the generated default).**
  The 21 `.astro` files are simply absent from the graph: 67 modules, 157
  dependencies. The Astro layer is silently missing, and nothing in the output
  tells you so.
- **Add `.astro` to `extraExtensionsToScan` (what this config does).** The 21
  files appear as **nodes with zero recorded dependencies and zero recorded
  dependents**: 90 modules, still 157 dependencies. Not one edge was added.

The second option was chosen deliberately, because it makes the blind spot
_visible in the output_ instead of invisible. But it introduces a lie of its
own, and the config comments say so: a `.astro` node showing 0 in / 0 out does
**not** mean the file has no dependencies. It means the tool never looked.
Read every `.astro` row in the metrics table as **`unknown`**.

How big is the hole? Counted by hand:

```bash
for f in $(find src -name '*.astro'); do grep -cE "^import .*from ['\"]" "$f"; done
# → 48 import edges across 21 files
```

**48 real edges — about 23% of the true graph (48 of 205) — are missing from
every number in this artifact.** The 21 orphan warnings that `.astro` produced
were suppressed in the config with an explicit comment, because not one of them
is a real orphan: `src/pages/index.astro` is the site's home page.

Hand-recovered, the missing layer looks like this (this is not
dependency-cruiser output; it is `grep`):

| `.astro` module                             | Imports (invisible to the tool)                                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/pages/p/[token].astro`                 | `@/layouts/Layout.astro`, `@/components/patient/PatientQuote.astro`, `@/components/patient/PatientError.astro`, **`@/lib/supabase`**, `@/types`, `zod` |
| `src/pages/admin/quotes/[id].astro`         | `Layout`, `@/components/admin/QuoteEditor`, `@/lib/pricing`, **`@/lib/supabase`**, `@/types`, `zod`                                                    |
| `src/pages/admin/index.astro`               | `Layout`, `@/components/admin/DeleteQuoteButton`, `@/components/ui/badge`, **`@/lib/supabase`**, `zod`                                                 |
| `src/pages/admin/quotes/new.astro`          | `Layout`, `@/components/admin/QuoteEditor`, `@/lib/pricing`                                                                                            |
| `src/components/patient/PatientQuote.astro` | `@/types`, `@/lib/quote/format`, + 4 sibling `.astro` components                                                                                       |
| `src/components/patient/*` (5 more)         | `@/types`, `@/lib/quote/tooth-name`, `@/lib/quote/format`, `@/lib/quote/labels`                                                                        |
| `src/layouts/Layout.astro`                  | `@/components/Banner.astro`, **`@/lib/config-status`**                                                                                                 |
| `src/pages/auth/*`, `dashboard`, `index`    | `Layout`, `@/components/auth/SignInForm`, `SignUpForm`, `Welcome.astro`                                                                                |

Two consequences that recur below:

- `src/lib/config-status.ts` shows as an **orphan** in the recorded graph. It
  is not. `Layout.astro` imports it, so it is on **every page render**.
- The entire **patient-facing rendering path** (`/p/<token>` → `PatientQuote`
  → 5 sub-components) is 100% `.astro` and therefore 100% invisible. That path
  carries test-plan risks #3 (patient sees admin-only data) and #4 (token
  probing). **dependency-cruiser cannot help you assess it at all.**

One thing the tool _does_ still see: the `astro:` virtual modules
(`astro:env/server`, `astro:middleware`). Those are compiler-injected and have
no on-disk counterpart, so they were exempted from `not-to-unresolvable` — but
they remain **edges** in the graph pointing at a node whose contents the tool
never sees. That is a useful signal, not a defect: an edge to
`astro:env/server` marks a module as server-only.

## 3. Cycles

**Key observations**

1. **There are zero dependency cycles in `src/`.** Not "few" — zero, across
   all 157 recorded edges. A clean result is a finding, and for a project with
   a 5-month gap in its history it is a notably good one.
2. The clean result was produced two independent ways — the `no-circular` rule
   and a direct scan of the JSON for `dependency.circular === true` — because a
   rule that silently fails to match would look identical to a clean repo.
3. The result is **conditional on §2**. 48 `.astro` edges were not examined. A
   cycle running through `.astro` files is structurally near-impossible in Astro
   (component composition is a tree, and pages are leaves nothing imports), but
   it has not been _proven_ absent, only reasoned absent.
4. The likeliest future cycle site is `src/lib/pricing/`, where `index.ts` is a
   barrel re-exporting `seed`, `resolver`, `picker-options` and `schema`. Barrels
   are the classic seed of a cycle: any sibling that imports `@/lib/pricing`
   instead of `./schema` closes a loop. Today no sibling does.
5. The one real rule violation found (§4) is a **type-only upward import**, not
   a cycle — TypeScript erases it at compile time, so it can never become a
   runtime loop. It is still a design smell.

| Area                                 | What I found                                                               | Evidence from dependency-cruiser                                                                                                                                                         | Why it matters when changing                                                                                           | Link to test-plan risk                                          | What to check next                                                                                                           |
| ------------------------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/` (whole app)                   | No cycles at all.                                                          | `npx depcruise src -T err` → `x 1 dependency violations (1 errors, 0 warnings). 90 modules, 157 dependencies cruised` — the one error is `lib-not-to-components`, no `no-circular` line. | You can change any module without a "fix one, break the importer that imports you back" loop. Refactors stay local.    | —                                                               | Re-run `npm run depcruise` on every PR; the `no-circular` rule is already in the config as `warn`.                           |
| `src/` (JSON cross-check)            | Zero edges carry `circular: true`.                                         | `depcruise src -T json` + `modules[].dependencies[].circular` filter → `circular dependency edges: 0`                                                                                    | Confirms the rule actually ran and matched nothing, rather than being misconfigured.                                   | —                                                               | Keep this cross-check in mind if the rule is ever edited.                                                                    |
| `src/components/admin/` (12 modules) | Deepest local subtree (`QuoteEditor` → 7 siblings → `ui/`), still acyclic. | `depcruise src -T text -F '^src/components/admin/QuoteEditor\.tsx$'` → 43 edges, strictly downward: `QuoteEditor` → siblings → `ui/` → `react`.                                          | The one place a cycle would be easy to introduce (siblings sharing state) is currently a clean tree.                   | test-plan #1 (approval path — "most layers, zero tests")        | If a sibling ever needs `QuoteEditor` state, pass it as a prop; do not import back up.                                       |
| `src/lib/pricing/`                   | Barrel `index.ts` re-exports 3 siblings; no sibling imports the barrel.    | `grep '^export' src/lib/pricing/index.ts`; `Ca=4, Ce=5, I=56%` in `-T metrics`                                                                                                           | A barrel with inward-facing siblings is the standard cycle seed. Today it is safe; one careless import changes that.   | —                                                               | Consider a rule forbidding `^src/lib/pricing/(?!index)` → `^src/lib/pricing$`.                                               |
| `.astro` layer (21 files, 48 edges)  | **Not examined.** Cycle-freedom is asserted for the TS/TSX graph only.     | 21 `.astro` nodes present, all with `Ca=0 Ce=0` in `-T metrics` — a parser artifact, see §2.                                                                                             | A structural claim that silently excludes a quarter of the graph is worth less than one that names its own blind spot. | test-plan #3, #4 (both live on the invisible `/p/<token>` path) | Nothing in dependency-cruiser can close this. `astro check` (already in the pre-commit gate) is the tool that sees `.astro`. |

## 4. Layer boundaries

The intended layering, written into the config as rules:

```
src/pages (Astro routes + API endpoints), src/middleware.ts
  → src/lib/services, src/lib/quote, src/lib/pricing
    → src/lib/supabase.ts, src/db/database.types.ts
src/components/**  →  src/lib/** (pure helpers only), src/types.ts
```

**Key observations**

1. **The layering holds, with exactly one violation.**
   `src/lib/pricing/picker-options.ts` imports `PickerOption` from
   `@/components/admin/types` — a `lib` module reaching **up** into the UI.
2. That violation is **type-only** (`dependencyTypes` includes `"type-only"`),
   so it costs nothing at runtime and cannot become a cycle. The cost is
   conceptual: `PickerOption` is a domain shape that has been parked in a UI
   folder, and `lib` now cannot be reasoned about without opening
   `src/components/`. The honest fix is to move `PickerOption` into
   `src/types.ts` or `src/lib/pricing/schema.ts` and let the component import
   downward.
3. **No React island touches Supabase.** `components-not-to-supabase` and
   `components-not-to-astro-env` both pass with zero violations. Data access is
   confined to the server side — which is exactly what makes the islands
   unit-testable (§6).
4. **`src/db/` is a clean leaf** (`Ca=1, Ce=0`): only `src/types.ts` imports it,
   and it imports nothing. The generated Supabase types sit at the bottom of the
   graph, where they belong.
5. **The `pages → lib → supabase` chain is only two-thirds verifiable.**
   `--reaches` finds 7 modules reaching `src/lib/supabase.ts` — but three
   `.astro` routes (`admin/index`, `admin/quotes/[id]`, `p/[token]`) import
   `createClient` directly and are invisible. The real count is **10, not 7**,
   and the three missing ones include the patient route.

| Boundary checked                                        | Result                                                                         | Evidence from dependency-cruiser                                                                                                                                             | Why it matters when changing                                                                                                               | Link to test-plan risk                                     | What to check next                                                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `src/lib/**` must not import `src/components/**`        | **VIOLATED** (1×, type-only)                                                   | `error lib-not-to-components: src/lib/pricing/picker-options.ts → src/components/admin/types.ts`; JSON shows `dependencyTypes: [..., "type-only", "import"]`                 | Anyone changing the admin editor's props can silently break the pricing layer's public API. The dependency direction lies about ownership. | test-plan #1 (approval path)                               | Move `PickerOption` down to `src/types.ts` / `src/lib/pricing/schema.ts`, then delete this exception.    |
| `src/lib/**` must not import `src/pages/**`             | **Holds**                                                                      | `lib-not-to-pages` rule, 0 violations in `npm run depcruise`                                                                                                                 | Routes stay the entry points. Nothing below can drag a route (and its request handling) into a unit test.                                  | —                                                          | Keep as `error`.                                                                                         |
| `src/components/**` must not import the Supabase client | **Holds**                                                                      | `components-not-to-supabase` rule, 0 violations; `depcruise src -T text -R '^src/lib/supabase\.ts$'` returns no `src/components/` row                                        | Islands can be rendered and tested with no DB, no env, no network. This is the property that makes unit testing the editor feasible.       | test-plan #1                                               | Keep as `error`; it is cheap and it protects the one thing that keeps the UI testable.                   |
| `src/components/**` must not read `astro:env/server`    | **Holds**                                                                      | `components-not-to-astro-env` rule, 0 violations                                                                                                                             | A server secret imported into a client island would be a real leak, not just a layering smell.                                             | test-plan #3 (patient must not see admin-side data)        | Keep as `error`.                                                                                         |
| `src/db/**` is a leaf                                   | **Holds**                                                                      | `db-types-are-a-leaf` rule, 0 violations; `-T metrics` → `src/db/database.types.ts  Ca=1 Ce=0 I=0%`                                                                          | Regenerating types from the Supabase schema can never pull application code with it.                                                       | —                                                          | Re-run after every `supabase gen types`.                                                                 |
| No cross-family component imports (admin/auth/patient)  | **Holds** for the TSX families; **unverifiable** for `patient/` (all `.astro`) | `no-cross-component-family-imports` (regex group `$1`), 0 warnings. But `src/components/patient/` shows `Ca=0 Ce=0` — see §2.                                                | Shared UI belongs in `ui/`. A patient component reaching into `admin/` would be the exact shape of test-plan risk #3.                      | test-plan #3                                               | Verify `patient/` by hand or with `astro check`; dependency-cruiser will never see it.                   |
| `pages/API → lib → supabase` chain                      | **Holds for the 7 visible callers; 3 more are invisible**                      | `-R '^src/lib/supabase\.ts$'` → `middleware.ts`, 3× `api/admin/quotes/*`, 3× `api/auth/*`. Hand-grep adds `admin/index.astro`, `admin/quotes/[id].astro`, `p/[token].astro`. | If you change `createClient`'s signature, `--reaches` under-reports the blast radius by 30% — and omits the patient route.                 | test-plan #2, #4 (both centred on `/p/<token>`)            | Always pair `--reaches` on `src/lib/supabase.ts` with `grep -rl "@/lib/supabase" src --include=*.astro`. |
| `e2e/` does not reach into `src/` internals             | **Holds**                                                                      | `npx depcruise e2e -T err` → `✔ no dependency violations found (6 modules, 7 dependencies cruised)`                                                                          | The e2e suite tests the app through the browser, not through imports — so it stays honest about what it covers.                            | test-plan #3, #4 (covered by `e2e/patient-link-*.spec.ts`) | Nothing; this is the desired shape.                                                                      |

## 5. Entry points, thin entries vs deep hubs

Read from `npx depcruise src --output-type metrics`. `Ca` = afferent coupling
(fan-in, how many modules depend on this), `Ce` = efferent coupling (fan-out,
how many this depends on), `I` = instability = `Ce / (Ca + Ce)`. `I = 100%`
means nothing depends on it — an entry point. `I = 0%` means it depends on
nothing — a leaf.

**Key observations**

1. **`src/types.ts` is the one true hub of this codebase**: `Ca=15, Ce=2,
I=12%`. Fifteen modules import it; it imports only `zod` and
   `src/db/database.types.ts`. `--reaches` returns 51 lines — the largest blast
   radius of any module in the repo. This is a healthy shape (stable, depended
   upon, depends on almost nothing), but it means a change to a domain type is
   never a local change.
2. **The three real leaf utilities are `src/lib/utils.ts` (`Ca=7`),
   `src/components/ui/button.tsx` (`Ca=8`) and `src/lib/supabase.ts`
   (`Ca=7`).** The first two are cheap to depend on. The third is not — see §6.
3. **The API endpoints are the thinnest, cleanest entries in the repo.** All six
   sit at `I=100%` with `Ce` between 2 and 7. `approve.ts` (`Ce=7`) is the
   deepest and is also the one the test plan calls out as the highest-risk path.
4. **`QuoteEditor.tsx` is the deep local hub**: `Ce=16, Ca=0, I=100%`. It is an
   entry point (nothing in the TS graph imports it — only two `.astro` pages,
   invisibly) that pulls in 16 modules. It is where the graph is densest.
5. **Every `.astro` file reports `Ca=0 Ce=0 I=0%`, and every one of those rows
   is wrong.** The metrics table cannot distinguish "leaf" from "unparsed".
   `src/pages/index.astro` and `src/db/database.types.ts` look identical in it.

| Module / folder                                 | Ca (fan-in) | Ce (fan-out) | I    | Shape                         | Why it matters when changing                                                                                                         | What to check next                                                                                   |
| ----------------------------------------------- | ----------- | ------------ | ---- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `src/types.ts`                                  | 15          | 2            | 12%  | **Central hub**               | Widest blast radius in the repo (`-R '^src/types\.ts$'` → 51 lines). Every domain-shape change is a repo-wide change.                | Before editing a schema here, run `-R` and read the list. `astro check` at commit is the real gate.  |
| `src/components/ui/button.tsx`                  | 8           | 4            | 33%  | Shared leaf                   | Purely presentational; safe to depend on. High fan-in is expected for a design-system primitive.                                     | —                                                                                                    |
| `src/lib/supabase.ts`                           | 7           | 3            | 30%  | **Data-access chokepoint**    | 7 visible + 3 invisible `.astro` callers. Its `Ce=3` includes `astro:env/server`, so importing it drags server-only env in.          | See §6, risk R1.                                                                                     |
| `src/lib/utils.ts`                              | 7           | 2            | 22%  | Thin leaf (`cn()`)            | Trivial. High fan-in, no risk.                                                                                                       | —                                                                                                    |
| `src/components/admin/types.ts`                 | 5           | 1            | 17%  | Local hub, **misplaced**      | Five modules depend on it, one of them from `src/lib` (§4). A UI-folder file has become part of the domain contract.                 | Move `PickerOption` down; the rest can stay.                                                         |
| `src/lib/pricing/index.ts`                      | 4           | 5            | 56%  | Barrel                        | The public face of the pricing layer. Balanced instability; the barrel is the thing to watch (§3, obs. 4).                           | Forbid sibling-imports-barrel if the folder grows.                                                   |
| `src/lib/services/quote-payload.ts`             | 4           | 4            | 50%  | Service, well-placed          | Imported by all 3 admin API endpoints + its own test. The validation seam for test-plan risk #1.                                     | Already has `quote-payload.test.ts`. Keep it that way.                                               |
| `src/components/admin/QuoteEditor.tsx`          | 0           | **16**       | 100% | **Deep entry / local hub**    | The densest node in the graph. Pulls 7 admin siblings, 4 `ui/` primitives, `lib/quote/cost`, `lib/quote/tooth-name`, `types`, react. | `-F '^src/components/admin/QuoteEditor\.tsx$'` → 43 edges. See §6, risk R3.                          |
| `src/pages/api/admin/quotes/approve.ts`         | 0           | 7            | 100% | Deepest API entry             | The approval/freeze path: supabase + cost engine + token generator + payload service + types + zod. Highest-risk route in the app.   | test-plan risk #1 and #2 both land here. See §6, risk R2.                                            |
| `src/pages/api/admin/quotes/{index,[id]}.ts`    | 0           | 4            | 100% | Thin entries                  | Each is a thin shell over `quote-payload` + `supabase`. Good shape: logic is one layer down and independently tested.                | —                                                                                                    |
| `src/pages/api/auth/{signin,signout,signup}.ts` | 0           | 2            | 100% | Thinnest entries              | `supabase` + `zod` only. Nothing to unit-test; behaviour is entirely in Supabase.                                                    | Integration or e2e is the honest level here.                                                         |
| `src/middleware.ts`                             | 0           | 2            | 100% | Entry (runs on every request) | Only `astro:middleware` + `supabase`. Small fan-out, but it is on the path of literally every request including `/p/<token>`.        | test-plan risk #6. Covered by e2e, not by units.                                                     |
| `src/lib/quote/token.ts`                        | 1           | 0            | 0%   | **Ideal leaf**                | Zero imports; uses only Web Crypto globals. Directly testable with no setup at all.                                                  | test-plan risk #4 (token guessability). Currently has no test — the cheapest one in the repo to add. |
| `src/db/database.types.ts`                      | 1           | 0            | 0%   | Generated leaf                | Regenerable; nothing to reason about.                                                                                                | —                                                                                                    |
| `src/lib/config-status.ts`                      | **0**       | 1            | 100% | **Metric is wrong**           | Reported as an orphan. `Layout.astro` imports it, so it runs on every page render and reads `astro:env/server`.                      | Treat the reported `Ca=0` as `unknown`. See §2.                                                      |
| All 21 `.astro` modules                         | **0**       | **0**        | 0%   | **`unknown`**                 | The metrics table cannot tell "leaf" from "unparsed". `src/pages/index.astro` looks like a leaf; it is the home page.                | See §2. Nothing in dependency-cruiser closes this.                                                   |

## 6. Testability risks

### Summary

The graph is unusually kind to testing, and the reason is structural rather
than accidental: **the modules that carry business logic import almost nothing,
and the modules that import a lot carry almost no logic.** `src/lib/quote/`
(cost engine, formatting, tooth names, token) depends only on `src/types.ts`
and, in one case, on nothing at all. That is why 23 unit tests already exist
there with no mocking infrastructure whatsoever, and why they are cheap.

The expensive modules are the six API endpoints and `src/middleware.ts`. All of
them import `src/lib/supabase.ts`, which in turn imports `astro:env/server` — a
virtual module that only exists inside the Astro/Cloudflare build. **A unit test
cannot import any of these without stubbing a module the tool itself cannot
resolve.** That is not a mocking inconvenience; it is a hard boundary, and it is
the reason the existing suite tests `quote-payload.ts` (pure) rather than the
endpoints that call it (not pure).

The third area — the entire patient-facing render path — is invisible to this
analysis (§2) _and_ untestable by unit test, because `.astro` components render
only inside the Astro pipeline. For that path, e2e is not a fallback. It is the
only level that exists, which is exactly what `e2e/patient-link-content.spec.ts`
and `e2e/patient-link-probe.spec.ts` already do.

### Test risk list

| #   | Risk                                                                                                                                         | Evidence                                                                                                          | Honest test level                                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **`src/lib/supabase.ts` drags `astro:env/server` in.** Anything importing it needs a virtual module stubbed before the import even resolves. | `src/lib/supabase.ts → astro:env/server` (unresolvable edge, exempted in config); `Ca=7` visible + 3 `.astro`     | Integration (real local Supabase via `npx supabase start`) or e2e. Not unit.                                                                              |
| R2  | **`approve.ts` is the deepest endpoint and has no test.** It composes cost computation, token generation, payload validation and a DB write. | `Ce=7`; `-T metrics`. Its four `src/lib/*` dependencies are individually tested; their composition is not.        | Integration for the freeze/snapshot behaviour; e2e for the link handed to the patient. Unit-testing it needs R1 mocked.                                   |
| R3  | **`QuoteEditor.tsx` pulls 16 modules.** Rendering it in isolation means mounting 7 siblings and 4 primitives.                                | `-F '^src/components/admin/QuoteEditor\.tsx$'` → 43 edges                                                         | Component test is possible (no Supabase, no env — see §4) but expensive. Prefer testing `computeQuoteTotals` directly; use e2e for the editor as a whole. |
| R4  | **`src/middleware.ts` runs on every request and imports both `astro:middleware` and `supabase`.** Nothing about it is unit-testable.         | `Ce=2`, both edges cross the Astro/Cloudflare boundary                                                            | e2e only. (test-plan risk #6.)                                                                                                                            |
| R5  | **The whole `/p/<token>` render path is `.astro`.** 7 modules, 0 recorded edges, 0 unit-testability.                                         | §2; `src/components/patient/` folder shows `Ca=0 Ce=0`                                                            | e2e is the only level. Already covered by `e2e/patient-link-content.spec.ts` (test-plan #3) and `patient-link-probe.spec.ts` (#4).                        |
| R6  | **`src/lib/config-status.ts` reads env at module load and runs on every page render**, via a `Layout.astro` import the tool cannot see.      | `import { SUPABASE_URL, SUPABASE_KEY } from "astro:env/server"` at top level; module-level `configStatuses` const | Not worth a unit test; its failure mode is a visible banner. Note it exists so nobody "cleans up the orphan".                                             |
| R7  | **`src/types.ts` is a single point of change for 15 modules.** A schema edit here can break a module no test covers.                         | `Ca=15`; `-R '^src/types\.ts$'` → 51 lines                                                                        | Not a test risk so much as a typecheck risk — `astro check` in the pre-commit gate is the right instrument, and it already runs.                          |
| R8  | **`src/lib/quote/token.ts` has zero imports and zero tests.** It is the cheapest possible unit test in the repo and it is missing.           | `Ca=1 Ce=0 I=0%`; no `token.test.ts` in `src/lib/quote/`                                                          | Unit. Directly addresses test-plan risk #4 (token guessability) at the lowest possible cost.                                                              |

### Most suspect modules

Ranked by cost-to-test-in-isolation, highest first:

1. `src/middleware.ts` — two edges, both across the runtime boundary. Untestable below e2e.
2. `src/pages/api/admin/quotes/approve.ts` — `Ce=7`, highest-risk logic, no test.
3. `src/pages/p/[token].astro` + `src/components/patient/**` — invisible and un-unit-testable; the app's most privacy-sensitive path.
4. `src/components/admin/QuoteEditor.tsx` — `Ce=16`; testable in principle, costly in practice.
5. `src/lib/supabase.ts` — the chokepoint that makes 10 other modules expensive.

And the reassuring end of the same list — modules that are cheap to test and
already are: `src/lib/quote/cost.ts` (`Ce=2`), `src/lib/quote/format.ts`
(`Ce=1`), `src/lib/services/quote-payload.ts` (`Ce=4`, all of it pure).

### What to check next

- **Add `src/lib/quote/token.test.ts`.** Zero-dependency module, no setup,
  directly answers test-plan risk #4. The single highest value-per-minute item
  on this list.
- **Move `PickerOption` out of `src/components/admin/types.ts`** and delete the
  one layering violation, so `npm run depcruise` goes green and stays a useful
  signal rather than a known-failing check.
- **Do not add `npm run depcruise` to CI yet** — it currently exits non-zero on
  that one violation. Fix the violation first, then wire it into
  `.github/workflows/ci.yml` next to `lint`.
- **Never trust `--reaches` alone on this repo.** Pair every reach query with
  `grep -rl "<module>" src --include='*.astro'`.
- **The `.astro` blind spot is permanent for this tool.** The instrument that
  does see it — `astro check` — already runs at the commit gate. That is the
  right division of labour; this artifact does not recommend adding another tool.

### Optional next step: graph

Deliberately skipped. Graphviz/DOT and SVG rendering were dropped from this run,
per the prompt's own note that the render step is optional and only worth doing
after selection. With 90 nodes, zero cycles and one violation, a rendered graph
would add nothing that §5's metrics table does not already say — and it would
render the 21 `.astro` files as free-floating dots, which is precisely the
misleading picture §2 exists to prevent.

If a graph is ever wanted, the one subgraph worth rendering is the admin editor:

```bash
npx depcruise src -T dot -F '^src/components/admin/QuoteEditor\.tsx$' | dot -T svg > editor.svg
```

It answers one question — "what does the deepest node in the repo actually
pull in" — and it is the only place in the codebase dense enough for a picture
to beat a list.
