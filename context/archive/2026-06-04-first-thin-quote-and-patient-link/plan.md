# First Thin Quote & Patient Link (S-01) Implementation Plan

## Overview

S-01 is DentiPlan's north-star slice: the first real end-to-end path that proves the product hypothesis. A logged-in dentystka opens a protected `/admin` new-quote editor, manually fills a quote (per-tooth treatment, statuses, pricelist items, visits, general items), sees both cost variants (standard multi-visit vs. single-session anesthesia) computed live, and clicks **Zatwierdź**. Approval freezes a pricelist snapshot, computes authoritative totals, generates a cryptographic token, and writes one immutable `approved` row. She gets a copyable `/p/<token>` link; opening it shows the patient a quadrant-grouped tooth list, an "Odroczone" section, a "Scenariusze, które mogą zmienić koszt" section, a side-by-side variant comparison (anesthesia marked recommended), and a non-dismissible estimate disclaimer.

This is the broadest slice in the roadmap by design — splitting it further (admin-only / patient-only) would produce sub-slices whose individual completion proves nothing (a link to a 404, or a patient page rendering a mock). The work is divided internally into four phases below, not as separate roadmap slices.

## Current State Analysis

The two foundations this slice depends on are complete and archived; they leave S-01 a clean contract.

**F-01 — schema & types (`supabase/migrations/20260603194110_quotes_foundation.sql`, `src/types.ts`):**

- Single `quotes` table: `id` (uuid), `patient_type` (`child`/`adult`), `status` (`draft`/`approved`, default `draft`), `token` (text, nullable, unique partial index where not null), `patient_email` (nullable — unused in S-01), `content` (jsonb, default `{}`), `created_at`, `approved_at` (nullable). Check constraints: approved rows must have non-null `token` and `approved_at`.
- RLS: deny-by-default; `authenticated` role has full CRUD (`using (true)`); `anon` has **no** table policies.
- Patient read path: `get_quote_by_token(p_token text)` — `SECURITY DEFINER`, returns only `id, patient_type, content, created_at` for rows where `token = p_token and status = 'approved'`. Unknown/draft tokens return zero rows (FR-060 no-disclosure). Granted to `anon, authenticated`.
- Immutability: `BEFORE UPDATE` trigger `quotes_immutable` raises if `OLD.status = 'approved'`. INSERT and the draft→approved UPDATE are allowed; DELETE is not guarded (S-04).
- `src/types.ts` exports the full content contract as Zod schemas + inferred types: `QuoteContentSchema` (`teeth: ToothEntry[]`, `visits: Visit[]`, `generalItems: GeneralItem[]`, `totals?: QuoteTotals`), enums `QuoteStatus`/`PatientType`/`ToothStatus`/`TreatmentType`/`Urgency`, `dentitionForTooth(n)` (51–85 = milk else permanent), `PriceValue` (4-kind union), `PricelistItemRef`, `CostRange`, `QuoteTotals`, row type `Quote`, RPC return type `PatientView`.

**F-02 — pricelist seed (`src/lib/pricing/`, barrel `@/lib/pricing`):**

- `resolvePricelistItem(id) → PricelistItemRef` (frozen snapshot: `id`, `name`, `price: PriceValue`, `localAnesthesia: boolean`); throws on unknown id.
- `listToothItems()`, `listGeneralItems()`, `listByCategory()` (returns categories for a disambiguated picker — **item names are not globally unique**, must disambiguate by category/id), `findItemById(id)`.
- `ANESTHESIA_FEE_SCHEDULE`: `{ baseMilk: 1400, basePermanent: 2000, perExtraTooth: 100, includedTeeth: 5 }`.
- Price kinds: `fixed {amount}`, `range {min,max}`, `modifier {amount}` (**additive surcharge — not a standalone line**), `from {amount}` (reserved, unused).
- `localAnesthesia: true` flags items auto-skipped in the anesthesia plan (FR-041); today only the 50 zł local-anesthesia injection carries it.
- Verified by `npm run validate:pricing` (load-time Zod + completeness guards). No general-purpose test runner exists yet.

**Scaffold (`src/`):**

- Astro 6 SSR (`output: "server"`) + React 19 islands (`client:load`), Tailwind 4, shadcn/ui ("new-york"). Only `src/components/ui/button.tsx` exists.
- `src/lib/supabase.ts` → `createClient(headers, cookies)` (anon key, returns null if env missing).
- `src/middleware.ts` → `PROTECTED_ROUTES = ["/dashboard"]`, `startsWith` match, sets `context.locals.user`.
- API route pattern (`src/pages/api/auth/signin.ts`): `export const POST: APIRoute = async (context) => {…}`, `createClient(context.request.headers, context.cookies)`, redirect-with-error convention.
- `src/layouts/Layout.astro` (takes `title`, renders `<slot />`), `cn()` in `src/lib/utils.ts`, global tokens in `src/styles/global.css`.
- Env via `astro:env/server`; path alias `@/* → ./src/*`.

### Key Discoveries:

- **S-01's PRD refs exclude FR-070/071/072** — the quote list, open-from-list, and patient-email storage are S-03. S-01's `/admin` is a single new-quote→approve→show-link flow with no browsable list (`context/foundation/roadmap.md:97`).
- **`content` is returned verbatim to `anon`** by `get_quote_by_token` (`docs/reference/contract-surfaces.md`). Anything written into `content` is patient-visible — the raw diagnosis text and any internal-only data must never go there.
- **The immutability trigger guards UPDATE, not INSERT** (`…quotes_foundation.sql:89`). Approval is a single INSERT of an already-`approved` row (token + `approved_at` + frozen `content` set atomically), which satisfies the `quotes_approved_has_token` / `quotes_approved_has_timestamp` constraints and never trips the trigger.
- **`QuoteTotals` already models the frozen shape** (`src/types.ts`): `standard.perVisit[]`, `standard.grandTotal?`, `anesthesia.fee`, `anesthesia.total` — the cost module's output type is pre-defined.
- **`modifier` prices are add-ons** — `src/types.ts` comments explicitly assign the per-tooth/patient summation semantics to S-01; F-02 only resolves the variant verbatim.
- **No test runner** — F-02 used a bespoke `validate:pricing` script; S-01 introduces Vitest (user decision) for the cost module.

## Desired End State

A dentystka can sign in, navigate to `/admin`, manually build a complete quote with live two-variant cost preview, and approve it in one session. Approval produces a copyable `/p/<token>` URL. Opening that URL in a fresh browser renders the patient view (both variants side-by-side, anesthesia recommended, grouped teeth, deferred + scenario sections, prominent disclaimer, zero PII). An unknown or draft token renders a generic "Link nieaktywny lub nieprawidłowy" page. Approved quotes are immutable; editing means a new quote with a new token.

**Verification:** `npm run build` passes; `npm run test` (new Vitest) passes the cost-engine suite; `npm run lint` passes; manual walkthrough of the full flow in two browsers produces a working link and correct totals matching hand-computed worked examples.

## What We're NOT Doing

- **No quote list, open-from-list, or read-only re-open of approved quotes** (FR-070/071 → S-03).
- **No patient-email field / storage** (FR-072 → S-03).
- **No LLM parsing / prefill** (FR-011/012 auto-parse → S-02). The raw-text textarea exists but is a non-persisted scratch field; FR-012-style warnings in S-01 apply only to manual tooth-number entry.
- **No draft row persistence** — the working quote lives in client state until approval; nothing is written for abandoned work (no list to resume from anyway).
- **No retention/expiry** (S-04). Tokens never expire in S-01.
- **No auth hardening** beyond the existing scaffold (session timeout, rate limiting → S-05).
- **No pricelist-editing UI** (v2; F-02 seed is the source).
- **No graphical tooth-arch SVG, no drag-and-drop visits, no patient CTAs** (v2 per PRD Non-Goals).
- **No automated email/link delivery** — the dentystka copies the link manually (FR-052).

## Implementation Approach

Build inside-out: the pure cost engine first (highest-risk math, fully testable with no UI), then the editor that consumes it for live preview, then the approval transaction that re-runs it server-side to freeze authoritative totals, then the patient view that renders the frozen result. A single `QuoteEditor` React island owns the whole `QuoteContent` tree in state so cross-cutting totals are a pure derivation. The same `src/lib/quote/cost.ts` module powers both the live preview and the server-side freeze, guaranteeing the dentystka sees exactly the number that gets immutably stored.

## Critical Implementation Details

- **Patient-safe `content` invariant.** `content` is returned verbatim to anonymous callers. The approval handler must write into `content` only the patient-safe tree (`teeth`, `visits`, `generalItems`, `totals`) — never the raw diagnosis text, never email, never internal scratch. The raw-text textarea is held in island state and dropped on submit; it is never part of the POST payload's `content`.
- **Approval is INSERT-as-approved, single statement.** Set `status='approved'`, `token`, `approved_at=now()`, and frozen `content` in one INSERT. Do not INSERT a draft then UPDATE — the second write would either be redundant or (post-approval) trip `quotes_immutable`.
- **Snapshot freeze happens server-side at approval.** The island sends tooth/general items by pricelist `id` (+ user-entered note/status/etc.); the server calls `resolvePricelistItem(id)` for each to embed the current `PricelistItemRef` by value (FR-050). Trusting client-sent prices would let a buggy/tampered client freeze wrong money into an immutable patient quote.
- **Token entropy.** Generate with `crypto.getRandomValues` over ≥16 bytes (128 bit) and encode URL-safe (base64url or hex). The Workers runtime exposes Web Crypto globally; do not use a DB sequence or `Math.random`.
- **Cost module must be pure.** No DOM, no IO, no Astro/React imports — it runs in both the browser island and the Workers request handler. Inputs: `QuoteContent` + `ANESTHESIA_FEE_SCHEDULE`. Output: `QuoteTotals`.
- **Patient page must not be indexable, and the token must not leak.** The public route needs `<meta name="robots" content="noindex,nofollow">`. No sitemap exclusion is required: `@astrojs/sitemap` only enumerates build-time-known routes, and `/p/[token]` is an SSR dynamic route with no `getStaticPaths`, so a `/p/<token>` URL can never appear in the generated sitemap — `noindex` is the real lever. Because the token in the URL is a capability secret, also set `Referrer-Policy: no-referrer` (meta tag or response header) on `/p/[token]` so the token can't leak via the `Referer` header on any outbound request from the page.

---

## Phase 1: Cost engine + Vitest

### Overview

Build the pure two-variant cost calculator and lock it down with unit tests. This is the highest-risk logic (range math, modifier add-ons, anesthesia fee tiers, auto-skip) and has no UI dependency, so it is built and verified first. Its output type (`QuoteTotals`) and the inputs (`QuoteContent`, `ANESTHESIA_FEE_SCHEDULE`) already exist.

### Changes Required:

#### 1. Cost calculation module

**File**: `src/lib/quote/cost.ts`

**Intent**: A pure function deriving both plan variants' totals from a quote's content, used by both the live editor preview (Phase 2) and the server-side approval freeze (Phase 3). Single source of truth for all money math.

**Contract**: Export `computeQuoteTotals(content: QuoteContent): QuoteTotals`. Standard plan: sum `pricelistItems` across `in-plan` teeth (excluding `uncertain` and `out-of-current-plan` per FR-040/044) plus `generalItems`, grouped per `visitNumber` for `perVisit[]` and aggregated for `grandTotal`. Ranges sum as ranges (sum `min`s and `max`s separately into a `CostRange`); `fixed` contributes `amount` to both bounds; `modifier` adds its `amount` to both bounds of the tooth it belongs to (add-on, not a separate line); `from` treated as a fixed lower bound (reserved). Anesthesia plan: same in-plan tooth set with `localAnesthesia` items removed (FR-041); fee = `basePermanent` if any in-plan tooth is `permanent` (via `dentitionForTooth`) else `baseMilk` (FR-042), plus `perExtraTooth * max(0, inPlanToothCount - includedTeeth)` (FR-043, count = number of in-plan ToothEntry, FR-044 excludes out-of-plan); `anesthesia.total` = treatment-item sum (post-skip) + general items + fee. Helpers for range arithmetic (`addRanges`, `scalarToRange`) may be local. Must import nothing from React/Astro/DB.

#### 2. Vitest setup

**File**: `vitest.config.ts`, `package.json`

**Intent**: Introduce the project's first unit-test runner so the cost module (and future logic) has fast regression coverage.

**Contract**: Add `vitest` dev dependency; `vitest.config.ts` resolving the `@/*` alias to `./src/*` (mirror `tsconfig.json`); add `"test": "vitest run"` and `"test:watch": "vitest"` scripts to `package.json`. Node-environment is sufficient (pure module, no DOM).

#### 3. Cost engine unit tests

**File**: `src/lib/quote/cost.test.ts`

**Intent**: Exhaustively pin the cost rules with worked examples so the immutable money math can't silently regress.

**Contract**: Cases covering — fixed-only standard total; range summation across multiple teeth/visits (FR-026); `modifier` as a per-tooth add-on; `uncertain` and `out-of-current-plan` excluded from standard total (FR-040) and from anesthesia count/fee (FR-044); per-visit subtotals + grand total (FR-032); anesthesia auto-skip of `localAnesthesia` items (FR-041); base fee 1400 all-milk vs 2000 with ≥1 permanent (FR-042); +100/tooth above 5 boundary cases at 5 and 6 teeth (FR-043); empty quote and no-anesthesia-eligible-teeth edge cases. Assert exact `CostRange` and fee values.

### Success Criteria:

#### Automated Verification:

- Vitest runs: `npm run test`
- Cost-engine suite passes (all FR-026/032/040/041/042/043/044 cases green)
- Type checking passes: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification:

- Spot-check two worked examples (one with ranges + modifier, one all-milk anesthesia under/over 5 teeth) by hand and confirm the test fixtures match clinic-realistic numbers.

**Implementation Note**: After this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Admin shell + new-quote editor island

### Overview

Add a protected `/admin` area and the single `QuoteEditor` React island that owns the entire working quote in client state, with live totals from the Phase-1 module. No persistence yet — this phase ends with a fully editable form whose "approve" action is wired in Phase 3.

### Changes Required:

#### 1. Protect `/admin`

**File**: `src/middleware.ts`

**Intent**: Gate the admin area behind auth, matching the existing dashboard protection.

**Contract**: Add `"/admin"` to `PROTECTED_ROUTES`. The existing `startsWith` check then covers `/admin/*`.

#### 2. Admin page shell

**File**: `src/pages/admin/index.astro`

**Intent**: Server-rendered entry point that mounts the editor island for a logged-in dentystka.

**Contract**: Uses `Layout` (Polish `title`), reads `Astro.locals.user`, mounts `<QuoteEditor client:load />`. Pricelist picker data is serialized from the server into the island as props so the client doesn't re-import the seed bundle. **Serialize resolved picker options, not raw source items.** `listByCategory()` / `listToothItems()` / `listGeneralItems()` return `SourcePricelistItem[]` (`price_type` / `price_min` / `price_max`, no resolved `price`) — these cannot feed the cost engine, whose input `ToothEntry.pricelistItems` is `PricelistItemRef[]` with `price: PriceValue`. So the page maps each source item through `resolvePricelistItem(item.id)` server-side and serializes `PricelistItemRef`-shaped options (`id`, `name`, `price`, `localAnesthesia`) carrying their category label for the disambiguating picker. The island then has everything it needs to (a) render the grouped picker and (b) compute live totals via `computeQuoteTotals` directly from selected refs. The approval payload still POSTs items **by `id`** (Phase 3), where the server re-resolves independently — the client-side resolved price is for preview only and is never trusted for the freeze. `prerender = false` (SSR).

#### 3. Quote editor island

**File**: `src/components/admin/QuoteEditor.tsx` (+ sub-components in `src/components/admin/`)

**Intent**: The whole interactive editor — owns `QuoteContent`-shaped state, renders every section, derives live totals, validates input, and on approve POSTs the tree (Phase 3 wires the endpoint).

**Contract**: Single `client:load` island holding `{ patientType, teeth, visits, generalItems }` plus transient `rawText`. Sections:
- **Raw diagnosis textarea** — scratch only; in state, never sent in the approval payload, never persisted (FR-010 affordance).
- **Patient type** — `child`/`adult` toggle (FR-020).
- **Tooth entry** — input accepting single or comma-separated FDI numbers (e.g. `17,16,34`); each valid number appends a `ToothEntry` with derived name (FR-021) and `dentitionForTooth` (FR-022, display-only). Out-of-range (not 11–48 / 51–85) or duplicate numbers surface as inline warnings, not silent drops (FR-012).
- **Per-tooth row** — treatment type (FR-023), urgency (FR-024), status `in-plan`/`uncertain`/`out-of-current-plan` (FR-027), free-text note (FR-028), pricelist-item multi-add via a category-grouped picker that disambiguates by category (FR-025; names not unique), visit-number dropdown shown only for `in-plan` (FR-030).
- **General items** — add/edit/remove, each referencing a pricelist item via the picker (FR-029), optional visit association.
- **Visits** — add/remove with renumbering (FR-031); each visit shows its partial cost (FR-032).
- **Live totals** — both variants via `computeQuoteTotals`, recomputed on every change; anesthesia variant labeled recommended.
- **Approve button** — disabled (with reason) when the quote is empty or any `in-plan` tooth has no pricelist items (essential guards); calls the Phase-3 endpoint.

Decompose into `ToothRow`, `PricelistPicker`, `GeneralItems`, `VisitList`, `TotalsPreview` for readability. Derive names via a tooth-name helper (see below).

#### 4. Tooth-name helper

**File**: `src/lib/quote/tooth-name.ts`

**Intent**: Deterministic FDI-number → Polish name mapping (FR-021), reused by editor and patient page.

**Contract**: Export `toothName(n: number): string` returning e.g. `"74 — pierwszy trzonowiec mleczny lewy dolny"`; covers all permanent (11–48) and milk (51–85) positions. Pure, no UI. Out-of-range input returns a sentinel the callers can flag.

#### 5. shadcn/ui inputs as needed

**File**: `src/components/ui/*`

**Intent**: Pull in the form primitives the editor needs beyond `button`.

**Contract**: Add via `npx shadcn@latest add` only the components actually used (e.g. `input`, `select`, `textarea`, `label`, `badge` if not the existing Astro badge). Keep to "new-york" variant.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build`
- Linting passes: `npm run lint`
- Unit tests still pass: `npm run test`

#### Manual Verification:

- Visiting `/admin` while logged out redirects to `/auth/signin`; while logged in renders the editor.
- Entering `17,16,34` creates three tooth rows with correct derived names and dentition.
- Entering an out-of-range number (e.g. `99`) shows a warning and does not create a priced row.
- Adding pricelist items, setting statuses, adding visits and general items updates both live totals correctly (cross-check against Phase-1 expectations).
- Approve is disabled when the quote is empty or an in-plan tooth is unpriced, with a visible reason.

**Implementation Note**: After this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 3: Approval transaction + token + link

### Overview

Wire the irreversible approval: validate the submitted tree, freeze a pricelist snapshot, compute authoritative totals server-side, generate a cryptographic token, insert one immutable `approved` row, and show the dentystka a copyable `/p/<token>` link.

### Changes Required:

#### 1. Approval API route

**File**: `src/pages/api/admin/quotes/approve.ts`

**Intent**: Server-authoritative endpoint that turns a validated editor payload into a frozen, approved quote and returns its token.

**Contract**: `export const POST: APIRoute`. Steps: (1) require an authenticated user via `createClient(context.request.headers, context.cookies)` + `getUser()`, else 401/redirect. `createClient` returns `null` when env is unset — guard for it and return 500 (mirror the existing auth-route guard). (2) Parse body against a request schema = `patient_type` + the editor's tooth/general/visit data where pricelist items are sent **by `id`** (plus user fields: status, treatment, urgency, note, visitNumber). (3) Server-side, build the patient-safe `QuoteContent`: for each referenced pricelist `id` call `resolvePricelistItem(id)` to embed a frozen `PricelistItemRef` (FR-050); reject unknown ids. (4) Compute `totals` via `computeQuoteTotals` and attach. (5) Generate `token` from `crypto.getRandomValues` (≥16 bytes, URL-safe encoding). (6) INSERT one row: `status='approved'`, `patient_type`, `content` (frozen tree incl. totals), `token`, `approved_at=now()` (DB default/explicit). (7) Return JSON `{ token }` (or the full `/p/<token>` path). Reject empty quotes / unpriced in-plan teeth server-side too (don't rely on the client guard). `prerender = false`.

#### 2. Token utility

**File**: `src/lib/quote/token.ts`

**Intent**: Centralize secure token generation (FR-051).

**Contract**: Export `generateToken(): string` — ≥128-bit `crypto.getRandomValues`, URL-safe string, no padding ambiguity. Pure aside from the crypto global.

#### 3. Confirmation screen

**File**: `src/components/admin/QuoteEditor.tsx` (success state) and/or `src/pages/admin/index.astro`

**Intent**: After a successful approve, present the patient link in a copy-friendly form (FR-052) and a way to start a new quote.

**Contract**: On `{ token }` response, the island swaps to a confirmation view showing the full `/p/<token>` URL, a copy-to-clipboard control, and a "nowy kosztorys" reset. No list navigation (S-03). Surfaces server validation errors inline if approve is rejected.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build`
- Linting passes: `npm run lint`
- Unit tests pass: `npm run test`

#### Manual Verification:

- Approving a valid quote returns a token and shows a copyable `/p/<token>` link.
- The inserted row in Supabase is `approved`, has a unique token, `approved_at` set, and `content` containing frozen `PricelistItemRef`s + `totals` matching the live preview.
- `content` contains **no** raw diagnosis text and no PII.
- A second edit + approve produces a different token and a new row (FR-053); the first row is unchanged.
- Attempting to approve an empty/unpriced quote is rejected server-side even if the client guard is bypassed.

**Implementation Note**: After this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 4: Patient page `/p/<token>`

### Overview

The public, token-only patient view: fetch the frozen quote via the RPC, render both variants side-by-side with grouped teeth, deferred and scenario sections, a recommended-anesthesia treatment, range-friendly pricing, and a non-dismissible disclaimer — with strict no-disclosure and no-index behavior.

### Changes Required:

#### 1. Patient route

**File**: `src/pages/p/[token].astro`

**Intent**: Server-render the patient view for a valid approved token, or a generic error page otherwise, with zero information disclosure.

**Contract**: `prerender = false`. Read `token` from params; call `get_quote_by_token` via a Supabase client (anon access is sufficient — the RPC is `SECURITY DEFINER`). Zero rows → render the generic "Link nieaktywny lub nieprawidłowy" page (FR-060), same response for unknown/draft/expired; **do not** distinguish causes. One row → narrow `content` through `QuoteContentSchema` and render the patient view. Include `<meta name="robots" content="noindex,nofollow">` and set `Referrer-Policy: no-referrer` (the token is a capability secret — keep it out of the `Referer` header). No sitemap exclusion is needed (an SSR dynamic route never enters the generated sitemap). If `createClient` returns `null` (env unset) or the RPC errors, render the same generic error page — never surface internals. Page contains no name/email/identifier (FR-066) — only what's in `content`.

#### 2. Patient view components

**File**: `src/components/patient/*` (Astro components; static render preferred)

**Intent**: Present the frozen quote per FR-061–065 in clear Polish, read-only.

**Contract**:
- **Grouped tooth list** (FR-061) — `in-plan` teeth grouped by quadrant: górne prawe (11–18/51–55), górne lewe (21–28/61–65), dolne lewe (31–38/71–75), dolne prawe (41–48/81–85); each tooth shows number + `toothName` + treatment type + urgency.
- **Odroczone section** (FR-062) — `out-of-current-plan` teeth, clearly marked outside the current plan (default label "Odroczone" per PRD Open Q #5).
- **Scenariusze, które mogą zmienić koszt** (FR-063) — `uncertain` teeth with their notes and conditional cost impact.
- **Side-by-side comparison** (FR-064) — standard variant (visit list with per-visit cost + grand total) vs anesthesia variant (single session + total), anesthesia explicitly marked "rekomendowane przez gabinet".
- **Range presentation** — render `CostRange`s as a single headline figure with "od X zł" framing and push range-driven increases into the Scenariusze section rather than printing min–max everywhere (FR-026 resolution).
- **Disclaimer** (FR-065) — prominent, non-dismissible estimate notice, always present.
- Responsive (phone + desktop), minimal-but-sane visual styling via Tailwind + `cn()`.

#### 3. Price formatting helper

**File**: `src/lib/quote/format.ts`

**Intent**: Consistent PLN + date formatting for the patient page (Localization NFR).

**Contract**: Export helpers to format a `CostRange` to the "od X zł" patient phrasing and a fixed amount to `X zł`, and a date to `DD.MM.YYYY`. Pure.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build`
- Linting passes: `npm run lint`
- Unit tests pass (incl. any range-formatting tests): `npm run test`
- Generated sitemap contains no `/p/...` URL (trivially true — SSR dynamic routes aren't enumerated; this guards against a future `getStaticPaths` regression).

#### Manual Verification:

- Opening a valid `/p/<token>` in a fresh browser (no auth) shows both variants side-by-side with anesthesia recommended, grouped teeth, Odroczone + Scenariusze sections, and the disclaimer.
- Totals on the page match the approved snapshot and the dentystka's preview.
- An unknown/garbage token and a (hypothetical) draft token both render the identical generic error page — no disclosure of existence.
- Page source contains no name/email/identifier and includes `noindex` and `Referrer-Policy: no-referrer`.
- Layout is usable on a phone viewport.

**Implementation Note**: After this phase and all automated verification passes, pause for manual confirmation. This completes the S-01 end-to-end flow.

---

## Testing Strategy

### Unit Tests (Vitest, introduced in Phase 1):

- `computeQuoteTotals`: every cost rule (FR-026 ranges, FR-032 per-visit, FR-040 in-plan-only, FR-041 auto-skip, FR-042 base tiers, FR-043 +100 boundary, FR-044 out-of-plan exclusion), plus empty-quote and no-eligible-teeth edges.
- `toothName` / `dentitionForTooth`: representative permanent and milk numbers; out-of-range sentinel.
- Range/PLN formatting helpers.

### Integration / Manual:

- Full flow in two browsers: login → fill → live totals → approve → copy link → open as patient.
- DB inspection after approval: status, unique token, `approved_at`, frozen `content` (snapshot + totals, no PII/raw text).
- No-disclosure: unknown/draft token → identical generic error.
- Immutability: second approve = new token/row, original intact.

### Manual Testing Steps:

1. Log in, go to `/admin`, paste a sample diagnosis into the scratch textarea.
2. Enter `17,16,34`; confirm rows, names, dentition; enter `99` and confirm a warning with no priced row.
3. Set treatment/urgency/status per tooth, add pricelist items (incl. a range item and a `modifier`), add 2 visits and a general item; verify both live totals against a hand calc.
4. Mark one tooth `uncertain` and one `out-of-current-plan`; confirm they drop from the standard total and anesthesia count.
5. Approve; copy the link; verify the row in Supabase.
6. Open the link in a private window; verify all sections, recommended anesthesia, range phrasing, disclaimer, no PII.
7. Hit `/p/garbage`; verify the generic error page.

## Performance Considerations

No hard performance budgets in v1 (PRD NFR "świadomie pominięte"). The cost computation is trivial over a few dozen teeth; the editor re-derives totals synchronously on change, which is fine at this scale. Patient page is a single SSR render + one RPC call.

## Migration Notes

No schema migration — F-01's `quotes` table and RPC are sufficient. Approval writes via the existing `authenticated` RLS policy. No data backfill.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-01, lines 93–106)
- PRD: `context/foundation/prd.md` (FR-010, FR-013, FR-020–032, FR-040–044, FR-050–053, FR-060–066; US-01, US-02)
- F-01 schema/types: `supabase/migrations/20260603194110_quotes_foundation.sql`, `src/types.ts`, `context/archive/2026-06-03-quotes-data-foundation/plan.md`
- F-02 pricelist API: `src/lib/pricing/` (barrel `@/lib/pricing`), `context/archive/2026-06-03-pricelist-seed-foundation/plan.md`
- Contract registry: `docs/reference/contract-surfaces.md`
- API route pattern: `src/pages/api/auth/signin.ts`; middleware: `src/middleware.ts`; island pattern: `src/components/auth/SignInForm.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Cost engine + Vitest

#### Automated

- [x] 1.1 Vitest runs: `npm run test` — 229924f
- [x] 1.2 Cost-engine suite passes (FR-026/032/040/041/042/043/044 cases) — 229924f
- [x] 1.3 Type checking passes: `npm run build` — 229924f
- [x] 1.4 Linting passes: `npm run lint` — 229924f

#### Manual

- [x] 1.5 Two worked examples (ranges+modifier; all-milk anesthesia under/over 5) hand-checked against fixtures — 229924f

### Phase 2: Admin shell + new-quote editor island

#### Automated

- [x] 2.1 Type checking passes: `npm run build` — e8dc3a1
- [x] 2.2 Linting passes: `npm run lint` — e8dc3a1
- [x] 2.3 Unit tests still pass: `npm run test` — e8dc3a1

#### Manual

- [x] 2.4 `/admin` redirects when logged out, renders editor when logged in — e8dc3a1
- [x] 2.5 `17,16,34` creates correct rows (names + dentition) — e8dc3a1
- [x] 2.6 Out-of-range `99` warns with no priced row — e8dc3a1
- [x] 2.7 Adding items/statuses/visits/general items updates both live totals correctly — e8dc3a1
- [x] 2.8 Approve disabled (with reason) for empty/unpriced quote — e8dc3a1

### Phase 3: Approval transaction + token + link

#### Automated

- [x] 3.1 Type checking passes: `npm run build` — 41548ce
- [x] 3.2 Linting passes: `npm run lint` — 41548ce
- [x] 3.3 Unit tests pass: `npm run test` — 41548ce

#### Manual

- [x] 3.4 Valid approve returns token + copyable `/p/<token>` link — 41548ce
- [x] 3.5 Inserted row is approved, unique token, `approved_at` set, frozen `content` (snapshot + totals match preview) — 41548ce
- [x] 3.6 `content` has no raw text / no PII — 41548ce
- [x] 3.7 Re-approve yields new token/row; original unchanged (FR-053) — 41548ce
- [x] 3.8 Empty/unpriced approve rejected server-side — 41548ce

### Phase 4: Patient page `/p/<token>`

#### Automated

- [x] 4.1 Type checking passes: `npm run build` — 72d7c40
- [x] 4.2 Linting passes: `npm run lint` — 72d7c40
- [x] 4.3 Unit tests pass: `npm run test` — 72d7c40
- [x] 4.4 Generated sitemap contains no `/p/...` URL (SSR dynamic route not enumerated) — 72d7c40

#### Manual

- [x] 4.5 Valid `/p/<token>` shows both variants (anesthesia recommended), grouped teeth, Odroczone + Scenariusze, disclaimer — 72d7c40
- [x] 4.6 Page totals match the approved snapshot — 72d7c40
- [x] 4.7 Unknown and draft tokens render identical generic error (no disclosure) — 72d7c40
- [x] 4.8 Page source has no PII and includes `noindex` + `Referrer-Policy: no-referrer` — 72d7c40
- [x] 4.9 Usable on a phone viewport — 72d7c40
