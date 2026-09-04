---
date: 2026-09-04T17:46:04+0200
researcher: Wojciech Sternik
git_commit: e444bbf02ed98ccafc1c7e357193b419a40df08c
branch: main
repository: dentiplan
topic: "Quote approval flow — editor through patient link"
tags: [research, codebase, approval, patient-link, quote-content, blast-radius]
status: complete
last_updated: 2026-09-04
last_updated_by: Wojciech Sternik
---

# Research: the quote approval flow

> **Goal of this research, in one line:** trace the approval transaction from
> `src/components/admin/QuoteEditor.tsx` through `approve.ts` to the frozen row
> and back out at `/p/<token>`, because `context/map/repo-map.md` names it risk
> zone R1 (deepest endpoint, no test of its own) and R2 (the patient path, which
> static analysis cannot see at all).

**Date**: 2026-09-04T17:46:04+0200
**Researcher**: Wojciech Sternik
**Git Commit**: `e444bbf`
**Branch**: `main`
**Repository**: dentiplan

## Research Question

Analyse the quote approval flow with particular attention to the areas
`context/map/repo-map.md` connects it to. Three parallel investigations:
end-to-end trace, test-coverage gaps, blast radius. Describe the current state
only — change nothing.

Every claim below is labelled **`evidence`** (a file was read or a command was
run, and it is cited), **`inference`** (reasoned from evidence), or
**`unknown`** (could not be established). The labels are load-bearing: the
point of this document is that the three categories do not get mixed.

## Summary

The approval flow is **better designed than it is protected**. Its two hardest
guarantees — the server never trusts a client-sent price, and the patient can
never reach an admin-only column — are enforced structurally rather than by
convention, in three independent layers, and they hold. What is missing is the
layer that would keep them holding: the endpoint that performs the one
irreversible write in the product has **11 of its 14 branches untested**, and
the three that are exercised are reached incidentally by a single e2e spec that
does not run in CI.

Five findings carry the rest of this document:

1. **The editor↔endpoint wire format is duplicated, not shared, and no gate
   spans it.** The client builds an untyped object literal; the server owns the
   only real definition. Rename a key on one side and ESLint, `astro check`,
   `npm test` and `npm run build` all stay green. `evidence`
2. **The entire UPDATE-draft branch of `approve.ts` — including the 409 that
   `.select("id")` exists to make observable — has no test.** A plan-review
   found this exact hole once, the fix was reviewed in, and it was never
   test-pinned. `evidence`
3. **Two e2e assertions are weaker than they look.** Deleting
   `content.totals = computeQuoteTotals(content)` from `approve.ts:91` leaves
   `patient-link-content.spec.ts` green on a page reading "Razem 0 zł".
   `inference`, premises verified
4. **dependency-cruiser under-reports this flow by ~27%, and the miss is not
   random — it is entirely on this flow.** `src/types.ts` records 22 dependents
   and truly has 30; all 8 recovered are quote-flow files. `evidence`
5. **Immutability turns any shipped bug into a permanent one.** An approved row
   cannot be UPDATEd (DB trigger) or DELETEd by the application, and CI does not
   run migrations. The blast radius includes every quote already approved — a
   growing, immutable, patient-visible set no code change can reach. `evidence`

---

## 1. Feature overview

### What the flow is

A dentist builds a quote in a React island, approves it, and receives an
unguessable link. Approval is the moment money is frozen: it is the only place
totals are computed authoritatively, the only place a token is minted, and the
only transition after which the row can never change again. The patient opens
the link with no account and sees a read-only rendering of exactly the data the
database is willing to hand an anonymous caller.

### Where input enters, where state changes, what comes back

**Input.** `src/components/admin/QuoteEditor.tsx:181-196` (`treePayload()`)
serialises the editor's working tree. It sends pricelist items **by id only** —
no prices, no totals, no diagnosis free-text — plus a required `patient_email`
and an optional `id`. `evidence`

**State change.** `src/pages/api/admin/quotes/approve.ts` re-derives everything
that matters rather than trusting any of it:

| Step | Line     | What happens                                                                                               |
| ---- | -------- | ---------------------------------------------------------------------------------------------------------- |
| 1    | `:56-58` | client configured, else 500                                                                                |
| 2    | `:60-64` | `auth.getUser()`, else 401                                                                                 |
| 3    | `:68-73` | `ApproveRequestSchema.parse` — FDI numbers, enums, 500-char note bound, valid e-mail, uuid `id` — else 400 |
| 4    | `:76-82` | `buildQuoteContent` re-resolves **every** pricelist id server-side; throws on a dangling reference → 400   |
| 5    | `:84-88` | `approvalBlockReason` — empty quote, or an in-plan tooth with no price → 400                               |
| 6    | `:91`    | `content.totals = computeQuoteTotals(content)` — the same pure engine the editor previewed with            |
| 7    | `:93-95` | token (CSPRNG, base64url) + `approved_at`                                                                  |
| 8    | `:97`    | **the only branch point**                                                                                  |

`evidence` for all eight.

**The branch.** With an `id`, one `UPDATE … .eq("id", …).eq("status","draft").select("id")`;
without one, a single `INSERT` of an already-`approved` row. They rejoin at the
shared `201 {token, path}` (`:134-138`). The single-statement design is
load-bearing and the file says why (`:9-17`): splitting the write would leave
the row `approved` with a NULL token, violating `quotes_approved_has_token`,
and the follow-up statement would then be refused by the immutability trigger —
a permanently broken row that FR-053 makes uncorrectable. `evidence`

`.select("id")` is not cosmetic. Without it, Supabase resolves with `data: null`
whether the statement matched one row or none, so the 409 would be
indistinguishable from success. `evidence` (`approve.ts:98-100`, and
`context/archive/2026-09-04-admin-quote-list/reviews/plan-review.md:62`, where
the hole was originally found).

**What comes back to the patient.** `src/pages/p/[token].astro` never touches
the table. The only anon read path is the `get_quote_by_token` RPC —
`SECURITY DEFINER`, `set search_path = ''`, an explicit four-column whitelist
(`id, patient_type, content, created_at`), filtered to `status = 'approved'`.
It cannot reach `patient_email`, `status`, `token`, or `approved_at`, and it
returns zero rows — byte-identically — for an unknown token, a draft token, or
a malformed one (FR-060). `evidence`
(`supabase/migrations/20260603194110_quotes_foundation.sql:117-129`)

```mermaid
sequenceDiagram
    autonumber
    actor D as Dentist
    participant ED as Editor island<br/>QuoteEditor.tsx
    participant PG as Astro page<br/>/admin/quotes/[new|id]
    participant API as API endpoint<br/>approve.ts
    participant SVC as quote-payload<br/>service
    participant COST as cost engine<br/>computeQuoteTotals
    participant DB as Supabase / Postgres<br/>public.quotes
    actor P as Patient
    participant PP as Patient page<br/>/p/[token].astro

    D->>PG: GET /admin/quotes/new (or /<id>)
    Note over PG: middleware: getUser(),<br/>/admin gated → 302 /auth/signin if anon
    PG->>ED: hydrate client:load<br/>pickerOptions + initialContent + quoteId
    D->>ED: edit teeth / visits / items / e-mail
    ED->>COST: computeQuoteTotals(tree)  [live preview]
    COST-->>ED: QuoteTotals
    D->>ED: click "Zatwierdź"
    ED->>API: POST /api/admin/quotes/approve<br/>{patient_type, teeth[by id], visits,<br/>generalItems[by id], patient_email, id?}

    API->>API: 1. configured? else 500
    API->>DB: 2. auth.getUser() → 401 if anon
    API->>API: 3. Zod ApproveRequestSchema → 400
    API->>SVC: 4. buildQuoteContent(payload)
    SVC->>SVC: resolvePricelistItem(id) per item<br/>(server-authoritative price)
    SVC-->>API: content (throw → 400 unknown item)
    API->>SVC: 5. approvalBlockReason(content) → 400
    API->>COST: 6. computeQuoteTotals(content)
    COST-->>API: totals → content.totals
    API->>API: 7. token = CSPRNG base64url, approved_at

    alt payload.id present  (draft → approved)
        API->>DB: UPDATE … WHERE id=? AND status='draft' RETURNING id
        Note over DB: trigger keys on OLD.status —<br/>draft→approved passes
        DB-->>API: 0 rows → 409 | error → 500
    else no id  (fresh approved row)
        API->>DB: INSERT (status='approved', token, approved_at)
        Note over DB: check quotes_approved_has_token<br/>+ has_timestamp; unique token index
        DB-->>API: error → 500
    end

    API-->>ED: 201 {token, path:"/p/<token>"}
    ED->>D: ApprovalConfirmation + copyable link
    D-->>P: sends /p/<token> out of band

    P->>PP: GET /p/<token>  (no session)
    PP->>DB: rpc get_quote_by_token(p_token)
    Note over DB: SECURITY DEFINER, search_path='',<br/>WHERE token=? AND status='approved'<br/>returns id, patient_type, content, created_at
    DB-->>PP: 0 or 1 whitelisted row
    alt 1 row and Zod-parses
        PP-->>P: 200 read-only quote
    else anything else
        PP-->>P: 404 identical generic error page
    end
```

### The three invariants that actually hold

Worth stating plainly, because the rest of this document is about weaknesses
and these are not weaknesses:

1. **Server-authoritative prices (FR-050).** Items travel by id and are
   re-resolved in `buildQuoteContent`. A tampered client cannot freeze wrong
   money. Unit-tested, including "ignores a client-sent price"
   (`quote-payload.test.ts:53`). `evidence`
2. **The patient's e-mail is structurally absent, not filtered.**
   `QuotePayloadSchema` has no e-mail slot and neither does `buildQuoteContent`,
   so no caller can nest one inside `content` by accident; the e-mail travels as
   a sibling and lands in its own column (FR-072). Tested at
   `quote-payload.test.ts:41` ("a stray e-mail is stripped, never carried").
   `evidence`
3. **Defence in depth on immutability.** The DB trigger blocks any UPDATE where
   `OLD.status = 'approved'`; the endpoint additionally scopes its UPDATE to
   `status = 'draft'`; the UI hides mutating controls. Three layers, and the
   trigger keys on `OLD.status` specifically so the one-time draft→approved
   transition still passes. `evidence`

---

## 2. Technical debt

Ordered by what a change to this flow would actually cost, not by how untidy it
looks.

### D1 — The wire format is duplicated, and no gate spans the seam

**Evidence.** The producer is an object literal with no return type annotation
(`QuoteEditor.tsx:181-196`). The consumer is `QuotePayloadSchema`
(`quote-payload.ts:61-66`), extended per endpoint (`approve.ts:41-44` requires
the e-mail; `api/admin/quotes/index.ts:21-23` and `[id].ts:21-23` make it
nullish). `QuoteEditor.tsx` imports domain types from `@/types` but **never**
imports `QuotePayload`, `QuotePayloadSchema`, or anything from the service —
confirmed with `npx depcruise src -T text -R '^src/lib/services/quote-payload\.ts$'`,
which returns exactly four dependents: the test and the three API endpoints, no
component.

The two sides do share domain types — but **the wire shape is a different shape
from the domain shape**, and precisely the transformed keys are the undefined
ones: `pricelistItems: PricelistItemRef[]` → `pricelistItemIds: string[]`
(`:190`), `item: PricelistItemRef` → `itemId: string` (`:194`).

**Inference (high confidence).** Rename or retype a wire key on one side and
every gate stays green: the post-edit ESLint hook, `astro check` at commit,
`npm test` and `npm run build` in CI. None of them can cross an untyped
`JSON.stringify` boundary. The failure surfaces at runtime as a generic 400 the
dentist reads as "Nieprawidłowe dane kosztorysu."

**What does catch it:** exactly one thing, and it is not in CI —
`e2e/patient-link-content.spec.ts:57-59`, which approves a quote and asserts the
confirmation heading. `test-plan.md` §5 places e2e at "local, before opening a
PR". `evidence`

**Two smaller seams of the same kind.** The `jsonError` helper that produces the
`{ error: string }` envelope is copy-pasted into **3** (report: 4) endpoint
files — `approve.ts:46`, `index.ts:25`, `[id].ts:25` — and read back on the
client through a bare cast (`QuoteEditor.tsx:284`); and
`src/pages/admin/index.astro:30-35` re-declares the
row contract with its own local `z.enum(["draft","approved"])` instead of
importing `QuoteStatusSchema`, so the status enum now exists in three places:
`src/types.ts:26`, the migration's CHECK constraint (`:26`), and that page.
`evidence`

### D2 — The one irreversible write is the least tested code on the path

**Evidence.** No coverage tool is configured (no `coverage` block in
`vitest.config.ts`, no `@vitest/coverage-*` dependency), so branch coverage was
derived by reading every `if` / `catch` / `throw` / zod rule and matching it to
assertions by line. `npm test` is green: 3 files, 40 tests.

The pure layer is genuinely covered — `cost.ts` 17/17 branches, `format.ts`,
`approvalBlockReason` 3/3 with message-level assertions. The transaction layer
is not: **`approve.ts` has 11 of 14 branches with no test at all**, and the
three that are exercised are reached incidentally by one e2e.

Uncovered, in order of consequence:

| Branch                                     | Line                         | Why it matters                                                                                                                                                                                                                                  |
| ------------------------------------------ | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The whole `payload.id` UPDATE-draft branch | `:97-119`                    | Never executed by any test. `inference`: a regression that drops `.select("id")` or `.eq("status","draft")` would tell the caller 201 while nothing changed — the dentist would hand out a token pointing at the _old_ quote. Worse than a 409. |
| The zero-row → **409**                     | `:117-119`                   | Risk #2's headline case. The `.select("id")` fix was reviewed into existence and never pinned.                                                                                                                                                  |
| Every `catch`→status mapping               | `:71-73`, `:79-82`, `:85-88` | The underlying _rules_ are unit-tested; the mapping to 400 is not.                                                                                                                                                                              |
| The 401                                    | `:62-64`                     | **`PROTECTED_ROUTES = ["/dashboard", "/admin"]` does not match `/api/admin/...`** (`src/middleware.ts:4,18`), so `approve.ts:62` is the _sole_ auth guard on the only irreversible write in the product. Nothing tests it. `evidence`           |
| All of `token.ts`                          | —                            | No test file exists. It is the cheapest possible test in the repo (zero imports) and the only thing standing behind FR-051's guessability claim.                                                                                                |

### D3 — Two existing tests are weaker than they look

This is the category worth the most attention, because a weak test reads as
coverage on every dashboard.

- **The totals are not actually asserted.** `patient-link-content.spec.ts:91-93`
  checks three headings to prove "the page is genuinely the quote" — but both
  `<h3>`s in `VariantComparison.astro` render **unconditionally**, and `Razem`
  falls back to `formatAmount(0)`. **Delete `content.totals = computeQuoteTotals(content)`
  from `approve.ts:91` and the spec still passes, on a page reading "Razem 0 zł".**
  `inference` — every premise verified, see the ast-grep section.
- **The diagnosis-note absence assertion proves nothing.** `:86-87` asserts the
  note is not on the patient page — but `rawText` is never put into the payload
  in the first place, so the value never left the browser. This is exactly the
  shape the S-03 work already caught once for the e-mail half of the same spec,
  which _is_ properly guarded by a positive control at `:69-71`. The note half
  has no equivalent. `evidence`
- **`patient-link-probe.spec.ts` proves the response is uniform, not that
  tokens are unguessable.** Those are different claims; only the first is
  tested. `evidence`
- **`seed.spec.ts` (drafts) and `patient-link-content.spec.ts` (approvals)
  together look like "draft then approve" coverage and are not** — the approval
  spec never saves a draft first, so `savedId` is `null` and it always takes the
  INSERT branch. `evidence`

### D4 — The static instrument is blind exactly where this flow lives

**Evidence.** Corrected against hand-`grep` (the method is documented in
`context/map/artifact-2-structure.md` §2):

| Module                        | depcruise reports |  Truth | Recovered dependents                                                          |
| ----------------------------- | ----------------: | -----: | ----------------------------------------------------------------------------- |
| `src/types.ts`                |                22 | **30** | 5 patient components, `/p/[token]`, `/admin/quotes/[id]`, `/admin/quotes/new` |
| `src/lib/quote/format.ts`     |  1 (its own test) |  **4** | `PatientQuote`, `ScenariosSection`, `VariantComparison`                       |
| `src/lib/quote/tooth-name.ts` |                 6 |  **9** | `DeferredSection`, `ScenariosSection`, `ToothGroups`                          |
| `src/lib/supabase.ts`         |                 7 | **10** | `admin/index`, `admin/quotes/[id]`, **`p/[token]`**                           |

The under-report is ~27% and **every single recovered edge is on this flow**.
`inference`: `--reaches` must never be used alone on this repo; pair it with
`grep -rl "<module>" src --include='*.astro'`.

Related: **only two files parse stored `content` at runtime, and both are
`.astro`** — `p/[token].astro:36` and `admin/quotes/[id].astro:33`. The write
path never parses `content`; it constructs it. `evidence`

### D5 — The generated DB layer is inert

**Evidence.** `src/db/database.types.ts` has one dependent (`src/types.ts`), and
the two types derived from it (`Quote`, `PatientView`) are referenced **nowhere
else in the repo**. The Supabase client is created without the `Database`
generic. `git log` shows the file has been written **exactly once**, in
`5f3a546` (2026-06-03) — and the migration was edited _later_, in `656030b`,
without regenerating it.

**Inference.** Regenerating after a schema change neither breaks nor catches
anything today. It is a documented manual step (`src/types.ts:7-8`,
`docs/reference/contract-surfaces.md:49`) with no script, no hook and no CI
step — and no consumer that would notice if it were stale.

### D6 — `VisitSchema.label` is unbounded and patient-visible

**Evidence.** `src/types.ts:118-121` declares `label: z.string().default("")`
with **no `.max()`**, while the tooth `note` immediately alongside it is capped
at 500 (`quote-payload.ts:46`). The label is rendered to the patient at
`VariantComparison.astro:21`.

**Inference.** This is an unbounded patient-visible free-text field on the
write path — the same shape as the impl-review finding that risk #3 was
originally raised over. Nothing tests the `visits` array end-to-end either; the
write path has never seen a non-empty one.

### D7 — Immutability multiplies the cost of every other item above

**Evidence.** The trigger blocks UPDATE on `OLD.status = 'approved'`
(migration `:89-100`). DELETE is deliberately _not_ blocked at the DB level
(comment `:86-88`, so S-04 retention can purge) — but **is** blocked by the
application, which scopes DELETE to `.eq("status","draft")`
(`api/admin/quotes/[id].ts:103`). So an approved row cannot be corrected or
removed by any code path that exists; fixing one means `psql` against
production. `inference`, high confidence.

What that changes:

| Ordinary code                                 | This flow                                                                                            |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| ship bug → fix → redeploy → users see the fix | every quote approved while the bug was live **keeps the bug forever**                                |
| bad data → run a backfill                     | the backfill is **blocked by a trigger**                                                             |
| a wrong number is a display bug               | a wrong number in `content.totals` **is the price the patient was quoted**, at a URL she already has |
| roll back the deploy                          | rolling back the Worker does not roll back a frozen row                                              |

Three concrete multipliers, each traceable:

- **A wrong price is permanent and already delivered.** The patient page reads
  the frozen `totals`; it never recomputes — no `.astro` file imports
  `@/lib/quote/cost` (verified by grep). Fixing `cost.ts` fixes new quotes only.
  `evidence` + `inference`
- **A `QuoteContent` shape change breaks old rows silently.** Adding a required
  field or renaming one makes historical blobs fail `safeParse` at
  `p/[token].astro:52` → 404 + the generic "Link nieaktywny lub nieprawidłowy"
  page. Nothing logs a distinguishable error, **by design** (FR-060). Combined
  with "CI does not run migrations", this is the exact failure mode that already
  hid a missing `quotes` table for three months. `inference`, high confidence —
  the single highest-cost change in the flow.
- **Even the test suite pays the tax.** Every run of
  `patient-link-content.spec.ts` permanently accretes an undeletable approved
  row in the live project (`test-plan.md` §6.3). That is _why_ rollout Phase 1
  is still `not started`. `evidence`

### D8 — Schema changes have no gate at all

**Evidence.** `.github/workflows/ci.yml` runs `npm ci`, `astro sync`, lint,
test, build and `wrangler deploy` — and no Supabase step.
`context/deployment/deploy-plan.md:37-60` says so explicitly and records that it
has already bitten once: the F-01 migration sat in the repo from June while the
hosted project had no `quotes` table, hidden because the patient page fails
closed into the same generic error for every cause. Applying it by hand also
required a separate `GRANT … to authenticated`.

---

---

## Verification of structural claims (ast-grep)

Every structural claim above — counts, "only here", "never imports X" — was
re-derived with `ast-grep 0.45.3` or, where a pattern could not express the
question, with `grep`. **Every zero returned by ast-grep was confirmed with a
plain grep before being believed**, because a pattern that fails to match looks
identical to a fact that is not there. One such false zero occurred and is
recorded below.

| Claim                                                                         | Verdict                          | Evidence                                                                                                                                                                                                 | Method                                                                                     |
| ----------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `QuoteEditor.tsx` never imports `quote-payload`                               | **confirmed**                    | 0 hits in `src/components/`                                                                                                                                                                              | `ast-grep -p 'import $$$A from "@/lib/services/quote-payload"'` + grep for the bare string |
| `quote-payload.ts` has exactly 4 dependents                                   | **confirmed**                    | `quote-payload.test.ts`, `api/admin/quotes/{index,approve,[id]}.ts`                                                                                                                                      | grep; note the test imports relatively, so an alias-only search under-counts to 3          |
| `QuoteContentSchema` validates stored content in only 2 places, both `.astro` | **confirmed**                    | `p/[token].astro:36`, `admin/quotes/[id].astro:33` (other hits are its declaration, an import line and two comments)                                                                                     | grep, hits classified by hand                                                              |
| No `.astro` file imports `@/lib/quote/cost`                                   | **confirmed**                    | 0 `.astro` hits; the only importers are `QuoteEditor.tsx` and `approve.ts`                                                                                                                               | grep over `--include='*.astro'`, then the complement                                       |
| The `jsonError` envelope helper is duplicated across endpoints                | **corrected: 3, not 4**          | `approve.ts:46`, `index.ts:25`, `[id].ts:25`                                                                                                                                                             | `ast-grep -p 'function jsonError($$$ARGS): Response { $$$ }'`                              |
| The Supabase client is created without the `Database` generic                 | **confirmed**                    | one `createServerClient` call, `src/lib/supabase.ts:9`, no type argument                                                                                                                                 | `ast-grep -p 'createServerClient($$$)'`                                                    |
| The quote-status enum exists in 3 places                                      | **confirmed**                    | `types.ts:26`, `admin/index.astro:34`, migration `:26`                                                                                                                                                   | grep for both quote styles                                                                 |
| `VisitSchema.label` has no `.max()`                                           | **confirmed**                    | `types.ts:120` — `label: z.string().default("")`, the only `label:` in the file                                                                                                                          | read + grep                                                                                |
| `token.ts` has zero imports                                                   | **confirmed**                    | `grep -c '^import'` → 0                                                                                                                                                                                  | grep                                                                                       |
| `PROTECTED_ROUTES` does not cover `/api/admin/...`                            | **confirmed**                    | `middleware.ts:4` `["/dashboard", "/admin"]`, matched at `:18` with `pathname.startsWith(route)`; `/api/admin/quotes/approve` starts with neither                                                        | read                                                                                       |
| Deleting `approve.ts:91` leaves `patient-link-content.spec.ts` green          | **confirmed as to its premises** | `VariantComparison.astro:29` and `:50` are both **outside** the `{cond && …}` blocks, so both `<h3>`s render unconditionally; `:44` is `standard?.grandTotal ? formatRangeHeadline(…) : formatAmount(0)` | read in full                                                                               |

**The false zero.** `ast-grep -p 'function jsonError($$$) { $$$ }'` returned
**0** matches. The helper exists three times; the pattern simply could not match
a declaration carrying a return-type annotation (`): Response {`). Adding the
annotation to the pattern returned the true count of 3. Had the zero been taken
at face value, this report would have claimed the error envelope was defined
once. That is the whole argument for the grep cross-check rule, met on the first
use of the tool.

**A note on the last row.** The mutation claim (delete line 91 → the spec still
passes) is not asserted here on the strength of having run it — no mutation was
introduced into the working tree. What was verified is every premise it rests
on: both headings unconditional, and the totals line falling back to
`formatAmount(0)` rather than failing. The conclusion follows from those and is
labelled `inference`, not `evidence`. Actually running the mutation would cost a
permanent, undeletable approved row in the production database (see D7), which
is a price this analysis did not need to pay.

## Code References

- `src/pages/api/admin/quotes/approve.ts:41-44` — `ApproveRequestSchema`; the e-mail is required here and nullish on drafts
- `src/pages/api/admin/quotes/approve.ts:91` — the totals freeze; deleting this line does not fail any test
- `src/pages/api/admin/quotes/approve.ts:97-119` — the UPDATE-draft branch, 409 included; wholly untested
- `src/pages/api/admin/quotes/approve.ts:98-100` — why `.select("id")` is load-bearing
- `src/lib/services/quote-payload.ts:61-66` — `QuotePayloadSchema`, the only real definition of the wire format
- `src/lib/services/quote-payload.ts:88-106` — `buildQuoteContent`, server-side re-resolution (FR-050)
- `src/components/admin/QuoteEditor.tsx:181-196` — `treePayload()`, the untyped producer side of the seam
- `src/middleware.ts:4,18` — `PROTECTED_ROUTES` does not cover `/api/admin/...`
- `src/types.ts:118-121` — `VisitSchema.label`, unbounded and patient-visible
- `src/pages/p/[token].astro:36,52` — the only anon read, and the `safeParse` that turns a shape change into a 404
- `supabase/migrations/20260603194110_quotes_foundation.sql:89-100` — the immutability trigger
- `supabase/migrations/20260603194110_quotes_foundation.sql:117-129` — `get_quote_by_token`, the four-column whitelist
- `e2e/patient-link-content.spec.ts:69-71` — the positive control that makes the e-mail assertion meaningful
- `e2e/patient-link-content.spec.ts:86-87,91-93` — the two assertions that are weaker than they look

## Architecture Insights

- **Structural enforcement beats convention, and this codebase mostly knows it.**
  The e-mail is kept off the patient path by having no slot for it, not by
  remembering to strip it. The price is authoritative because the id is the only
  thing that crosses the wire. Where the codebase relies on convention instead —
  the wire format itself — is exactly where the debt is.
- **The layering is honest and the graph is clean** (zero cycles, no island
  touching Supabase), which is _why_ the pure layer is cheaply testable and well
  tested. The untested part is untested because it is genuinely hard to test:
  everything on it imports `astro:env/server`, a virtual module that cannot be
  resolved outside the Astro build.
- **Fail-closed error handling hides operational faults.** FR-060 makes every
  patient-side failure look identical on purpose. That is right for a
  no-disclosure guarantee and it is also why a missing table went unnoticed for
  three months. The cost of the guarantee is that this flow needs _tests_
  precisely because it cannot afford _logs_.
- **Low churn is not low risk here.** `cost.ts`, `format.ts`, `labels.ts`,
  `tooth-name.ts` and `token.ts` have one commit each — written in June, never
  revised. The import graph says they are load-bearing on the patient render
  path. Stable and central at once.

## Historical Context (from prior changes)

- `context/archive/2026-09-04-admin-quote-list/reviews/plan-review.md:62` — the
  original finding that a Supabase update without `.select()` "answers 200 to an
  attempt to modify an approved quote". The fix is in the code; the test is not.
- `context/archive/2026-06-04-first-thin-quote-and-patient-link/` — where the
  approval transaction, the token and the patient link were built (`acd2320`).
- `context/foundation/test-plan.md` §2 risks #1–#4, §3 rollout Phase 1
  ("Approval boundary", `not started`), §5 (why e2e is outside CI), §6.3 (why
  approved test rows cannot be cleaned up).
- `context/deployment/deploy-plan.md:37-60` — migrations are manual; the
  three-month invisible outage.
- `context/map/repo-map.md` §4 R1/R2 — the risk zones that selected this flow.

## Open Questions

Carried forward as genuine **`unknown`**s, not as tasks:

1. **Does the deployed schema match the migration text?** Every DB guarantee in
   this document is read from SQL in the repo. The SQL probe that would confirm
   it is manual and explicitly not in CI, and the project has already had a
   three-month divergence between the two.
2. **Who owns `get_quote_by_token`?** `SECURITY DEFINER` runs as the function
   owner, and the owner is never set explicitly in the migration. The real
   definer privileges are therefore unverified.
3. **How do trigger and constraint violations surface through PostgREST?** The
   endpoint flattens every DB error to a bare 500 and nothing in the repo
   observes the shape, so the distinction between "constraint refused this" and
   "the network failed" is currently unobservable.
4. **Token expiry appears in a migration comment but exists nowhere** — not in
   the schema, not in the RPC, not in code. Either the comment is stale or the
   feature was dropped; the history does not say which.
5. **Is `PatientView` dead or aspirational?** It is derived from the generated
   types and referenced nowhere. Deleting it and regenerating types would answer
   whether anything was meant to consume it.
