# Architecture report — DentiPlan

> A summary of the module-4 analysis of this repository: repository map,
> feature research, refactoring plan, and domain notes. Every structural claim
> below comes from one of the four source artifacts, each linked at the point of
> use. Nothing here was written from memory of the code.
>
> 2026-09-04 · `main` · commit `f0e916e`

## 1. The project described

All four artifacts were produced on **one repository**, so the analysis chains:
the map chose the flow, the flow research found the debt, the ranking chose what
to fix, and the domain notes explain why the invariant behind it is fragile.

|                |                                                                                                                                                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Repository** | `dentiplan` — a dentist turns a semi-structured diagnosis note into two comparable treatment-cost plans (multi-visit standard vs. single session under general anaesthesia) and sends the patient an unguessable link |
| **Stack**      | Astro 6 SSR, React 19 islands, Tailwind 4, Zod, Supabase (Postgres), deployed to Cloudflare Workers                                                                                                                   |
| **Scale**      | 87 source files, 82 commits, ~4 months of history (2026-05-24 → 2026-09-04), one contributor                                                                                                                          |
| **Artifacts**  | L2 `context/map/` · L3 `context/changes/quote-approval-flow-analysis/research.md` · L4 `context/changes/refactor-opportunities/{research,plan}.md` · L5 `context/domain/01–03`                                        |

It is a small repository, and the map says so plainly rather than inflating it.
What makes it worth analysing is not size but a property most codebases do not
have: **approval is irreversible.** A quote, once approved, cannot be edited or
deleted by any code path that exists. That single fact re-weights every finding
below.

## 2. The map (L2)

Built from three independent instruments — git history, a dependency graph, and
authorship — then reconciled. Five findings carried forward:

1. **The centre is the admin quote editor.** `src/components/admin/` and
   `src/pages/admin/` co-change in 4 of 4 commits where either moved: the
   strongest coupling in the repo. Treat them as one unit.
2. **Two instruments agree on one file.** Git co-change and the import graph were
   derived separately and both land on `src/pages/api/admin/quotes/approve.ts`
   as the widest-reaching code file — which is also what `test-plan.md` named as
   risks #1 and #2, months earlier. Three independent signals, one endpoint.
3. **The structure is genuinely clean:** zero dependency cycles across 157 edges,
   and no React island imports the database client or server env. That boundary
   is what keeps the islands testable at all.
4. **A quarter of the graph is invisible.** dependency-cruiser cannot parse
   `.astro`; 48 real import edges (~23%) are missing, and the missing part is
   the patient-facing render path. Recorded as `unknown`, not as "no
   dependencies" — the distinction matters, and §3 shows it paid off.
5. **`CLAUDE.md` is a false hot spot** — top of raw churn, near-zero coupling.
   Ranking hot spots by touch count on this repo misleads.

The map also reframed its own third question honestly: with one contributor,
"who to ask" is fiction, so it became "what to read instead", mapping each risk
zone to the archived plan or review that carries its decisions.

## 3. The feature analysed (L3)

**Target: the approval flow** — editor → validation → pricelist freeze → write →
token → patient page. Chosen from the map's risk zones R1 (deepest endpoint,
no test of its own) and R2 (the patient path, invisible to static analysis).

**Feature overview.** The editor sends pricelist items **by id only**. The server
re-resolves every one of them, re-runs the approval guards, recomputes totals
with the same pure engine the editor previewed with, mints a token and writes
**one statement** — an `UPDATE … WHERE id = ? AND status = 'draft'` or an
`INSERT` of an already-approved row. Splitting that write would leave the row
approved with a null token, violate a CHECK constraint, and then be blocked by
the immutability trigger: a permanently broken row. The patient later reads
through a single `SECURITY DEFINER` RPC that whitelists four columns and returns
zero rows — indistinguishably — for an unknown, malformed, or draft token.

**Technical debt.** Three findings, in the order they matter:

- **The wire format is duplicated, and no gate spans the seam.** The client
  builds an untyped object literal; the server owns the only real definition;
  nothing links them. Rename a key on either side and ESLint, `astro check`,
  `npm test` and `npm run build` all stay green. The only thing that catches it
  is one e2e spec that deliberately does not run in CI.
- **The one irreversible write is the least-tested code on the path** — 11 of
  `approve.ts`'s 14 branches have no test, including the entire UPDATE-draft
  branch and the 409 that `.select("id")` exists to make observable. A plan
  review found that exact hole once, the fix was made, and it was never pinned
  by a test.
- **Two e2e assertions are weaker than they look** — verified against the
  source: both headings the spec checks render unconditionally, and the totals
  line falls back to `formatAmount(0)`. Deleting the totals freeze from
  `approve.ts:91` would leave the suite green on a page reading "Razem 0 zł".

**Confirmed with ast-grep**, per the lesson's verification step: the duplicated
`jsonError` helper is byte-identical across three endpoints (same md5) with 25
call sites; the status enum exists in exactly three places; `QuoteContentSchema`
validates stored content in only two files, both `.astro`. The first ast-grep
pattern returned a **false zero** — it could not match a declaration carrying a
return-type annotation — which is precisely why every zero was re-checked with
grep before being believed.

## 4. The refactoring plan (L4)

Fourteen recorded problems, classified into six structural candidates and eight
non-candidates (missing tests, tool limits, process, and one deliberate product
property). Each candidate examined through three lenses: current shape, history
and intentionality, migration feasibility.

**Chosen: move `PickerOption` from `src/components/admin/types.ts` into
`src/lib/pricing/picker-options.ts`.** Target shape: the pricing layer owns the
type it already builds, and the UI imports it downward.

**Why this one, and not the strongest one.** The highest-value candidate is
sharing the approval wire format — it addresses the debt at the top of §3. It
was not chosen. The chosen candidate is the smallest that closes in one phase
with green checks,
and — the honest version of the argument, after a plan review pushed back on an
earlier and weaker one — its **proof is complete and mechanical** where the
strongest candidate's is not. A dependency cruise going 1 → 0, a clean type
check, and a compiler setting that makes a wrong import uncompilable is a total
verification. C1, by contrast, has no safety net at the moment it needs one: the
existing unit test stays green under any producer rename, and its only
behavioural cover is an e2e spec that does not run in CI. First do the change
that can be proven; then build the harness the bigger one needs.

**What we deliberately do not do:** the wire-format change; the `Database`
generic (its prerequisite lives in the database, not the repo, and CI runs no
migrations); and — most importantly — **the read-side half of the unbounded
visit label.** Bounding `VisitSchema` in `types.ts` would apply the new
constraint to already-stored, immutable rows and silently 404 live patient
links. It is the only work in the whole report that touches persisted data, and
it was split away from its own write-side half for exactly that reason.

| Phase | Delivers                                   | Verified by                                                                                                                                                                                                                           |
| ----- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `PickerOption` moves; six files re-pointed | **implemented** (`dc8e89e`). `npm run depcruise` 1 → 0, `astro check` 0/0 across 82 files, 40 tests, lint 0, build complete. The smoke check ran as `e2e/seed.spec.ts` — the one spec that deletes its own data — rather than by hand |
| 2     | `npm run depcruise` added to CI            | automatic: a passing step in the run, plus confirming that re-introducing the import makes it fail                                                                                                                                    |

The phases are separate on purpose: enforcement is switched on only after the
code already complies, so a gate failure can never be confused with the change's
own failure.

## 5. The domain (L5)

**Ubiquitous language.** _Kosztorys_ → `Quote`/`content`; _ząb_ → `ToothEntry`;
_wizyta_ → `Visit`; _plan narkozowy_ → `totals.anesthesia`; _token pacjenta_ →
`token`. The business runs in Polish and the code in English, and the seam is
mostly clean.

The most useful drifts:

- **The product's headline capability does not exist.** LLM parsing of the raw
  diagnosis note — the PRD's second enabling insight — is a textarea whose value
  is never sent or persisted. Deliberate (that slice is `blocked`), but it means
  the ≤5-minute success criterion is unmet by design.
- **"Pricelist snapshot" has no representation.** The _guarantee_ holds — items
  are copied by value — but you cannot ask which pricelist version a quote was
  priced from.
- **FR-060 speaks of a "revoked" token; nothing can revoke one.** Retention has
  an index built for a scan nobody wrote.
- **The domain's most important verb has no name in the code.**
  _Zatwierdzenie_ exists only as a route filename. There is no `approveQuote()`.

**Invariant #1: an approved quote never changes** (FR-053). It belongs to the
**Quote** aggregate — one row plus its `content` tree, with teeth, visits and
items as value objects inside it. It is enforced in four places that agree by
coincidence rather than by construction: a database trigger, the approve
endpoint's `status = 'draft'` filter, the draft endpoint's DELETE filter, and the
UI. The trigger is the strongest and covers UPDATE only; **DELETE is guarded by
one `.eq()` in one endpoint, with no test and no database backstop.** That is
the real argument for giving the invariant an owner.

**Anti-Corruption Layer: the Supabase client.** The exercise's own success
criterion — grep the package name, expect hits only in the adapter — **already
passes today**, with two hits. That is the trap: the _import_ is contained, the
_shape_ is not. Eleven files across three layers program against the query
builder, and one `.astro` page names an RPC and its parameter. The honest case
for isolating it is testability and a single home for the access rules, **not
portability** — no document in this repo ever promised a swappable database, and
the plan says so rather than inventing a requirement. It also records what an ACL
cannot isolate: RLS and the `SECURITY DEFINER` RPC carry real guarantees that
would have to be re-earned elsewhere.

## 6. Decisions that are mine

> **Draft — to be rewritten in the author's own voice before submission.**
> The decisions below are the ones actually taken during this analysis, recorded
> so the rewrite has something concrete to work from.

I chose the approval flow over the editor, even though the editor is where the
churn is, because the map gave me three independent signals pointing at the same
endpoint and I would rather follow agreeing instruments than raw activity. I
picked the smallest refactor in my own ranking and not the best one — the wire
format is the real problem, but at the moment it needs a safety net it has none
at all, and I would rather ship a change I can prove than start one I would
leave half-done; the small one also happens to be what makes the dependency
cruiser usable as a gate, so it buys more than its size suggests. I split the
unbounded visit label in half and deliberately left the more obviously "correct"
half undone, because adding that bound would apply to quotes that are already
approved and cannot be repaired, and a silent 404 on a patient's live link is a
worse outcome than an unbounded field. I refused the portability argument for the
Anti-Corruption Layer: nothing in this project ever promised a swappable
database, and I did not want a plan that sells a benefit nobody asked for — the
reason to do it is that the approval endpoint is currently untestable, which is a
real cost I can point at. And I kept the database trigger out of the aggregate
design, because the one guarantee in this system that survives any application
bug is the one I trust most, and an aggregate is not a reason to weaken it.

## 7. What this report does not claim

- Every DB-side guarantee here is read from the migration in the repository. The
  probe that would confirm the deployed schema matches is manual and not in CI,
  and this project has already had a three-month divergence between the two.
- The mutation claim in §3 (deleting the totals freeze leaves the suite green)
  was **not executed**. Its premises were each verified in the source; running it
  would have cost a permanent, undeletable row in the production database.
- Coupling numbers come from 82 commits across five active days. They are
  directional, not statistical.
- The plans in `context/domain/` are target shapes, not scheduled work. Only the
  L4 plan's Phase 1 was implemented; Phase 2 (putting the cruise and the type
  check into CI) is planned and not done.
- The smoke check for Phase 1 covered the general-items picker end to end. The
  per-tooth picker renders the same component and its import is covered by the
  type check, but it was not driven in a browser. Recorded as partial.
