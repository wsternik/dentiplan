# First Thin Quote & Patient Link (S-01) — Plan Brief

> Full plan: `context/changes/first-thin-quote-and-patient-link/plan.md`

## What & Why

S-01 is DentiPlan's north star: the first real end-to-end path proving the product hypothesis. A logged-in dentystka manually builds a quote in a protected `/admin` editor, sees both cost variants (standard multi-visit vs. single-session anesthesia) live, and approves — producing a copyable `/p/<token>` link that shows the patient both variants side-by-side. Without this path the side-by-side-as-sales-tool hypothesis is unproven; every other slice adds conditional value on top of it.

## Starting Point

The two foundations are done and archived. **F-01** gives a `quotes` table (single JSONB `content`, draft/approved, immutable-on-approval trigger, deny-by-default RLS, a `SECURITY DEFINER` `get_quote_by_token` RPC with FR-060 no-disclosure baked in) and the full `QuoteContent` Zod type tree in `src/types.ts`. **F-02** gives the `@/lib/pricing` API: `resolvePricelistItem(id)`, picker list helpers, the anesthesia fee schedule, and a `localAnesthesia` flag. Token generation, cost math, snapshot-freezing, and all UI were explicitly left to S-01. The scaffold has Astro SSR + React islands, Supabase auth + middleware, but only a `button` shadcn component and no test runner.

## Desired End State

A dentystka signs in, builds a complete quote with live two-variant totals, and approves it in one session, getting a copyable patient link. Opening that link in a fresh browser renders the patient view — grouped teeth, deferred + scenario sections, side-by-side variants (anesthesia recommended), range-friendly pricing, non-dismissible disclaimer, zero PII. Unknown/draft tokens render a generic "Link nieaktywny lub nieprawidłowy" page. Approved quotes are immutable.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Admin scope | Single new-quote→approve→link flow, no list | S-01's FR refs exclude FR-070/071/072 (list + email = S-03) | Plan |
| Draft persistence | Client-side state until approve; one INSERT as `approved` | No list to resume from; "abandon without trace" is automatic | Plan |
| Form architecture | One React island owns the whole `QuoteContent` tree | Live cross-cutting totals become a pure derivation | Plan |
| Cost engine | Pure shared module, used by editor preview **and** server freeze | No drift between previewed and immutably-frozen money | Plan |
| Raw-text textarea | Present but not persisted (scratch) | FR-010 affordance without leaking text into patient-visible `content` | Plan |
| Tooth entry | Type/paste FDI numbers → rows | Matches the real workflow; same entry point S-02 will prefill | Plan |
| Patient range UX | Single headline figure + "od X zł", increases in Scenariusze | FR-026 Socrates resolution (avoid min–max clutter) | PRD/Plan |
| Anesthesia +100 count | Per in-plan ToothEntry (not per procedure) | Matches FR-041–044 "teeth in the anesthesia plan" | PRD/Plan |
| Testing | Add Vitest; unit-test the cost module | Highest-risk math frozen immutably needs a regression net | Plan |
| Validation | Essential guards only (range/dup warnings, empty/unpriced block) | Fits FR-012 + single-trusted-operator model | Plan |

## Scope

**In scope:** protected `/admin` new-quote editor; manual tooth/visit/general-item entry; live two-variant cost engine (ranges, modifiers, anesthesia fee, auto-skip); irreversible approval (snapshot freeze + crypto token + immutable insert); copyable link; public `/p/<token>` patient view with no-disclosure + noindex.

**Out of scope:** quote list / open-from-list / email storage (S-03); LLM parsing (S-02); draft persistence; retention/expiry (S-04); auth hardening (S-05); pricelist-editing UI; tooth-arch SVG, drag-drop, patient CTAs (v2); automated email.

## Architecture / Approach

Inside-out build. A pure `src/lib/quote/cost.ts` (`QuoteContent → QuoteTotals`) is the single money source, called by the editor island for live preview and by the approval API route to freeze authoritative totals. The `QuoteEditor` island holds all state; approval POSTs items **by pricelist id**, and the server calls `resolvePricelistItem(id)` to embed frozen snapshots, computes totals, generates a `crypto.getRandomValues` token, and INSERTs one `approved` row (never an UPDATE — that would trip the immutability trigger). The patient page SSR-renders the frozen `content` via the existing RPC.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Cost engine + Vitest | Pure two-variant calculator + unit tests | Range/modifier/fee-tier math correctness |
| 2. Admin shell + editor island | Protected `/admin` editor with live totals | Stateful form complexity; picker disambiguation |
| 3. Approval + token + link | Server freeze, crypto token, immutable insert, link | Server-authoritative snapshot; INSERT-as-approved |
| 4. Patient page `/p/<token>` | Public side-by-side view, no-disclosure, noindex | FR-060 no-disclosure; zero PII; range UX |

**Prerequisites:** F-01 + F-02 (done). Logged-in dentystka account exists. Local Supabase running for manual verification.
**Estimated effort:** ~3–4 sessions across 4 phases.

## Open Risks & Assumptions

- **FR-041 medical assumption** (auto-skip all `localAnesthesia` items in narkoza) is implemented per spec but awaits dentystka confirmation before showing real patients (roadmap Open Q).
- Client-side-only draft means a mid-edit browser refresh loses work — accepted for S-01 (no list to resume from).
- Mixed-dentition signaling and the "Odroczone" label use PRD defaults (Open Q #4/#5), non-blocking and easily changed.
- The raw-text textarea must never enter the approval payload — enforced structurally so it can't leak into patient-visible `content`.

## Success Criteria (Summary)

- Dentystka completes paste→fill→approve→link in one session; totals match her preview and the frozen snapshot.
- Patient link renders both variants correctly with disclaimer and no PII; unknown/draft tokens give an indistinguishable generic error.
- `npm run test` (cost engine), `npm run build`, `npm run lint` all pass.
