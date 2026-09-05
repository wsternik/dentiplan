<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: LLM prefill from the diagnosis note

- **Plan**: `context/changes/llm-parsing-prefill/plan.md`
- **Scope**: all four phases
- **Date**: 2026-09-05
- **Verdict**: NEEDS ATTENTION → APPROVED (after fixes)
- **Findings**: 0 critical, 3 warnings, 3 observations (plus 4 from the pipeline's review agent on the PR — see the tail of this file)

## Verdicts

| Dimension           | Verdict | After fixes |
| ------------------- | ------- | ----------- |
| Plan Adherence      | PASS    | PASS        |
| Scope Discipline    | PASS    | PASS        |
| Safety & Quality    | WARNING | PASS        |
| Architecture        | PASS    | PASS        |
| Pattern Consistency | PASS    | PASS        |
| Success Criteria    | PASS    | PASS        |

## Success criteria re-run

| Check                                               | Result                                |
| --------------------------------------------------- | ------------------------------------- |
| `npm run lint`                                      | exit 0                                |
| `npx astro check`                                   | 0 errors, 0 warnings (91 files)       |
| `npm test`                                          | 50 passed (was 40 before this change) |
| `npm run depcruise`                                 | 0 violations, 104 modules             |
| `npm run build`                                     | Complete                              |
| `npm run validate:pricing`                          | seed round-trip ok                    |
| `npm run test:e2e`                                  | 4/4 passed                            |
| `git diff main...HEAD -- e2e/ playwright.config.ts` | empty — specs untouched               |

Every Manual row in `## Progress` was verified by an observable check, not
asserted: 2.6–2.10 by `curl` against the workerd dev server (including with the
key removed), 3.5–3.9 by driving the real UI in Chromium.

## Findings

### F1 — The same tooth twice in one answer produced two rows with one React key

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/lib/llm/parse-diagnosis.ts:62` (mapper loop)
- **Detail**: `mapParsedDiagnosis` deduped nothing within a single answer, and
  `applyPrefill`'s `existing` set was built from the pre-prefill tree only. A
  note that mentions tooth 16 under two headings — a normal way to write one —
  gets it back twice. Reproduced directly: the mapper returned `[16, 16]` with
  no warning, and the editor renders rows with `key={tooth.number}`
  (`QuoteEditor.tsx:543`), so that is two rows sharing a React key and one tooth
  billed twice in both cost variants.
- **Fix**: dedupe by number inside the mapper — first reading wins, second is
  named in a warning. Same for repeated general-item ids.
  - Strength: the mapper is the pure, tested layer, so the fix is covered by a
    test rather than by a click; and it protects the endpoint's contract, not
    just this one caller.
  - Tradeoff: none — merging two contradictory readings would invent a third.
  - Confidence: HIGH — reproduced before and after.
- **Decision**: FIXED — test added (`risk #7: the same tooth proposed twice…`).

### F2 — `applyPrefill` read the tree from a closure that a 30-second round trip can outdate

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/components/admin/QuoteEditor.tsx` — `applyPrefill`, the
  `existing` / `offset` / `presentItems` computations
- **Detail**: `inFlight` blocks the three server-writing actions against each
  other, but nothing stops the dentystka using the ordinary form controls while
  a prefill is in flight — and `TIMEOUT_MS` is 30s, so that window is real, not
  theoretical. `applyPrefill` runs after the `await` and read `teeth`, `visits`
  and `generalItems` from the render closure, i.e. the tree as it was when she
  pressed the button. Two consequences: a tooth she typed in the meantime is not
  recognised as a duplicate (back to F1's duplicate key, this time from a live
  `setTeeth` functional update that does see it), and a visit she added shifts
  the numbering that prefilled teeth are remapped onto, landing them on the
  wrong visit.
- **Fix**: mirror the working tree into a ref kept current by `useEffect`, and
  have `applyPrefill` read that instead of the closure.
  - Strength: fixes all three stale reads with one mechanism, keeps the form
    usable during the wait, and avoids side effects inside state updaters (which
    React may invoke twice).
  - Tradeoff: one more ref to keep in sync; the `useEffect` must list all three
    dependencies or it silently goes stale again.
  - Confidence: HIGH — the standard latest-value pattern; re-verified in the
    browser afterwards.
  - Blind spot: not reproduced as an automated test — it needs a manual edit
    inside a live request window, which is exactly the thing this slice
    deliberately does not e2e.
- **Decision**: FIXED

### F3 — `LLM_MODEL` declared but not documented

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `.env.example`, `.dev.vars.example`
- **Detail**: The plan's Phase 2 listed both example files under "Declare the key
  and the model override", and only `ANTHROPIC_API_KEY` was added. The override
  exists and works; nobody reading the example files would know.
- **Fix**: add `LLM_MODEL=claude-sonnet-5` to both — the real default, so copying
  the file gives working behaviour rather than a placeholder that 502s.
- **Decision**: FIXED

### F4 — A provider failure is reported but not diagnosable

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/pages/api/admin/quotes/parse.ts` — the `catch` around `parseDiagnosis`
- **Detail**: A timeout, a revoked key, a bad `LLM_MODEL`, a schema-validation
  failure and an Anthropic outage all produce the same 502 and no server-side
  record. The error IS propagated — the caller can tell it failed, which is what
  the M3L5 audit was about — but nothing distinguishes the causes afterwards.
  This matches the existing convention exactly (the repo has zero `console.*`
  calls and every sibling endpoint uses a bare `catch`), so it is not a
  regression; it is the first place a **billable third party** can fail silently.
- **Decision**: SKIPPED — deliberately. Adding the project's first logging call
  inside this slice would set an observability convention as a side effect of a
  feature, and `infrastructure.md` already records that observability is out of
  scope for the MVP. It belongs in a change of its own, with a decision about
  where logs go.

### F5 — No rate limit on a paid endpoint

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/pages/api/admin/quotes/parse.ts`
- **Detail**: The 4000-character cap bounds cost per call, not calls per minute.
  `inFlight` is client-side and trivially bypassed by hitting the endpoint
  directly. Any authenticated user could loop it at Anthropic's expense.
- **Decision**: SKIPPED — the app has exactly one operator and no rate limiting
  anywhere (roadmap S-05 `auth-hardening` owns that whole subject, including
  credential stuffing). Cost control for this key belongs on the Anthropic
  account as a spend cap, which is the right place for it — a per-user limit in
  a single-user app protects nothing a spend cap does not. Revisit with S-05 or the second operator, whichever comes first.

### F6 — Two status codes for "this integration is not configured"

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/pages/api/admin/quotes/parse.ts` (503 for Anthropic, 500 for Supabase)
- **Detail**: Unconfigured Supabase returns 500 across all admin endpoints;
  unconfigured Anthropic returns 503 here.
- **Decision**: DISMISSED — the difference is the point. Missing Supabase means
  the request cannot be served at all; missing Anthropic means one optional
  feature is off while the endpoint is otherwise healthy, and 503 is what lets
  the panel say "the button is off" rather than "something broke". Aligning them
  would mean making the more accurate one worse.

## What the review confirmed rather than found

Recorded because "no findings" in these areas is a result, not an omission:

- **The `note` decision holds structurally.** `ParsedDiagnosisSchema` has no such
  field and the mapper hardcodes `note: ""`, so no prompt change and no model
  behaviour can put model-written text on the patient's page.
- **Nothing rendered from the model is HTML.** No `dangerouslySetInnerHTML` and
  no `set:html` anywhere in `src/`; the warnings — the one place free model text
  surfaces — go through JSX interpolation and are admin-only anyway.
- **Prompt injection is bounded by the same wall as everything else.** A note
  carrying instructions can at worst make the model propose rubbish, and every
  proposal still has to survive FDI and catalog validation and then be approved
  by a human. It can pollute the review, not the record.
- **The secret cannot reach the client.** Declared `access: "secret"`, read only
  in `client.ts`, passed straight to `createAnthropic`, never logged or returned;
  `parse-diagnosis.ts` keeps `client.ts` out of its runtime graph with a
  type-only import.
- **`timeout` and `maxRetries` are used as the installed SDK defines them** —
  checked against `node_modules/ai/dist/index.d.ts`, not from memory.
- **Scope held.** No committed e2e for the prefill, no persisted `rawText`, no
  existing DOM role, label or button text changed, and every file in the diff
  maps to a plan phase.

## Follow-up: the pipeline's review agent on PR #6

`.github/workflows/review.yml` ran its own pass and returned **NEEDS ATTENTION**
with four findings. It scored the parsing boundary well (9/10 on fit, 8/10 on
the patient page) and put both its major findings on the same criterion — _tests
proportional to risk_. It was right on both, and both are now fixed.

### R1 — The banner gate shipped without a regression test

> "The fix that keeps the new Anthropic config banner off `/p/<token>` (exactly
> the class of leak finding F2 already caught once) has no test, so a future edit
> that drops `adminOnly` or the `Astro.locals.user` branch would regress
> silently."

Fair, and the reason it had no test was itself worth fixing: `config-status.ts`
imports `astro:env/server`, which Astro generates at build time and Vitest cannot
resolve — the same wall the plan review hit in F2. `vitest.config.ts` now aliases
that module to `test/astro-env-stub.ts`, which unblocks testing anything that
reads configuration, and `src/lib/config-status.test.ts` asserts the list an
anonymous visitor gets can never carry an admin-only status.

**Decision**: FIXED.

### R2 — The client-side merge was only covered through the pure mapper

> "The client-side merge logic — deduping prefilled teeth/general items against
> the live tree and remapping visit numbers by an offset — is new and non-trivial
> but is only exercised through the pure `mapParsedDiagnosis` tests, which never
> touch a pre-populated tree or the offset arithmetic."

Also right, and pointed at exactly the code that produced this review's own F1
and F2. Extracted to `src/lib/llm/merge.ts` as `mergePrefill(tree, prefill, seed)`
— a pure function of the tree and the answer — with five tests covering the cases
the defects came from: a tooth she already filled in is kept untouched, prefilled
visit numbers are remapped onto the visits they actually became, general items
dedupe by pricelist id, and the server's warnings are carried through alongside
the merge's own. `applyPrefill` is now six lines that hand it the current tree.

**Decision**: FIXED. This is the better shape regardless of the finding: the
merge had already produced two defects that only a human looking at a screenshot
caught.

### R3 — No rate limit on a paid endpoint

Same as F5 above. **Decision**: SKIPPED, same reasoning — one operator, S-05
owns rate limiting, and a spend cap on the account is the control that actually
bounds this.

### R4 — The endpoint's own branches are untested

> "401 unauthenticated, 503 unconfigured key, 400 malformed body, 502 provider
> failure are untested; only the pure mapping function underneath is covered."

**Decision**: SKIPPED. All four were verified by hand against the workerd dev
server and recorded in Progress (2.6–2.9), and the endpoint is a thin composition
of pieces that are each tested. Automating them means an HTTP-level harness this
project does not have — `test-plan.md` §3 already carries "Approval boundary" and
"Access boundary" as pending integration phases, and that harness belongs to
whichever of those goes first, not to this slice as a side effect.

**Suite after these fixes: 59 tests, up from 40 before this change.**
