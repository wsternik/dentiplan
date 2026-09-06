---
title: Anti-Corruption Layer — isolating Supabase behind a domain port
created: 2026-09-04
type: refactor-plan
---

# Anti-Corruption Layer

> A **plan**, not an implementation. No production code is modified by this
> document. Third artifact of the M4L5 series, after `01-domain-distillation.md`
> and `02-invariant-aggregate-refactor.md`.
>
> Every `file:line` below was verified against `main` at 2026-09-04.

## 1. Candidate leaking dependencies

External runtime dependencies, from `package.json`:

| Package                                           | Where it is known                                                                 | Leak?                                                                                                |
| ------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `@supabase/ssr`, `@supabase/supabase-js`          | see §2                                                                            | **the candidate**                                                                                    |
| `zod`                                             | `src/types.ts`, `src/lib/**`, all six API endpoints, three `.astro` pages         | **not a leak** — see below                                                                           |
| `astro` / `astro:env/server` / `astro:middleware` | `src/lib/supabase.ts`, `src/lib/config-status.ts`, `src/middleware.ts`, all pages | not a leak — Astro is the platform, not a swappable component; the PRD names no intent to replace it |
| `react`                                           | `src/components/**` only                                                          | not a leak — confined to the UI layer by a dependency-cruiser rule that passes                       |
| `clsx` / `tailwind-merge` (`cn()`)                | `src/components/**`                                                               | not a leak — presentation utility                                                                    |

**Why `zod` is not the leak, despite being the most widely imported package.**
Zod is used here as the _definition medium of the domain model itself_ —
`QuoteContentSchema`, `ToothStatusSchema` and their siblings in `src/types.ts`
are the domain vocabulary, not a mapping to a foreign system. An ACL exists to
stop a foreign model from distorting the domain model; there is no foreign model
behind Zod. Wrapping it would produce ceremony and no isolation. Recorded here
because "most imported" is the obvious wrong answer to this exercise.

## 2. The chosen leak: the Supabase client

### The naive success criterion already passes — and that is the trap

The prompt's own verification rule is "grep for the package name returns only
files in the ACL directory". Run it today:

```bash
grep -rn "@supabase" src --include='*.ts' --include='*.tsx' --include='*.astro'
# src/env.d.ts:3      user: import("@supabase/supabase-js").User | null;
# src/lib/supabase.ts:1  import { createServerClient, parseCookieHeader } from "@supabase/ssr";
```

**Two files.** By the letter of the criterion, Supabase is already isolated.
`src/lib/supabase.ts:5` exposes a single factory, `createClient(...)`, and
nothing else imports the vendor package.

It is not isolated. What escapes is not the _import_ but the _shape_: the
factory hands back a live Supabase client object, and **ten files then program
against Supabase's query-builder DSL.** The vendor's model has spread through
the codebase without its name ever appearing.

### Everything that knows the shape today

| File:line                                          | What it uses                                                                                               | Vendor concept exposed                                          |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `src/lib/supabase.ts:1,9`                          | `createServerClient`, `parseCookieHeader`                                                                  | the SDK itself — **legitimately, this is the intended adapter** |
| `src/env.d.ts:3`                                   | `import("@supabase/supabase-js").User` in `App.Locals`                                                     | **a vendor type in the app's global contract**                  |
| `src/middleware.ts:12`                             | `supabase.auth.getUser()`                                                                                  | auth SDK                                                        |
| `src/pages/api/auth/signin.ts:13`                  | `auth.signInWithPassword({email,password})`                                                                | auth SDK                                                        |
| `src/pages/api/auth/signup.ts:13`                  | `auth.signUp({email,password})`                                                                            | auth SDK                                                        |
| `src/pages/api/auth/signout.ts:7`                  | `auth.signOut()`                                                                                           | auth SDK                                                        |
| `src/pages/api/admin/quotes/approve.ts:61,102,121` | `auth.getUser()`; `.from("quotes").update(...).eq(...).eq(...).select(...)`; `.from("quotes").insert(...)` | query builder                                                   |
| `src/pages/api/admin/quotes/index.ts:39,66`        | `auth.getUser()`; `.from("quotes")…`                                                                       | query builder                                                   |
| `src/pages/api/admin/quotes/[id].ts:41,67,93,103`  | `auth.getUser()` ×2; `.from("quotes")…` ×2                                                                 | query builder                                                   |
| `src/pages/admin/index.astro:45`                   | `.from("quotes")…`                                                                                         | query builder **in a page**                                     |
| `src/pages/admin/quotes/[id].astro:42`             | `.from("quotes")…`                                                                                         | query builder **in a page**                                     |
| `src/pages/p/[token].astro:47`                     | `.rpc("get_quote_by_token", { p_token: token })`                                                           | **RPC name and parameter name, in a page**                      |

**Eleven files beyond the adapter**, across three layers: middleware, API
endpoints, and server-rendered pages.

### Score against the three axes

| Axis                                             | Assessment                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **(a) Layers and files touched**                 | 11 files, 3 layers. The worst of any dependency in the repo.                                                                                                                                                                                                                                  |
| **(b) Cost of replacing the library today**      | High, and — importantly — **not uniform**. The query-builder calls are mechanical to port; `.rpc("get_quote_by_token", …)` at `p/[token].astro:47` encodes a _database function name and parameter name_ in a rendering file. Postgres-specific concepts have reached the presentation layer. |
| **(c) Does any document claim it is swappable?** | **No — and this is the honest finding.** `context/foundation/tech-stack.md` and `prd.md` contain no "so we can swap the database" claim. There is no intent-vs-code drift here.                                                                                                               |

**So why refactor it at all?** Not for portability — nobody promised
portability, and inventing that requirement would be exactly the kind of
speculative generality this exercise should refuse. The argument is different
and, I think, stronger:

1. **It is the prerequisite the aggregate plan already needs.**
   `02-invariant-aggregate-refactor.md` §3 requires a `QuoteRepository`, because
   invariant I-1's enforcement is currently scattered across the same scoped
   `.eq("status","draft")` statements listed above. The ACL and the aggregate
   are the same refactor seen from two sides.
2. **It is what makes the flow testable.** Everything importing
   `src/lib/supabase.ts` transitively imports `astro:env/server`, a virtual
   module that cannot be resolved outside the Astro build. That is precisely why
   `approve.ts` has no unit tests
   (`context/archive/2026-09-04-quote-approval-flow-analysis/research.md` D2, R1). A narrow
   port is a seam a fake can be substituted at — the difference between "we did
   not write the test" and "the test cannot be written".
3. **Access rules are currently invisible.** The `quotes` table's real access
   contract — anon reads only through the RPC, `status='draft'` scoping on every
   mutation — is expressed as `.eq()` chains distributed across seven call
   sites. There is no file you can open to read the rule.

Testability, not portability, is the case. A plan that claimed otherwise would
be selling a benefit nobody asked for.

## 3. Diagnosis

**Duplication.** The same auth preamble is written out in five endpoints —
`approve.ts:56-64`, `index.ts:34-42`, `[id].ts:36-44` and `:88-96`, plus
`middleware.ts:7-16`:

```ts
const supabase = createClient(context.request.headers, context.cookies);
if (!supabase) return jsonError("Supabase nie jest skonfigurowany.", 500);
const {
  data: { user },
} = await supabase.auth.getUser();
if (!user) return jsonError("Wymagane zalogowanie.", 401);
```

This duplication is not stylistic. `src/middleware.ts:4` declares
`PROTECTED_ROUTES = ["/dashboard", "/admin"]`, which **does not match
`/api/admin/...`** — so this hand-copied preamble is the _only_ authentication
on the API surface, including on the single irreversible write in the product.
Five copies of the only guard, none of them tested.

**The vendor type in the global contract.** `src/env.d.ts:3` types
`App.Locals.user` as `@supabase/supabase-js`'s `User`. Every page and endpoint
reading `Astro.locals.user` therefore depends on a vendor type through a
declaration file — an invisible edge that no import graph shows.

**A server-only library in a client bundle?** No. `dependency-cruiser`'s
`components-not-to-supabase` and `components-not-to-astro-env` rules both pass
with zero violations: **no React island imports the client.** This is the one
dangerous form of leak that is genuinely absent, and it is why the islands are
unit-testable at all. Worth stating plainly, because it is the thing an ACL
review usually finds and this codebase got right.

**Database vocabulary in rendering files.** `p/[token].astro:47` names an RPC
and its parameter; `admin/index.astro:45` and `admin/quotes/[id].astro:42` build
queries. A page is deciding _how_ to fetch, not just _what_ it needs.

## 4. The design

### The port — narrow, and named in the domain's own words

```ts
// src/lib/domain/ports.ts — knows nothing about Supabase

export interface QuoteRepository {
  listForAdmin(): Promise<QuoteSummary[]>;
  loadDraft(id: string): Promise<Quote>; // throws QuoteNotFoundError
  loadForAdmin(id: string): Promise<Quote>;
  insertApproved(quote: Quote): Promise<void>;
  saveDraft(quote: Quote): Promise<void>;
  approveDraft(quote: Quote): Promise<void>; // 0 rows → QuoteAlreadyApprovedError
  deleteDraft(id: string): Promise<void>; // 0 rows → QuoteAlreadyApprovedError
}

/** The patient's read path. Deliberately a separate port: it is a different
 *  trust boundary, and its only implementation is one RPC call. */
export interface PatientQuoteReader {
  findByToken(token: string): Promise<PatientQuote | null>; // null = indistinguishable, per FR-060
}

/** Identity, in domain terms — not Supabase's User. */
export interface OperatorIdentity {
  currentOperator(): Promise<Operator | null>;
  signIn(email: string, password: string): Promise<Operator>; // throws InvalidCredentialsError
  signOut(): Promise<void>;
}

export interface Operator {
  readonly id: string;
  readonly email: string;
}
```

`Operator` is the ACL's core value object: a two-field domain type replacing a
vendor `User` with ~20 fields, none of which this product uses. Nothing outside
the adapter learns that identity comes from Supabase.

### The adapter

```ts
// src/lib/infra/supabase/quote-repository.ts
// The ONLY file that may name @supabase/*, "quotes", or "get_quote_by_token".

export class SupabaseQuoteRepository implements QuoteRepository {
  constructor(private readonly db: SupabaseClient) {}

  async approveDraft(quote: Quote): Promise<void> {
    // One statement. `.eq("status","draft")` makes an approved row unmatchable;
    // `.select("id")` is what makes a zero-row match observable at all.
    const { data, error } = await this.db
      .from("quotes")
      .update(quote.toApprovedRow())
      .eq("id", quote.id)
      .eq("status", "draft")
      .select("id");
    if (error) throw new PersistenceError(error.message);
    if (data.length === 0) throw new QuoteAlreadyApprovedError(quote.id);
  }
  // …
}

// src/lib/infra/supabase/patient-quote-reader.ts
export class SupabasePatientQuoteReader implements PatientQuoteReader {
  async findByToken(token: string): Promise<PatientQuote | null> {
    const { data, error } = await this.db.rpc("get_quote_by_token", { p_token: token });
    if (error || !data?.length) return null; // fail closed — FR-060
    const parsed = PatientRowSchema.safeParse(data[0]);
    return parsed.success ? toPatientQuote(parsed.data) : null;
  }
}
```

Two decisions are **moved into the ACL, out of the API layer**, which is where
the prompt asks for them:

- **Fail-closed mapping.** Today `p/[token].astro` decides that an RPC error, an
  empty result and a schema-parse failure all become the same generic page. That
  is a real domain decision (FR-060 no-disclosure) currently expressed as
  control flow in a template. It belongs in `findByToken`, returning `null` for
  every cause.
- **Zero-rows-means-conflict.** The `.select("id")` reasoning — today a comment
  above a query, repeated in three files — becomes one line of adapter code with
  a named error and a test.

### Where the pieces live

```
src/lib/domain/     ports.ts, quote.ts, errors.ts        — no vendor imports, ever
src/lib/infra/supabase/  client.ts (today's supabase.ts), quote-repository.ts,
                         patient-quote-reader.ts, operator-identity.ts
src/pages/**        parse input → call a port → map domain errors to responses
```

## 5. Proof of isolation

**Files that know Supabase today (12) → after (4).**

| File                                                     | Today                           | After                                                   |
| -------------------------------------------------------- | ------------------------------- | ------------------------------------------------------- |
| `src/lib/supabase.ts`                                    | client factory                  | **stays** (moves to `src/lib/infra/supabase/client.ts`) |
| _new_ `infra/supabase/quote-repository.ts`               | —                               | **knows** the query builder and the table name          |
| _new_ `infra/supabase/patient-quote-reader.ts`           | —                               | **knows** the RPC name and parameter                    |
| _new_ `infra/supabase/operator-identity.ts`              | —                               | **knows** the auth SDK                                  |
| `src/env.d.ts`                                           | vendor `User` type              | `Operator`                                              |
| `src/middleware.ts`                                      | `auth.getUser()`                | `identity.currentOperator()`                            |
| `src/pages/api/auth/{signin,signup,signout}.ts`          | auth SDK ×3                     | `identity.*`                                            |
| `src/pages/api/admin/quotes/{approve,index,[id]}.ts`     | query builder + auth            | ports only                                              |
| `src/pages/admin/index.astro`, `admin/quotes/[id].astro` | query builder                   | `repo.listForAdmin()`, `repo.loadForAdmin(id)`          |
| `src/pages/p/[token].astro`                              | `.rpc(...)` + fail-closed logic | `reader.findByToken(token)`                             |

**Success criterion, restated so it is not trivially satisfiable.** The package
grep already passes today, so it is worthless alone. The real test is three
greps that must return **only** `src/lib/infra/supabase/`:

```bash
grep -rn "@supabase"            src --include='*.ts' --include='*.tsx' --include='*.astro'
grep -rn '\.from("quotes")'     src --include='*.ts' --include='*.astro'
grep -rn 'get_quote_by_token'   src --include='*.ts' --include='*.astro'
```

Enforceable mechanically, as a dependency-cruiser rule added **after** the code
already satisfies it:

```
{ name: "only-infra-knows-supabase",
  from: { pathNot: "^src/lib/infra/supabase" },
  to:   { path: "^src/lib/infra/supabase/client\\.ts$" } }
```

**What swapping the database would then touch:** three adapter files, and the
migration. Not the tables' meaning, not the API responses, not one line of UI.
**What it would still touch, honestly:** RLS policies and the SECURITY DEFINER
RPC are Postgres features that carry real guarantees (`01` §3, I-3 and I-5). An
ACL isolates the _client_, never the _guarantees_. A move to a store without
row-level security would require re-earning those in application code, and no
amount of interface hygiene changes that.

## 6. Phases

Consistent with `02`'s phasing and with this project's convention of small,
independently revertible commits.

| Phase  | What                                                                                                                                                                                                                                | Verification                                                            |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **A1** | Characterization tests first — same suite as `02` P1. Nothing to isolate safely without them.                                                                                                                                       | suite green against unchanged code                                      |
| **A2** | `Operator` + `OperatorIdentity`; migrate `env.d.ts` and the five duplicated auth preambles. Self-contained and high value: it removes the vendor type from the global contract and de-duplicates the only guard on the API surface. | `npm test`, `astro check`, `npm run build`                              |
| **A3** | `PatientQuoteReader`. The narrowest port, one call site, and it moves the fail-closed decision into the ACL.                                                                                                                        | full suite + one manual `/p/<token>` check (read-only, creates no data) |
| **A4** | `QuoteRepository` for the admin write paths — the same object `02` P4 needs. Do it once, for both plans.                                                                                                                            | A1 green + a manual run of `supabase/tests/quotes_foundation_probe.sql` |
| **A5** | Migrate the two admin `.astro` pages off the query builder.                                                                                                                                                                         | full suite + `npm run depcruise`                                        |
| **A6** | **Enforcement, as its own commit**, after the code already complies: add `only-infra-knows-supabase`, and wire `npm run depcruise` into CI.                                                                                         | `npm run depcruise` green, then CI green                                |

**A6 is deliberately last and deliberately separate.** `npm run depcruise`
cannot join CI at all until the existing `lib-not-to-components` violation is
cleared, which is the small change being planned separately in
`context/changes/refactor-opportunities/plan.md`. That is the concrete link
between today's one-phase step and this larger target: the small refactor is
what makes the gate usable, and the gate is what keeps this ACL from eroding.

## 7. Limits

- **This plan is not scheduled.** It is the target shape, recorded so smaller
  steps aim at it. Executing A1–A6 is out of scope for the current change.
- **The portability benefit is real but is not the argument.** No document
  promises a swappable database, and this plan does not pretend one does. The
  case is testability, a single home for the access rules, and the repository
  the aggregate plan needs anyway.
- **An ACL cannot isolate RLS or the SECURITY DEFINER RPC** — §5 says so
  explicitly rather than letting the "proof of isolation" imply more than it
  proves.
- The one question this plan opened, it also closed: `App.Locals.user` is read in
  exactly three places, all in `src/middleware.ts` (`:13`, `:15`, `:19`), and all
  three are assignments or a truthiness check — **no field of the vendor `User`
  is ever read anywhere in the codebase**. So A2 is smaller than it looks: the
  vendor type in `env.d.ts:3` is carrying ~20 fields for a null check.
