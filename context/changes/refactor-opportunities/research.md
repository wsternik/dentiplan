---
date: 2026-09-04T18:10:00+0200
researcher: Wojciech Sternik
git_commit: 4ddf54d
branch: main
repository: dentiplan
topic: "Refactor opportunities — which recorded problems to fix, and in what order"
tags: [research, refactor, ranking, exploration]
status: complete
last_updated: 2026-09-04
last_updated_by: Wojciech Sternik
---

# Refactor opportunities

> **Exploration only.** No refactor happened here and no decision is taken here.
> The decision belongs to the planning session that reads this report.
>
> Input: `context/archive/2026-09-04-quote-approval-flow-analysis/research.md` (technical
> debt D1–D8) and `context/map/repo-map.md` (risk zones, the one layer
> violation). Their findings are treated as collected evidence and built on, not
> re-derived.
>
> Three read-only lenses were applied to every candidate: **current shape**,
> **history and intentionality**, **migration feasibility**. Claims are labelled
> `evidence` / `inference` / `unknown`.

## 1. Every recorded problem, classified

The prior analysis records fourteen distinct problems. A **CANDIDATE** is one
whose fix would change the structure of the code. Everything else is kept as
input to feasibility and cost — a missing test is a real problem, but it is not
a refactor.

| #      | Problem                                                                                                                     | Source        | Classification                                                                                                                   |
| ------ | --------------------------------------------------------------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **C1** | Approval wire format duplicated between island and server; no gate spans the seam                                           | D1            | **CANDIDATE**                                                                                                                    |
| **C2** | `PickerOption` declared in a UI folder and imported upward by `src/lib/pricing` — the one `lib-not-to-components` violation | map §4        | **CANDIDATE**                                                                                                                    |
| **C3** | Quote-status enum declared three times, one of them a local re-declaration in a page                                        | D1            | **CANDIDATE**                                                                                                                    |
| **C4** | `jsonError` helper copy-pasted into three endpoints                                                                         | D1            | **CANDIDATE**                                                                                                                    |
| **C5** | Generated DB layer inert; Supabase client created without the `Database` generic                                            | D5            | **CANDIDATE**                                                                                                                    |
| **C6** | `VisitSchema.label` unbounded while the adjacent tooth `note` is capped at 500                                              | D6            | **CANDIDATE**                                                                                                                    |
| —      | `approve.ts` has 11 of 14 branches untested                                                                                 | D2            | not a candidate — **missing tests**. Feasibility input, and the dominant one: it is the safety net every candidate would lean on |
| —      | Two e2e assertions weaker than they look                                                                                    | D3            | not a candidate — **test quality**. Feasibility input                                                                            |
| —      | dependency-cruiser cannot see `.astro` (~23% of edges missing)                                                              | D4            | not a candidate — **tool limitation**. Corrects every blast-radius number below                                                  |
| —      | Immutability makes any shipped bug permanent                                                                                | D7            | not a candidate — a **product property**, deliberate (FR-053). The single most important cost multiplier                         |
| —      | CI runs no migrations; schema changes have no gate                                                                          | D8            | not a candidate — **process**. Bounds what C5 can safely do                                                                      |
| —      | Five hand-copied auth preambles; `PROTECTED_ROUTES` misses `/api/admin`                                                     | D2, ACL §3    | **deferred** — the fix is the `OperatorIdentity` port in `context/domain/03-anti-corruption-layer.md` A2, out of scope here      |
| —      | Invariant I-1 enforced by coordination across four layers                                                                   | domain 02     | **deferred** — the target shape is the aggregate plan; too large for this change                                                 |
| —      | `Dentition` is a bare type alias, never validated                                                                           | domain 01 D-6 | not a candidate — defensible; it is always derived, never transmitted                                                            |

Two candidates were considered and set aside as **business-concept questions,
not code structure**, per the exploration contract: the absent pricelist-snapshot
concept (D-2) and the "revoked token" vocabulary with no referent (D-3). Both
need a product decision before any code shape follows. They are recorded in
`context/domain/01-domain-distillation.md` §4 and stop here.

## 2. Per-candidate findings

### C1 — Duplicated approval wire format

**Current shape.** Producer: `QuoteEditor.tsx:181-196`, an object literal with no
return type. Consumer: `QuotePayloadSchema` (`quote-payload.ts:61-66`). Of the
keys crossing the wire only **two** are transformed — `pricelistItems` →
`pricelistItemIds` (`:190`) and `item` → `itemId` (`:194`); the rest are
pass-through, and `visits` already crosses as the domain `VisitSchema` itself.
`QuotePayload` is **already exported** (`quote-payload.ts:68`) and has **zero
importers**. `evidence`

**Intentionality — deliberate, but only half of it.** `context/archive/2026-06-04-first-thin-quote-and-patient-link/plan.md:152`
forbids the island importing `@/lib/pricing` "so the client doesn't re-import the
seed bundle", and `quote-payload.ts` does import `resolvePricelistItem`. So a
_runtime_ import was consciously refused. **No document anywhere considers a
type-only import**, which carries none of that cost. `evidence` for the
constraint; `unknown` whether the type-only option was ever weighed.

**And the stated reason no longer holds.** The built client bundle was inspected:
`dist/client/_astro/QuoteEditor.*.js` already contains `ZodError` **and the
pricing seed data** (`leczenie-zachowawcze`, `baseMilk`), pulled in transitively
via `cost.ts:14 → @/lib/pricing`. The comment at `QuoteEditor.tsx:32-36` is
stale: the bundle it was protecting is already shipped. `evidence` — this is the
most consequential single finding in the exploration.

**Feasibility.** The safety net is one e2e spec not in CI. `quote-payload.test.ts`
builds its own literals and stays green under any producer rename. The
prerequisite is real: `treePayload()` lives inside a `.tsx` component and vitest
here is `environment: "node"` with `include: src/**/*.test.ts`, so it cannot be
tested where it sits. **Two phases** — extract and pin, then annotate. `evidence`

**Current → target.** Untyped literal → `treePayload(): QuotePayload`, with the
type imported from the module that owns it. `astro check` then fails on any
divergence.

### C2 — `PickerOption` parked in a UI folder

**Current shape.** Declared `src/components/admin/types.ts:13`; used by five
files, four of them islands, plus the upward `import type` at
`picker-options.ts:16`. `PickerOptions` (the plural container) has **zero named
consumers** — both pages destructure it. depcruise confirms exactly one violation
repo-wide. `evidence`

**Intentionality — accidental.** The component type predates the lib module by
three months (`db9208e` vs `d8e1c0f`), and `git log -L` shows the option-building
logic was cut out of the page and carried its type reference along with it.
Nobody chose the direction; it was inherited by a move. First noticed by
dependency-cruiser in September. `evidence`

**Feasibility.** No test imports it; `PickerOption` is an `interface`, erased at
build, so a pure type move **cannot change runtime behaviour**. The verifier is
the compiler. Blast radius 5 files, and this is the one candidate where
depcruise is **not** under-reporting — no `.astro` file imports the module.
Fully reversible, single commit, no persisted data. `evidence`

**Current → target.** Move the declaration to
`src/lib/pricing/picker-options.ts`, beside the `PickerOptions` interface that
already owns it and that `lib/pricing/index.ts:17` already re-exports;
`admin/types.ts` imports it back _down_. Components → lib, the allowed direction.

### C3 — Quote-status enum declared three times

**Current shape.** `src/types.ts:26`, `src/pages/admin/index.astro:34`, and the
migration's CHECK. The two TypeScript declarations are byte-identical. `evidence`

**Intentionality — accidental drift, not a decision.** The Zod row funnel in
`admin/index.astro` is deliberate and commented (`:26-28`); the inline enum is
not. The sibling page `admin/quotes/[id].astro` was written **one commit later in
the same slice** with the same idiom and imports `QuoteStatusSchema` properly
(`:17`). The two files' comment blocks are near-verbatim copies. No review
mentions the difference. `evidence`; `unknown` as to intent, because no document
records one.

**Feasibility.** One file, one import line. `seed.spec.ts:49-51` genuinely fails
if the row schema breaks — and it is the one spec that cleans up after itself, so
it is safe to run. The precedent is the sibling page. `evidence`

### C4 — `jsonError` copy-pasted three times

**Current shape.** Three **byte-identical** bodies (same md5), 25 call sites, and
five message/status pairs repeated verbatim across files. Success envelopes
genuinely differ (`{token,path}` / `{id}` / bare 204), so only the error half is
shared. The auth endpoints are redirect-based and would not consume it.
`evidence`

**Intentionality — accidental.** Single-source in June, when there was one
endpoint; copied twice in `734e2c9` when the draft endpoints were added. Zero
mentions in any plan, review, or `contract-surfaces.md`. `evidence`; **why** it
was never shared: `unknown`.

**Feasibility.** The safety net is **literally zero** — no test asserts any error
status or body from these endpoints, and all eleven untested `approve.ts`
branches exit through this helper. That inverts the usual reading: the extraction
is trivial, but it currently has nothing verifying it. The mitigation is cheap
and is the first step: the extracted helper has no `astro:env` import, so unlike
its call sites it **is** reachable by vitest. `evidence`

**Current → target.** `src/lib/http.ts` with its own unit test — the first
endpoint-adjacent code in this repo that vitest can reach.

### C5 — Inert generated types, untyped client

**Current shape.** One importer; `Quote`, `PatientView` and the `Database`
re-export have zero consumers; the four insert/update literals are checked
against nothing. `evidence`

**Intentionality — an inversion worth recording.** The generated layer is not
inert because anyone abandoned it. F-01 **declared** `Quote`/`PatientView` as
"the row-level shape every later slice imports", and a reviewer (F3, `656030b`)
actively rewired `PatientView` onto the generated RPC type "so it tracks the
migration mechanically". Then every consuming slice quietly wrote its own ad-hoc
Zod row schema instead — each citing the untyped client as the reason. **The
contract was declared and then never picked up.** `evidence`

The `Database` generic was never present: `src/lib/supabase.ts` has one commit
(`f894a85`, the bootstrapper scaffold) predating `database.types.ts` by ten days.
Whether typing was ever considered: `unknown`. `evidence`

**Feasibility — the blocker is not the code.** A spike this session
(`tsc --strict`, exit 0) established that `QuoteContent` **is** assignable to
`Json` and the approve INSERT literal **is** assignable to the generated `Insert`
type, so shape is not the obstacle. The obstacle is that the prerequisite —
regenerate `database.types.ts` and diff it — **requires database access**, the
types were generated in June against a schema nobody has since verified (D8, open
question 1), and the branch the generic most endangers has zero coverage.
Multi-phase. `evidence`

**A correction earned here.** The prior research implied the checked-in types
were stale because the migration was edited later without regeneration. Both the
shape and intentionality lenses checked `656030b` independently: it added CHECK
constraints and a `search_path` setting, **neither of which changes generated
TypeScript**. The types are not stale. The finding — no regeneration gate, no
consumer — stands without that instance, and `research.md` has been corrected.

### C6 — `VisitSchema.label` unbounded

**Current shape.** `src/types.ts:118-121`, `label: z.string().default("")`, no
bound. The risk is **real, not theoretical**: `VisitList.tsx:26-33` is a plain
`<Input>` bound to `visit.label` with no `maxLength`, no trim and no validation;
the value flows verbatim through `QuoteEditor.tsx:193` to the patient at
`VariantComparison.astro:21`. `visits` is the one payload member with **no
wire-mirror schema** — teeth and general items each got one, and that is where
the 500-char `note` bound lives, so there was never a natural place for this
bound to be added. `evidence`

**Intentionality — an accidental miss with a documented precedent.** The 500-char
cap on `note` came from S-01 impl-review finding F2, fixed in `9e31fdb`. F2's own
rationale — "unbounded free text the dentist could paste PII into, frozen
immutably" — applies verbatim to `label`, which was already user-writable and
already patient-visible at review time. The same reviewer looked at this area and
did not cap it. No document anywhere considers bounding it. `evidence`

**Feasibility — this candidate splits in two, and the split is the whole point.**

- **Write side** (a `VisitInputSchema` in `quote-payload.ts`, mirroring how
  `note` is handled): one phase, verified by two new unit assertions, touches no
  stored data.
- **Read side** (adding `.max()` in `types.ts`): **categorically different.**
  `VisitSchema` sits inside `QuoteContentSchema`, which `p/[token].astro:36` and
  `admin/quotes/[id].astro:33` use to parse **already-stored, immutable rows**. A
  bound there silently 404s any approved quote whose label exceeds it — on a
  patient-visible link that can never be repaired (D7). No gate would catch it;
  the failure mode is FR-060's deliberately indistinguishable error page.
  `evidence` + `inference`, high confidence.

## 3. Cross-cutting: what the gates can actually prove

Measured, not assumed. `evidence`

**A correction to a common assumption:** `npm test` + `npm run build` +
`npm run depcruise` **do not typecheck**. `astro build` transpiles; `astro check`
is a separate command that runs at pre-commit and is **absent from `ci.yml`**.
For the type-level candidates the real verifier is `astro check`.

**Two blockers measured at HEAD, both now resolved or claimed:**

1. `npm run lint` was **red** on `.dependency-cruiser.cjs` — introduced by the
   M4L2 map work and invisible to the pre-commit hook, which lints only staged
   `*.{ts,tsx,astro}`. Fixed in `4ddf54d` before this report was written.
2. `npm run depcruise` is **red** by exactly one violation — C2's. So C2 is not
   merely the safest candidate; **it is the one that turns depcruise from a
   broken command into a usable gate for all the others.**

| Candidate     | Verified by                                                                      | One phase? | Touches persisted data? |
| ------------- | -------------------------------------------------------------------------------- | ---------- | ----------------------- |
| C1            | `astro check` (after the type is applied) + `npm test` (after extraction)        | No — two   | No                      |
| **C2**        | **`npm run depcruise` (1 error → 0)** + `astro check` + build                    | **Yes**    | No                      |
| C3            | `astro check` + build; `seed.spec.ts` as a behavioural net                       | **Yes**    | No                      |
| C4            | `astro check` + build, **plus `npm test` if the helper ships with its own test** | **Yes**    | No                      |
| C5            | Nothing local — needs the database                                               | No         | No, but schema-coupled  |
| C6 write side | `npm test`                                                                       | **Yes**    | No                      |
| C6 read side  | **No gate would catch a failure**                                                | No         | **YES — the only one**  |

## 4. Refactor opportunities (ranked)

A proposal for a separate planning session, not a decision.

### ⭐ #1 — C2: move `PickerOption` into the pricing layer

- **Current → target.** `interface PickerOption` moves from
  `src/components/admin/types.ts:13` to `src/lib/pricing/picker-options.ts`,
  beside the `PickerOptions` it already belongs to; `admin/types.ts` imports it
  back downward.
- **Why first.** It is the only candidate that **pays for the others**. Today
  `npm run depcruise` exits non-zero on this single violation, so the layer rules
  written during M4L2 cannot be a gate. Fix this one and the command goes green,
  at which point it can join CI and start defending every boundary in the repo —
  including the ones the ACL plan depends on. Cost of the debt is small; cost of
  the change is near-zero; the leverage is entirely in what it unblocks.
- **Blast radius.** 5 files, all TypeScript, no `.astro` — the one candidate
  where depcruise is not under-reporting. Type-only, erased at build, so no
  runtime behaviour can change.
- **Incremental path.** Single commit: move the declaration, update five imports,
  confirm `npm run depcruise` reports 0 violations, `astro check` clean.
- **First prerequisite.** None beyond choosing the destination. The compiler is
  the test.

### #2 — C4: extract `jsonError` into `src/lib/http.ts` with a test

- **Current → target.** Three byte-identical copies → one module with its own
  unit test.
- **Why here.** Modest structural value on its own, but it is the **first
  endpoint-adjacent code this repo can unit-test at all** — the helper has no
  `astro:env/server` import, so unlike its call sites vitest can reach it. It is
  a first, cheap crack in the wall that D2's untestability describes.
- **Trade-off, stated plainly.** The safety net today is zero: every one of the
  eleven untested `approve.ts` branches exits through this helper. That argues
  for doing it _with_ a test, not for doing it later.
- **First prerequisite.** Write `src/lib/http.ts` and its test before swapping
  any call site.

### #3 — C6 write side: bound the visit label where the tooth note is bounded

- **Current → target.** A `VisitInputSchema` in `quote-payload.ts` capping
  `label`, mirroring the existing 500-char `note` bound.
- **Why here.** It closes a real, reachable gap — unbounded patient-visible free
  text frozen immutably — and it is the exact class of defect a previous
  impl-review already ruled on for the neighbouring field.
- **Explicitly not the read side.** Bounding `VisitSchema` in `types.ts` would
  apply to already-stored immutable rows and silently 404 patient links. That
  half is the only work in this whole report that touches persisted data, and it
  does not belong in the same change as the other half.

**Considered and not ranked:**

- **C1** — the highest-value candidate in the report, and deliberately not first.
  It needs two phases, and its first phase (extracting `treePayload()` so it can
  be tested) is a genuine restructuring of a 691-line component. Doing it well is
  a change of its own. The exploration did move it forward: the reason recorded
  for not sharing the type is stale, so the objection to it has evaporated.
- **C3** — correct, one line, no argument against it. Not ranked above the others
  only because it removes a duplicate rather than unblocking anything. A natural
  passenger on another change.
- **C5** — ranked last on purpose. Its prerequisite lives in the database, not the
  repo, its types were generated against a schema nobody has verified, and CI
  does not run migrations. Everything about its cost is `unknown` in the one
  place that matters.

**Suggested order, if more than one is taken:**
C2 → add `npm run depcruise` to CI → C3 → C4 → C6-write → C1 → C5.

## Verification of the ranking's structural claims (ast-grep)

The claims the ranking stands on — counts, "only here", "zero importers",
"byte-identical" — re-derived with `ast-grep 0.45.3` and `grep`. **Every zero is
grep-confirmed**, per the rule that a pattern which fails to match is
indistinguishable from a fact that is not there.

| Claim (as written above)                                                              | Verdict                       | Evidence                                                                                                                                                        | Method                                                                                                                                                                               |
| ------------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C2: `PickerOption` is used by 5 files plus its declaration                            | **confirmed — 6 files total** | declaration `components/admin/types.ts:13`; users `QuoteEditor.tsx`, `ToothRow.tsx`, `PricelistPicker.tsx`, `GeneralItems.tsx`, `lib/pricing/picker-options.ts` | `grep -rn "PickerOption\b" … \| grep -v PickerOptions` — the word boundary matters: a naive substring search also catches `PickerOptions` and `buildPickerOptions` and reports **9** |
| C2: exactly one upward `lib → components` import                                      | **confirmed**                 | `src/lib/pricing/picker-options.ts:16`                                                                                                                          | `ast-grep -p 'import type { $$$X } from "@/components/admin/types"'` → 1                                                                                                             |
| C2: no `.astro` file imports `admin/types.ts` — depcruise is not under-reporting here | **confirmed**                 | zero hits                                                                                                                                                       | `grep -rn "components/admin/types" src --include='*.astro'` → empty, grep-confirmed                                                                                                  |
| C2: depcruise reports 5 importers of `admin/types.ts`                                 | **confirmed**                 | 4 islands direct + `picker-options.ts`                                                                                                                          | `npx depcruise src -T text -R '^src/components/admin/types\.ts$'`                                                                                                                    |
| C2: no test imports `PickerOption`                                                    | **confirmed**                 | ast-grep's single hit is `picker-options.ts`, not a test                                                                                                        | ast-grep + `grep -rln "PickerOption\b" src --include='*.test.ts'` → empty, grep-confirmed                                                                                            |
| C2: `PickerOptions` (plural) has no named consumers                                   | **confirmed**                 | referenced only inside `lib/pricing/`; both pages destructure `buildPickerOptions()`'s return at `[id].astro:23` and `new.astro:14`                             | grep                                                                                                                                                                                 |
| C4: the three `jsonError` bodies are byte-identical                                   | **confirmed**                 | all three md5 `6c0e704dc79f65cb39104915a880af1b`                                                                                                                | `sed -n '/^function jsonError/,/^}/p' \| md5` per file                                                                                                                               |
| C4: 25 call sites                                                                     | **confirmed exactly**         | 28 matching lines − 3 definitions = 25 (`[id].ts` 13, `approve.ts` 9, `index.ts` 6, minus one definition each)                                                  | `grep -rc "jsonError("`                                                                                                                                                              |
| C1: `QuotePayload` is exported and has zero importers                                 | **confirmed**                 | its only occurrence outside the type alias is as a parameter type inside its own module, `quote-payload.ts:88`                                                  | grep                                                                                                                                                                                 |
| C1: the client bundle already ships zod and the pricing seed                          | **confirmed**                 | `ZodError`, `leczenie-zachowawcze`, `baseMilk` present in `dist/client/_astro/QuoteEditor.*.js`                                                                 | string search over the built bundle                                                                                                                                                  |
| C3: the two TypeScript status enums are byte-identical                                | **confirmed**                 | `types.ts:26` and `admin/index.astro:34`, both `z.enum(["draft", "approved"])`                                                                                  | grep                                                                                                                                                                                 |
| C6: no test sends a non-empty `visits` array                                          | **confirmed**                 | `quote-payload.test.ts` never populates `visits`                                                                                                                | read in full                                                                                                                                                                         |

**One claim tightened, not overturned.** The blast radius of C2 is reported as
"5 files". That is right for _importers_, and the edit also touches the
declaration site, so the change is **6 files edited**: remove the declaration
from `admin/types.ts`, add it to `picker-options.ts`, drop the upward import
there, and re-point four island imports. The plan should budget six, not five.

**No verdict in §4 changed as a result of this pass**, and the intentionality
verdicts were not revisited — both are out of scope for verification per the
contract. The one number that moved is recorded in place above.

## 5. What this exploration did not do

- **No decision.** The ranking is a proposal. Which option is implemented is
  settled in the planning interview, against this evidence.
- **No target architecture** beyond naming an adequate target shape per
  candidate, as the contract requires.
- **No code changed** — with one exception recorded here for honesty: the
  measurement of the gates found `npm run lint` red at HEAD, a defect introduced
  by the M4L2 map work. That was fixed in `4ddf54d` before this report was
  written. It is a repair of a break, not a refactor, and no candidate depends
  on it.
