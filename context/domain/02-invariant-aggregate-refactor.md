---
title: Invariant #1 and the Quote aggregate — a guardian refactor plan
created: 2026-09-04
type: refactor-plan
---

# Invariant #1 and the Quote aggregate

> A **plan**, not an implementation. No production code is modified by this
> document. It continues `01-domain-distillation.md`, which selected the
> invariant; here it is diagnosed and a guardian aggregate is designed for it.
>
> All line references verified against `main` at 2026-09-04.

## 1. The invariants, and why I-1 wins

`01-domain-distillation.md` §3 lists ten. Scored on the three axes the exercise
demands — how core to the product, how smeared across layers, how genuinely
enforced:

| Invariant                                      | (a) Core                                                                     | (b) Smeared                                                                                  | (c) Enforced                                                                      | Score                         |
| ---------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------- |
| **I-1 approved quote never changes**           | **Highest** — FR-053 is a PRD guardrail; a breach is uncorrectable by design | **4 layers**: DB trigger, endpoint UPDATE filter, endpoint DELETE filter, UI read-only state | **Yes, but by coordination** — no single owner, and the endpoint half is untested | **selected**                  |
| I-2 server-authoritative prices                | High                                                                         | 1 module                                                                                     | Yes, structurally, and unit-tested                                                | not selected                  |
| I-3 no patient identifiers on the patient page | High                                                                         | 2 layers, both structural                                                                    | Yes, twice                                                                        | not selected                  |
| I-4 approved row has token + timestamp         | Medium                                                                       | 1 layer (CHECK constraints)                                                                  | Yes, by the schema                                                                | not selected                  |
| I-5 unknown/draft token indistinguishable      | High                                                                         | 2 layers                                                                                     | Yes, and e2e-probed                                                               | not selected                  |
| I-10 12-month retention                        | Medium                                                                       | 0 layers                                                                                     | **No**                                                                            | unbuilt slice, not a refactor |

**The choice, stated honestly.** I-1 is not the _worst-enforced_ invariant —
I-10 is, and it is not enforced at all. But I-10 is an unwritten feature, not a
structural defect; refactoring cannot fix a slice nobody built. Among invariants
that _are_ enforced, I-1 is simultaneously the most core and the most fragile,
and the fragility is of a specific kind: **it works today because four
mechanisms agree, and nothing in the codebase makes them agree.** They were made
to agree by one person on one afternoon.

That fragility is already documented, not speculative. `context/changes/quote-approval-flow-analysis/research.md`
establishes that the endpoint half of the enforcement — `.eq("status","draft")`
together with the `.select("id")` that makes a zero-row match observable — has
**no test at all** (D2), and that the identical hole was found once by a plan
review (`context/archive/2026-09-04-admin-quote-list/reviews/plan-review.md:62`),
fixed, and never pinned by a test. An invariant that has already been broken
once and whose fix is unguarded is the right one to give an owner.

## 2. Diagnosis — where the rule lives today

Four enforcement points, plus one place the rule is _assumed_ rather than
enforced.

| #   | Layer                       | Location                                                                                                                                   | What it does                                                                                                                                                                                                                             | Strength                                                                                                                                                        |
| --- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | Database                    | `supabase/migrations/20260603194110_quotes_foundation.sql:89-100` — `prevent_approved_update()` + trigger `quotes_immutable`               | `BEFORE UPDATE … FOR EACH ROW`; raises when `OLD.status = 'approved'`. Keys on `OLD` precisely so the one-time draft→approved transition passes.                                                                                         | **Strongest.** Independent of any application bug. Covered by the SQL probe (`supabase/tests/quotes_foundation_probe.sql:102`) — which is manual and not in CI. |
| E2  | Endpoint (approve)          | `src/pages/api/admin/quotes/approve.ts:112` — `.eq("status","draft")`, with `.select("id")` at `:113` and the zero-row → 409 at `:117-119` | Makes an already-approved row unmatchable, and makes the miss _observable_.                                                                                                                                                              | **Untested.** The whole branch has no test.                                                                                                                     |
| E3  | Endpoint (draft PUT/DELETE) | `src/pages/api/admin/quotes/[id].ts` — both statements scoped to `status='draft'`, DELETE at `:103`                                        | **The only guard on DELETE.** The trigger is UPDATE-only, deliberately, so S-04 retention can purge. Its own header (`:5-8`) calls the application layer "the only thing standing between a stray request and a destroyed patient link". | **Untested, and unbacked by the database.**                                                                                                                     |
| E4  | UI                          | `src/components/admin/QuoteEditor.tsx` read-only mode; `DeleteQuoteButton.tsx`                                                             | Hides mutating affordances for approved quotes.                                                                                                                                                                                          | Cosmetic by design — its own comment (`DeleteQuoteButton.tsx:10`) calls it "defence in depth rather than the guard itself".                                     |
| E5  | _(assumed)_                 | `approve.ts:9-17`                                                                                                                          | The single-statement design: splitting the write would leave `approved` + NULL token, violate `quotes_approved_has_token`, and the follow-up statement would then be refused by the trigger — bricking the row permanently.              | **Enforced only by a comment.** Nothing prevents a future contributor from splitting it.                                                                        |

### What the diagnosis actually shows

1. **The rule has no name.** There is no `approveQuote()`, no `Quote` object, no
   domain error. The most important verb in the domain is spelled as a route
   filename (`01-domain-distillation.md` D-7). To find out what "approved means
   immutable" implies, you must read a trigger, two endpoints and a component.
2. **The two halves protect different operations.** The database covers UPDATE;
   only the application covers DELETE. Nowhere is that asymmetry stated in one
   place — it is a comment in a migration and a comment in an endpoint.
3. **The client is nowhere the sole guard** — genuinely good, and worth saying,
   because it is the usual failure mode and this codebase avoided it.
4. **Nothing is swallowed.** Errors stop the operation; the 409 path is explicit.
   The defect is missing _ownership_ and missing _tests_, not silent failure.
5. **The invariant is untested exactly where it is weakest.** E1 has a probe that
   never runs automatically; E2 and E3 have nothing.

## 3. The guardian aggregate

**Aggregate root: `Quote`.** Boundary: the row in `public.quotes` plus its
`content` tree. `ToothEntry`, `Visit`, `GeneralItem` and `PricelistItemRef` are
value objects inside it — none is independently addressable, none has an
identity outside a quote, and nothing outside `content` references them. That is
the correct boundary and the current schema already draws it: one row, one
`jsonb`, no child tables.

The aggregate's job is to be **the only place a quote's lifecycle is decided.**

### Domain errors

Named, not booleans — an illegal operation throws and stops.

```ts
// src/lib/domain/errors.ts
export class QuoteAlreadyApprovedError extends Error {} // → 409
export class QuoteNotApprovableError extends Error {} // → 400  (empty, or an unpriced in-plan tooth)
export class UnknownPricelistItemError extends Error {} // → 400  (dangling reference)
export class QuoteNotFoundError extends Error {} // → 404
```

### The root

```ts
// src/lib/domain/quote.ts   (sketch — signatures and preconditions, not final code)

export type QuoteState =
  | { status: "draft"; content: QuoteContent; patientEmail: string | null }
  | { status: "approved"; content: QuoteContent; patientEmail: string; token: string; approvedAt: string };

export class Quote {
  private constructor(
    readonly id: string | null,
    private state: QuoteState,
  ) {}

  static openDraft(payload: QuotePayload): Quote;
  static rehydrate(id: string, row: QuoteRow): Quote;

  /** Precondition: status === "draft". Otherwise throws QuoteAlreadyApprovedError. */
  reviseDraft(payload: QuotePayload): void;

  /**
   * The one-way transition. Preconditions, in order:
   *   - status === "draft"            else QuoteAlreadyApprovedError
   *   - every pricelist id resolves   else UnknownPricelistItemError
   *   - not empty; every in-plan tooth priced  else QuoteNotApprovableError
   * Effects (all or nothing): freeze prices by value, compute totals,
   * mint the token, stamp approvedAt, move to "approved".
   */
  approve(mintToken: () => string, now: () => string): void;

  /** Precondition: status === "draft". Otherwise throws QuoteAlreadyApprovedError. */
  markForDeletion(): void;

  get isApproved(): boolean;
  get patientToken(): string; // throws unless approved
  toRow(): QuoteRow;
}
```

Every precondition is a `throw`, never a silent no-op. The type of `QuoteState`
does half the work on its own: `token` and `approvedAt` exist only in the
`approved` variant, so I-4 ("an approved quote always has a token and a
timestamp") becomes unrepresentable-if-false rather than checked.

### The repository

```ts
// src/lib/domain/quote-repository.ts
export interface QuoteRepository {
  load(id: string): Promise<Quote>; // throws QuoteNotFoundError
  insertApproved(quote: Quote): Promise<void>; // one INSERT
  saveDraft(quote: Quote): Promise<void>; // one UPDATE, scoped to status='draft'
  approveDraft(quote: Quote): Promise<void>; // ONE statement; 0 rows → QuoteAlreadyApprovedError
  deleteDraft(id: string): Promise<void>; // scoped to status='draft'; 0 rows → QuoteAlreadyApprovedError
}
```

**Atomicity is preserved, not invented.** `approveDraft` keeps the existing
single-statement design — `UPDATE … WHERE id = ? AND status = 'draft' RETURNING id`
— and keeps `.select("id")`, because zero rows is how the 409 becomes
observable. The difference is that the reason now lives in a method with a name
and a test, instead of in a comment above a query. Splitting it would break a
test rather than a comment.

### The route becomes thin

```ts
export const POST: APIRoute = async (context) => {
  const supabase = requireClient(context);
  await requireUser(supabase);

  const payload = ApproveRequestSchema.parse(await context.request.json());
  const repo = new SupabaseQuoteRepository(supabase);

  const quote = payload.id ? await repo.load(payload.id) : Quote.openDraft(payload);
  quote.approve(generateToken, () => new Date().toISOString());
  payload.id ? await repo.approveDraft(quote) : await repo.insertApproved(quote);

  return json({ token: quote.patientToken, path: `/p/${quote.patientToken}` }, 201);
};
```

with one error mapper shared by all three endpoints — which also absorbs the
`jsonError` helper currently copy-pasted into three files:

```ts
QuoteAlreadyApprovedError → 409   UnknownPricelistItemError → 400
QuoteNotApprovableError   → 400   QuoteNotFoundError        → 404
```

**What does not move.** The database trigger stays exactly as it is. It is the
strongest guarantee in the system precisely because it does not trust the
application, and an aggregate is not a reason to weaken it. After this refactor
the invariant is enforced in two places on purpose — the aggregate as the domain
owner, the trigger as the backstop that survives any application bug — instead
of in four places by coincidence.

## 4. Before / after

| Rule lives today                                                                   | After                                                                                                            |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| E1 trigger (migration `:89-100`)                                                   | **unchanged** — the deliberate backstop                                                                          |
| E2 `.eq("status","draft")` + `.select("id")` + 409, inline in `approve.ts:112-119` | `QuoteRepository.approveDraft`, one implementation, one test                                                     |
| E3 draft PUT/DELETE scoping in `[id].ts`                                           | `saveDraft` / `deleteDraft` — the DELETE guard finally has a name, which matters because the DB does not back it |
| E4 UI read-only state                                                              | unchanged; can now ask `quote.isApproved` instead of comparing strings                                           |
| E5 "approval must be one statement", enforced by a comment                         | a documented precondition of `approveDraft`, pinned by a test that fails if it is split                          |
| `approvalBlockReason` returning a Polish string that the route turns into a 400    | `QuoteNotApprovableError`; the message becomes presentation, not control flow                                    |
| `jsonError` copy-pasted 3×                                                         | one error mapper                                                                                                 |
| Status compared as a string literal in 3 places                                    | `quote.isApproved`; `QuoteStatusSchema` the single source (closes drift D-8)                                     |

## 5. Phases, and how each is verified

Guard-first: **nothing is restructured before the current behaviour is pinned.**
Each phase is an independently revertible commit, ordered cheapest and most
self-contained first.

| Phase  | What                                                                                                                                                                                                                                                                                  | Test-first?                     | Verification                                                                                                                        |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **P1** | **Characterization tests only — no production change.** Pin today's behaviour: approve-by-id twice → 409 with amounts, token and `approved_at` unchanged; PUT/DELETE on an approved quote → 409; approve with a dangling item / bad FDI / missing e-mail → 400 and nothing persisted. | **Yes** — this phase _is_ tests | The suite must pass **against the current code, unchanged**. A characterization test that fails now is a bug report, not a harness. |
| **P2** | Introduce `src/lib/domain/errors.ts` and the error mapper; route the three endpoints' existing failures through it. Behaviour identical.                                                                                                                                              | No — pure extraction            | `npm test`, `npm run lint`, `astro check`, `npm run build`. P1 must stay green untouched.                                           |
| **P3** | Introduce `Quote` with `approve()` and its preconditions. Unit-test the aggregate directly — it is pure, so this is cheap. `approve.ts` delegates.                                                                                                                                    | **Yes**                         | New unit tests + P1 green + full suite                                                                                              |
| **P4** | Introduce `QuoteRepository` and move the three scoped statements behind it. This is the only phase that touches data access.                                                                                                                                                          | No                              | P1 green (it is the whole safety net here) + a manual run of `supabase/tests/quotes_foundation_probe.sql`                           |
| **P5** | Migrate the draft endpoints (`index.ts`, `[id].ts`) to the aggregate; delete the duplicated `jsonError`; replace string status comparisons with `quote.isApproved`.                                                                                                                   | No                              | full suite + `npm run depcruise` (the new `src/lib/domain/` must not import from `src/components/`)                                 |

**Manual verification, once, after P4** — because approving a quote in the real
project creates a permanently undeletable row (`test-plan.md` §6.3), this is done
deliberately and once rather than on every phase: approve a draft in the admin
panel, confirm the patient link renders, confirm a second approval attempt on
the same id is refused.

**Enforcement is switched on explicitly, as its own step.** After P5, add a
`depcruise` rule forbidding `src/pages/api/**` from importing `@/lib/supabase`
directly — the repository becomes the only door. That rule is added as a separate
commit, after the code already satisfies it, so the enforcement step can never be
what turns the build red.

### Test cases for the invariant

Legal transitions: draft → draft (revise); draft → approved (once); draft →
deleted. Illegal, each of which must throw a **named** error: approved →
approved; approved → draft; approved → deleted; approve an empty quote; approve
with an unpriced `in-plan` tooth; approve with a dangling pricelist id; read
`patientToken` from a draft.

## 6. Load-bearing names to register

This project keeps a contract registry at `docs/reference/contract-surfaces.md`.
The refactor introduces names that belong in it: `Quote` (aggregate root),
`QuoteRepository`, `QuoteAlreadyApprovedError`, `QuoteNotApprovableError`,
`UnknownPricelistItemError`, `QuoteNotFoundError`, and the invariant's own name —
**"approved is terminal"**.

## 7. Honest limits of this plan

- **It buys clarity and testability, not new safety.** The database trigger
  already makes UPDATE-immutability unbreakable. What the aggregate adds is a
  single owner, named failures, and a place for the tests that are missing.
  Anyone expecting a security improvement should read §3's last paragraph again.
- **The one real safety gain is DELETE**, which the database deliberately does
  not guard. Today its only protection is one `.eq()` in one endpoint with no
  test. That is the strongest practical argument for the whole plan.
- **P1 is the only phase that must not be skipped.** Phases P2–P5 without P1 are
  a rewrite of untested code, which is how invariants get quietly broken during
  a refactor that "changed nothing".
- This plan is deliberately **larger than the one change selected for
  implementation now** (see `context/changes/refactor-opportunities/plan.md`).
  It is the target shape, recorded so the small step taken today points at it
  rather than away from it.
