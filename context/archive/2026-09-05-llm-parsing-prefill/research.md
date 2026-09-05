---
date: 2026-09-05T14:44:28Z
researcher: Wojciech Sternik
git_commit: 5e198f098896927638d3e138bde4857cb913319a
branch: feat/llm-parsing-prefill
repository: wsternik/dentiplan
topic: "Where does an LLM prefill of the quote form attach — in the editor, in the write path, and in the pricelist — and what does the AI SDK give us to do it with?"
tags: [research, codebase, llm-parsing-prefill, quote-editor, pricing, ai-sdk]
status: complete
last_updated: 2026-09-05
last_updated_by: Wojciech Sternik
---

# Research: attaching an LLM prefill to the quote editor

**Date**: 2026-09-05T14:44:28Z
**Researcher**: Wojciech Sternik
**Git Commit**: `5e198f098896927638d3e138bde4857cb913319a`
**Branch**: `feat/llm-parsing-prefill`
**Repository**: wsternik/dentiplan

## Research Question

S-02 turns the dentystka's pasted note into a filled-in form. Before planning it:
where in the editor and the type layer does a prefill attach; how does the
existing write path validate quote content and resolve pricelist ids; how does
this repo already call the AI SDK; and what does the catalog the prompt must be
constrained to actually look like?

## Summary

The prefill has a much better attachment point than "a new feature bolted onto
the editor", and it is already written down in the code:

1. **The target type was designed for this.** `ToothEntrySchema` in
   `src/types.ts:98-104` says so verbatim — fields are nullable and
   empty-tolerant "so a partially-filled draft (**or LLM prefill, FR-011**) still
   parses". A prefill emits exactly the shape the editor already holds.

2. **The write path already has the exact contract a parse endpoint should
   return.** `treePayload()` (`QuoteEditor.tsx:182-197`) sends the tree with
   pricelist items **by id only**, and the server re-resolves prices itself
   (`buildQuoteContent`, `quote-payload.ts:88-106`). So the parse endpoint is the
   same contract run backwards: text in, `{ content, warnings }` out, ids
   resolved server-side. Nothing new has to be invented about how a quote tree
   crosses the wire.

3. **`resolvePricelistItem` throws on an unknown id, and for prefill that is
   wrong.** `resolver.ts:53-64` throws "so a dangling reference fails loudly".
   That is correct for a write — a client sending a bad id is a bug — but for a
   prefill an unknown id is the _expected_ failure mode of a language model, and
   FR-012 says it must become a warning, not a 500. The sibling
   `findItemById(id): SourcePricelistItem | undefined` (`resolver.ts:21-23`) is
   the non-throwing door, and it is already exported.

4. **The schema cannot constrain the tooth number, so code must.** Anthropic's
   structured output rejects `minimum`/`maximum` on a number — discovered on
   this repo's own review agent and written into `scripts/review/agent.ts:60-63`.
   So a model returning tooth `99` produces a _schema-valid_ object. This is
   precisely risk #7, and it is why the mapping onto `QuoteContent` has to be a
   tested pure function rather than a trusted `Output.object` result.

5. **One finding that changes the plan: the model must not be allowed to write
   `ToothEntry.note`.** `note` is inside `content`, and `content` is returned
   verbatim to anonymous callers (file-level INVARIANT, `src/types.ts:11-17`) —
   it is the single patient-visible free-text field, already flagged once by the
   archived impl-review as unbounded (risk #3, `test-plan.md` §2). Handing a
   model that has just read the confidential note a writable field on the
   patient-visible page is how risk #3 comes back through a side door, and no
   existing test would see it: risk #3's e2e asserts on a stamped string the
   dentystka typed, and the prefill path is deliberately not in the e2e suite.
   Recommendation: **no `note` in the parse schema**; prefilled teeth carry
   `note: ""` and the dentystka types a note herself if she wants one. See
   _Open Questions_ for what this costs.

6. **The M3L5 audit came back almost clean.** Six `try`/`catch` blocks exist in
   `src/pages/api/**`, `src/lib/**` and `src/middleware.ts`; all six return an
   error `Response`. There are zero `console.*` calls and zero `.catch()` chains
   in that scope. One real swallowed error exists outside the try/catch census:
   `src/pages/api/auth/signout.ts:7` calls `supabase.auth.signOut()` without
   checking `error` and redirects to `/` regardless.

## Detailed Findings

### The editor island — where a prefill attaches

`src/components/admin/QuoteEditor.tsx` (510 lines) holds the whole working tree
in `useState`, with no store and no reducer:

- `teeth: ToothEntry[]` (`:64-66`), `visits: Visit[]` (`:67`),
  `generalItems: GeneralItem[]` (`:68`) — all controlled.
- `rawText: string` (`:70`) — the diagnosis scratch field.
- `toothWarnings: string[]` (`:72`) — **an existing non-blocking warnings list**,
  rendered at `:418-424` as `<ul className="text-destructive mt-2 space-y-0.5 text-xs">`.
  FR-012's warnings should reuse this pattern rather than invent one.
- `inFlight = useRef(false)` (`:80`) — the write lock shared by save and approve.

The mutators are plain closures. `addTeeth()` (`:98-129`) is **not** reusable for
a prefill: it takes no arguments and reads the free-text `toothInput` state,
tokenizing it itself. A prefill that already has parsed teeth needs a new
sibling — `applyPrefill(...)` calling `setTeeth`/`setVisits`/`setGeneralItems`
directly. The per-tooth patcher `patchTooth(number, patch)` (`:131-133`) and
`addToothItem(number, option)` (`:137-141`) exist but are one-at-a-time.

`rawText` never leaves the island, and this is asserted in three places:
the module header (`:6-8`, "never part of the approval payload and never
persisted"), the absence of the field from `treePayload()` (`:182-197`), and an
explicit callout at the approve call site (`:266-268`). A prefill fetch is the
first time `rawText` is ever sent anywhere — which is the whole feature, and is
what FR-011 authorises ("the only data sent … is the diagnosis text itself").
The invariant that survives is narrower and must be stated that way in code:
`rawText` still never enters `treePayload()` and is still never persisted.

The button belongs inside the existing `Section title="Notatka z diagnozy (roboczo)"`
block (`:354-369`), under the `<Textarea id="rawText">`, guarded by the same
`!readOnly`. The house pattern for an async action is `handleSaveDraft`
(`:203-242`) / `handleApprove` (`:261-297`): guard on `inFlight.current`, set a
boolean loading state, clear the error, `try`/`catch`/`finally`, and swap the
button's own label while busy (`{saving ? "Zapisywanie…" : "Zapisz szkic"}`,
`:499`). Errors render as `<p className="text-destructive text-sm">` (`:504-505`).

Locators the e2e suite depends on and which must not move: the section heading
"Notatka z diagnozy (roboczo)", the label "Pole robocze — nie jest zapisywane ani
widoczne dla pacjenta.", `id="rawText"`, and the button names "Dodaj",
"Zatwierdź", "Zapisz szkic". "Wypełnij z notatki" collides with none of them.

### The write path — the contract a parse endpoint should mirror

Every admin endpoint repeats one skeleton (`admin/quotes/index.ts:32-83`,
`[id].ts`, `approve.ts:53-138`):

```ts
export const prerender = false;
export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return jsonError("Supabase nie jest skonfigurowany.", 500);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("Wymagane zalogowanie.", 401);
  // ... zod .parse() in try/catch -> 400, then work, then JSON response
};
```

- `jsonError(message, status)` is a **local helper copy-pasted into each file**
  (`index.ts:25-30`, `[id].ts:25-30`, `approve.ts:46-51`), not a shared import.
  A new endpoint follows the local-copy convention rather than starting a
  refactor.
- The error body is always `{ error: "<Polish message>" }`.
- Status codes in use: 400 / 401 / 409 / 500 / 201 / 204.
- Body validation is `Schema.parse(body)` inside `try`/`catch` → 400
  (`index.ts:44-50`); the Zod issue detail is deliberately discarded.
- `buildQuoteContent(payload)` (`quote-payload.ts:88-106`) maps
  `tooth.pricelistItemIds` and `generalItems[].itemId` through
  `resolvePricelistItem`, ignoring any client-sent price (FR-050), and throws on
  a dangling id — which each caller catches into
  `jsonError("Nieznana pozycja z cennika.", 400)`.
- Existing field caps: `note` ≤ 500 chars, ids ≤ 64, e-mail ≤ 254
  (`quote-payload.ts:41-55, 75`). **No array-length cap, no body-size cap, no
  timeout, and no rate limiting exists anywhere in the app.** A parse endpoint
  that forwards its input to a paid API is the first place where that matters,
  so its own text cap is not belt-and-braces — it is the only bound.
- Authentication is application code in every handler; there is **no per-row
  ownership check** (single-operator app). Write safety comes from statement
  scoping (`.eq("status","draft")`, `[id].ts:66-75`) plus the `quotes_immutable`
  trigger.

### The pricelist — what the prompt has to be constrained to

`src/lib/pricing/index.ts` is the whole public surface: `PRICELIST`,
`ANESTHESIA_FEE_SCHEDULE`, `resolvePricelistItem`, `findItemById`,
`listToothItems`, `listGeneralItems`, `listByCategory`, `buildPickerOptions`.

- Ids are `<category-slug>:<slugified-name>` (`seed.ts:44-53`), e.g.
  `leczenie-kanalowe:leczenie-kanalowe-trzonowca`.
- 26 pickable items over 7 categories. Per-tooth vs general is two hand-authored
  booleans (`validForTooth`, `validForGeneral`, `schema.ts:47-48`); no item is
  both, and a Zod refinement requires at least one (`schema.ts:62-65`).
  `listToothItems()` / `listGeneralItems()` are the two allowed-value universes
  the prompt needs, and they are already exported.
- **Names are not globally unique** — "Odbudowa po leczeniu kanałowym" exists in
  two categories with two different ids. The prompt must therefore ask for ids,
  and the catalog it is given must carry the category, or the model will pick
  the wrong one of the two.
- **There is no filtering by patient type or dentition anywhere.** `ToothRow`
  renders the same `toothOptions` for a milk tooth and a permanent one
  (`ToothRow.tsx:19,32,116`); dentition is a display badge only. So the prompt
  gets no extra subsetting rules — but it also gets no help avoiding
  "Wypełnienie w zębie mlecznym" on tooth 16.
- `TreatmentType` (`extraction | root-canal | caries-removal | filling | other`)
  is **structurally unrelated** to the pricelist: nothing in the repo links a
  treatment type to which items are offered. They are two independent fields the
  model fills in independently.
- The anaesthesia variant is **not a second catalog** — the same 26 items, minus
  anything flagged `localAnesthesia` (only `leczenie-zachowawcze:znieczulenie`,
  `seed.ts:79`), plus a computed fee (`cost.ts:97-149`). The prefill therefore
  has nothing to say about the anaesthesia plan; it falls out of the same teeth.
- **No Polish free-text → item or → `TreatmentType` mapping exists anywhere.**
  `labels.ts` is one-way, for display. Everything the prompt needs to do is new.

### The AI SDK, as this repo already uses it

`scripts/review/agent.ts` is the working precedent (M5L2/L3): one
`generateText` with `Output.object({ schema })`, no tool loop, model pinned via
`process.env.REVIEW_MODEL ?? "claude-sonnet-5"` with a comment explaining why
pinning is deliberate here, and an input cap (`MAX_DIFF_CHARS = 120_000`).

Checked against the installed packages (`ai@7.0.93`, `@ai-sdk/anthropic@4.0.49`)
and the AI SDK docs, not from memory:

- `const { output } = await generateText({ model, instructions, output: Output.object({ schema }), prompt })`
  — confirmed at <https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data>.
- **`system` is deprecated in AI SDK 7 in favour of `instructions`** —
  `node_modules/ai/dist/index.d.ts:680-686` marks `system?: Instructions` with
  `@deprecated Use instructions instead`. New code uses `instructions`.
  (`scripts/review/agent.ts:78` still passes `system`; out of scope here, worth a
  follow-up.)
- Failures surface as `NoObjectGeneratedError` (parse/validate) and
  `NoOutputGeneratedError` (no output at all), both with `.isInstance()`
  — <https://ai-sdk.dev/docs/reference/ai-sdk-errors/ai-no-object-generated-error>.
- `timeout?: number` and `maxRetries?: number` (default 2) are call settings
  — `node_modules/ai/dist/index.d.ts:640-660`.
- Anthropic structured output rejects `minimum`/`maximum` on a number
  (`scripts/review/agent.ts:60-63`, learned the hard way in S5's own review).

### The swallowed-error audit (M3L5)

Complete census of `try`/`catch` in `src/pages/api/**`, `src/lib/**`,
`src/middleware.ts`: **6 blocks, 6 propagate.**

| #   | Location                        | Catches             | Returns                              |
| --- | ------------------------------- | ------------------- | ------------------------------------ |
| 1   | `admin/quotes/index.ts:45-50`   | body `.parse()`     | 400 `Nieprawidłowe dane kosztorysu.` |
| 2   | `admin/quotes/index.ts:53-57`   | `buildQuoteContent` | 400 `Nieznana pozycja z cennika.`    |
| 3   | `admin/quotes/[id].ts:52-57`    | body `.parse()`     | 400                                  |
| 4   | `admin/quotes/[id].ts:60-64`    | `buildQuoteContent` | 400                                  |
| 5   | `admin/quotes/approve.ts:68-73` | body `.parse()`     | 400                                  |
| 6   | `admin/quotes/approve.ts:77-82` | `buildQuoteContent` | 400                                  |

Zero `console.*` and zero `.catch()` chains in scope. All six use a bare
`catch {}` and discard the cause — a diagnostics gap, not a correctness one.

**One real finding, outside the try/catch shape the audit was looking for:**

```ts
// src/pages/api/auth/signout.ts:6-9
export const POST: APIRoute = async ({ cookies, request, redirect }) => {
  const supabase = createClient(request.headers, cookies);
  await supabase.auth.signOut(); // <- `error` never read
  return redirect("/");
};
```

If `signOut()` fails, the dentystka is redirected to `/` and told nothing; the
session cookie may still be live. On the one machine this app is used from — a
shared surgery computer — "I clicked log out and it looked like it worked" is
the failure that matters. Every other handler in the repo checks `error`
(`signin.ts:13-17`, `signup.ts:13-17`); this one is the outlier.

## Code References

- `src/types.ts:11-17` — the INVARIANT: `content` goes verbatim to anon, so it holds patient-safe data only.
- `src/types.ts:98-104` — `ToothEntrySchema`, empty-tolerant "or LLM prefill, FR-011".
- `src/components/admin/QuoteEditor.tsx:182-197` — `treePayload()`, items by id only.
- `src/components/admin/QuoteEditor.tsx:203-242` — `handleSaveDraft`, the async-action house pattern.
- `src/components/admin/QuoteEditor.tsx:354-369` — the `rawText` section a button attaches to.
- `src/components/admin/QuoteEditor.tsx:418-424` — the existing warnings list to reuse.
- `src/lib/services/quote-payload.ts:88-106` — `buildQuoteContent`, server-side price re-resolution.
- `src/lib/pricing/resolver.ts:21-23` — `findItemById`, the non-throwing lookup a prefill needs.
- `src/lib/pricing/resolver.ts:53-64` — `resolvePricelistItem`, throws on unknown id.
- `src/lib/quote/tooth-name.ts:60-68` — `isValidToothNumber`, the FDI oracle.
- `scripts/review/agent.ts:56-88` — the AI SDK call shape this repo already ships.
- `src/pages/api/auth/signout.ts:7` — the one swallowed error found.

## Architecture Insights

- **The prefill is a read-only sibling of the write path, not a new subsystem.**
  Its response is the write endpoints' request, resolved. Framing it that way
  keeps one contract for "a quote tree in transit" instead of two.
- **Trust boundaries stay where they are.** The model's output is client input
  by another name: it is validated by a schema for shape and by code for meaning
  (FDI range, catalog membership), exactly as `quote-payload.ts` treats the
  browser. `test-plan.md` risk #1's "must challenge" line — "the browser is not
  a trust boundary" — reads as written for this feature.
- **Warnings are the product, not the error path.** FR-012 asks for surfaced
  warnings rather than silent drops or silent acceptance; the editor already has
  the UI for that in `toothWarnings`. The interesting engineering here is the
  warning list, not the API call.
- **Everything the model touches must be a pure function away from the wire**, so
  the risk #7 tests can run on fixtures with no network — which is the stated
  reason this slice gets unit tests instead of an e2e.

## Historical Context (from prior changes)

- `context/archive/2026-06-04-first-thin-quote-and-patient-link/` — impl-review
  findings F1 (client-side Zod mistaken for validation) and F2 (unbounded
  patient-visible free text) are the two defects this slice is most likely to
  repeat; both are re-checked by the CI review agent's criteria
  (`scripts/review/criteria.md`).
- `context/archive/2026-09-04-admin-quote-list/` — established
  `src/lib/services/quote-payload.ts` as the shared payload contract and the
  "items by id, server re-resolves" rule this slice reuses.
- `context/changes/ci-cd-code-review/` — the AI SDK arrived here; `ai` and
  `@ai-sdk/anthropic` are still in `devDependencies` and must move to
  `dependencies` before a runtime path imports them.

## Related Research

- `context/changes/quote-approval-flow-analysis/research.md` — the approval path
  this prefill deliberately does not touch.
- `context/foundation/test-plan.md` §2 — risk map; risk #7 is added by this slice.

## Open Questions

1. **Dropping `note` from the parse schema costs something.** `(32?)` becomes
   `status: "uncertain"` with no explanation attached, and "Kamień do usunięcia"
   becomes a general item with no trace of the wording that produced it. The
   warnings list can carry that context instead ("32 — oznaczone jako niepewne"),
   which keeps it in front of the dentystka without putting it on the patient's
   page. Revisit if she asks for per-tooth notes to be filled in.
2. **Nothing stops the model proposing "Wypełnienie w zębie mlecznym" for tooth 16.** The catalog has no dentition-based subsetting and neither does the app.
   The prompt can be told the rule, but code cannot enforce what code does not
   model. Left as a prompt-level instruction; a mismatch is visible to the
   dentystka in the row she is about to approve.
3. **`scripts/review/agent.ts` still passes the deprecated `system` field.** Not
   this slice's job, but it will keep drifting.
