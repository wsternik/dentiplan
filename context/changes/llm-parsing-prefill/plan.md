# LLM prefill from the diagnosis note — Implementation Plan

## Overview

Give the dentystka a "Wypełnij z notatki" button next to the diagnosis scratch
field. One click sends **only the note text** to Anthropic, gets back a
structured reading of it, and appends the teeth, visits and general items it
found to the form she is already filling in. Everything it could not place comes
back as a warning she can see; nothing it produced is approved without her
clicking "Zatwierdź" herself.

This is roadmap S-02 (FR-011, FR-012, FR-013). The slice is an accelerator, not
a dependency: if the call fails, the form works exactly as it does today.

## Current State Analysis

- The editor (`src/components/admin/QuoteEditor.tsx`) holds the whole working
  tree in `useState` and already renders a non-blocking warnings list for
  invalid tooth numbers (`toothWarnings`, `:72`, rendered `:418-424`).
- `rawText` (`:70`) is a scratch field that has never left the island. The
  module header, `treePayload()` (`:182-197`) and the approve call site
  (`:266-268`) all assert this. A prefill is the first time it is sent anywhere.
- The write endpoints accept the tree with **pricelist items by id only** and
  re-resolve prices server-side (`quote-payload.ts:88-106`). A parse endpoint is
  that same contract run backwards.
- `resolvePricelistItem` **throws** on an unknown id (`resolver.ts:53-64`).
  `findItemById` (`:21-23`) is the non-throwing sibling a prefill needs.
- `isValidToothNumber` (`tooth-name.ts:60-68`) is the FDI oracle, already used
  by `addTeeth`.
- The repo already calls the AI SDK in `scripts/review/agent.ts`: one
  `generateText` with `Output.object`, no tool loop, model pinned with an env
  override. `ai@7.0.93` and `@ai-sdk/anthropic@4.0.49` sit in **devDependencies**.
- `ANTHROPIC_API_KEY` is now a Worker secret (added at the start of this session;
  `npx wrangler secret list`), but is not yet declared in `astro.config.mjs`.

Full detail, with the reasoning behind each: `research.md`.

## Desired End State

On `/admin/quotes/new`, pasting

> `Do leczenie: 17,16 Kanałowe: 34,37,36, (32?) Kamień do usunięcia`

and clicking "Wypełnij z notatki" leaves the form with teeth 17, 16, 34, 37, 36
and 32 added — 32 marked `uncertain` — plausible treatment types and pricelist
items attached, a hygiene item under general items, and a warnings list naming
anything that was dropped. The dentystka corrects what she disagrees with and
approves. Verified on production, not just locally.

### Key Discoveries

- `ToothEntrySchema` (`src/types.ts:98-104`) was written for this: "empty-tolerant
  so a partially-filled draft (**or LLM prefill, FR-011**) still parses".
- **Anthropic's structured output rejects `minimum`/`maximum` on a number**
  (`scripts/review/agent.ts:60-63`, learned in S5). Tooth `99` therefore comes
  back schema-valid. The FDI check must be code, and that is exactly risk #7.
- `content` goes verbatim to anonymous callers (`src/types.ts:11-17`), and
  `ToothEntry.note` is its only free-text field.
- No dentition or patient-type filtering exists on the pricelist anywhere
  (`ToothRow.tsx:19,32,116`), so the prompt gets no help avoiding a milk-tooth
  item on a permanent tooth.
- Pricelist names are **not unique** ("Odbudowa po leczeniu kanałowym" exists in
  two categories), so the model must return ids and the catalog it is shown must
  carry the category.

## What We're NOT Doing

- **No `note` in the parse schema.** Deliberate narrowing of the schema written
  down in the session plan. `note` lives inside `content`, which is served
  verbatim to anyone holding the patient link, and the archived impl-review
  already flagged it as unbounded patient-visible free text (risk #3). A model
  that has just read the confidential note does not get a pen on the patient's
  page. Prefilled teeth carry `note: ""`; context that would have gone there
  goes into the warnings list instead, where only the dentystka sees it.
- No streaming, no parse history, no persistence of `rawText` (the island
  invariant stands), no model picker in the UI, no promptfoo.
- **No e2e test for the prefill.** It would spend money and depend on model
  output for its verdict. Risk #7 is covered by unit tests on fixtures.
- No change to the approval path, the patient page, or the cost engine.
- No redesign (that is `ui-redesign`), and no new DOM roles, labels or button
  texts on anything that already exists.

## Implementation Approach

Three layers, so the untrusted part is the smallest possible piece:

1. **A pure boundary.** `src/lib/llm/` turns text into `{ content, warnings }`.
   The model call sits behind a one-method interface so every test runs on
   fixtures with no network. The mapping from model output onto `QuoteContent`
   is a pure function — that is where FDI range, catalog membership and the
   `(32?)` → `uncertain` rule are enforced, and it is what the risk #7 tests
   exercise.
2. **A thin endpoint.** `POST /api/admin/quotes/parse` authenticates, caps the
   text, calls the boundary, and returns `{ content, warnings }` or an error
   with a status. It never answers 200 with an empty result.
3. **An additive UI.** The button appends to what is already on the form and
   reuses the existing warnings list.

Model output is treated as client input by another name: schema for shape, code
for meaning. That is the same rule `quote-payload.ts` applies to the browser.

## Critical Implementation Details

**Nullable fields are a schema risk with this provider.** S5 proved Anthropic's
structured output rejects some JSON-Schema constructs the SDK will happily
generate. Rather than discover that again at runtime, the parse schema uses
**closed enums with an explicit `"unknown"` member** (and `visitNumber: 0` for
"not assigned") instead of `.nullable()`. The pure mapper translates `"unknown"`
and `0` into the `null`s `ToothEntry` actually stores. This keeps every
translation in the tested function rather than in the wire format.

**`instructions`, not `system`.** `system` is deprecated in AI SDK 7
(`node_modules/ai/dist/index.d.ts:680-686`).

---

## Phase 1: The parsing boundary

### Overview

Everything between "a string of Polish" and "a quote tree", with no HTTP and no
network in the tests. Driven test-first through `/10x-tdd` against risk #7.

### Changes Required

#### 1. Promote the AI SDK to a runtime dependency

**File**: `package.json`

**Intent**: `ai` and `@ai-sdk/anthropic` are in `devDependencies` from the S5
review agent, which is a script. A request handler is about to import them.

**Contract**: both packages move to `dependencies` at their current versions
(`ai@^7.0.93`, `@ai-sdk/anthropic@^4.0.49`). No version bump in this slice.

#### 2. The wire schema for what the model returns

**File**: `src/lib/llm/schema.ts`

**Intent**: define the one shape the model is allowed to answer in, and the
shape the endpoint hands back. Closed enums, no nullables (see Critical
Implementation Details).

**Contract**:

```ts
export const ParsedDiagnosisSchema = z.object({
  teeth: z.array(
    z.object({
      number: z.number().int(), // NOT range-constrained — provider rejects min/max
      treatmentType: z.enum([...TreatmentType, "unknown"]),
      urgency: z.enum(["urgent", "moderate", "mild", "unknown"]),
      status: z.enum(["in-plan", "uncertain", "out-of-current-plan"]),
      pricelistItemIds: z.array(z.string()),
      visitNumber: z.number().int(), // 0 = not assigned
    }),
  ),
  generalItemIds: z.array(z.string()),
  visits: z.array(z.object({ number: z.number().int(), label: z.string() })),
  warnings: z.array(z.string()), // phrases the model could not place
});

/** What the endpoint returns; `generalItems` carry no id — the editor owns `g-<n>`. */
export interface PrefillResult {
  content: { teeth: ToothEntry[]; visits: Visit[]; generalItems: PricelistItemRef[] };
  warnings: string[];
}
```

The tooth enums are derived from `TreatmentTypeSchema` / `UrgencySchema` /
`ToothStatusSchema` in `src/types.ts` rather than retyped, so a new treatment
type cannot silently diverge between the form and the prompt.

#### 3. The prompt, built from the live catalog

**File**: `src/lib/llm/prompt.ts`

**Intent**: give the model the allowed-value universe and the house rules, built
from the pricelist at call time so the prompt cannot drift from the seed.

**Contract**: `buildInstructions(): string`, assembled from `listToothItems()`,
`listGeneralItems()` and `listByCategory()`. Must contain, at minimum: every
pricelist id with its name and category, split into per-tooth and general;
the FDI ranges; the `(32?)` → `uncertain` rule; the worked example from the PRD
(`Do leczenie: 17,16 … Kanałowe: 34,37,36, (32?) Kamień do usunięcia`); and the
Non-Goals rule — **never propose a treatment the note does not mention**. It
must state that unrecognised wording belongs in `warnings`, not in an invented
item. A test asserts the catalog is present, so a prompt that silently loses the
item list fails the suite rather than the dentystka.

#### 4. The pure mapper — where risk #7 is actually stopped

**File**: `src/lib/llm/parse-diagnosis.ts`

**Intent**: turn a schema-valid model answer into a quote tree the editor can
merge, dropping and reporting everything that is not real. This function is the
whole safety argument of the slice.

**Contract**: `mapParsedDiagnosis(parsed: ParsedDiagnosis): PrefillResult`, pure,
no I/O. Rules, each of which is a test:

- tooth number failing `isValidToothNumber` → dropped, one warning naming it;
- pricelist id not found by `findItemById` → item dropped, one warning naming
  the id and the tooth; the tooth itself survives;
- a general id that is not `validForGeneral` (or a tooth id that is not
  `validForTooth`) → dropped with a warning; membership in the right list is
  checked, not just existence;
- `"unknown"` → `null` for `treatmentType` and `urgency`; `visitNumber: 0` → `null`;
- a `visitNumber` referencing a visit the model did not declare → `null` plus a
  warning, never a dangling reference;
- `status` other than `in-plan` forces `visitNumber: null`, matching FR-030;
- `note` is always `""`;
- the model's own `warnings` are passed through alongside the mapper's.

Warnings are Polish, user-facing, and name the thing that was dropped — a
warning that does not say what was lost is not a warning.

#### 5. The provider call, behind an interface

**File**: `src/lib/llm/client.ts`

**Intent**: one `generateText` call, and a seam so no test ever needs the
network.

**Contract**: `export interface DiagnosisModel { read(text: string): Promise<ParsedDiagnosis> }`
plus `anthropicModel(): DiagnosisModel` using
`generateText({ model: anthropic(MODEL), instructions, output: Output.object({ schema }), prompt, timeout, maxRetries })`.
Model id pinned to `claude-sonnet-5`, overridable via `LLM_MODEL`, with the same
"pinning is deliberate" comment as `scripts/review/agent.ts:56-63`. Timeout and
`maxRetries` are set explicitly rather than left to defaults, because this call
sits on a request path.

`parseDiagnosis(text: string, model: DiagnosisModel): Promise<PrefillResult>`
lives in `parse-diagnosis.ts` and is the composition. **The model is a required
parameter, not a default**, so `parse-diagnosis.ts` never imports `client.ts`:
`client.ts` reads `astro:env/server`, `vitest.config.ts` has no stub for that
module, and a static import of it would kill the whole Phase 1 suite before the
first assertion. The endpoint is the only module that composes the two, and the
only one that touches `astro:env`.

The text parameter is a `string` and nothing else — that is how "no PII in the
prompt" (FR-011, FR-072) is enforced structurally rather than by review.

#### 6. Fixtures and tests

**Files**: `src/lib/llm/fixtures/*.json`, `src/lib/llm/parse-diagnosis.test.ts`,
`src/lib/llm/prompt.test.ts`

**Intent**: cover risk #7 on recorded model answers.

**Contract**: at least four fixtures — a clean answer from the PRD example; an
answer containing a pricelist id that is not in the catalog; an answer
containing tooth `99`; an answer marking `(32?)` as `uncertain`. Test names open
with the risk, per `test-plan.md` §6.1: `risk #7: …`.

### Success Criteria

#### Automated Verification

- Linting passes: `npm run lint`
- Type checking passes: `npx astro check`
- Unit suite passes, including the new files: `npm test`
- Dependency graph clean: `npm run depcruise`
- No test in `src/lib/llm/` performs a network call (grep the suite for the SDK import outside `client.ts`)

#### Manual Verification

- `parseDiagnosis` cannot be called with anything but a string — confirmed by reading the signature
- Warnings read as Polish sentences a dentist would understand, not as developer messages

---

## Phase 2: The endpoint, the secret, and the one swallowed error

### Overview

Expose the boundary at `POST /api/admin/quotes/parse`, declare the key, and fix
the swallowed error the M3L5 audit turned up.

### Changes Required

#### 1. The parse endpoint

**File**: `src/pages/api/admin/quotes/parse.ts`

**Intent**: an authenticated, bounded door to the parsing boundary.

**Contract**: `export const prerender = false;` and `POST`, following the house
skeleton (`admin/quotes/index.ts:32-50`) including the file-local `jsonError`
copy. Body `{ text: string }` validated with Zod, **1–4000 characters** — the
first request-size bound in this app, and the only thing standing between a
paste and a bill. Responses:

| Case               | Status | Body                                                                           |
| ------------------ | ------ | ------------------------------------------------------------------------------ |
| success            | 200    | `{ content, warnings }`                                                        |
| no session         | 401    | `{ error: "Wymagane zalogowanie." }`                                           |
| bad/oversized body | 400    | `{ error: "Nieprawidłowa notatka." }`                                          |
| key not configured | 503    | `{ error: "Wypełnianie z notatki jest niedostępne." }`                         |
| model call failed  | 502    | `{ error: "Nie udało się przetworzyć notatki — wypełnij formularz ręcznie." }` |

A failed model call is **never** a 200 with an empty tree. The endpoint reads
nothing from and writes nothing to the database.

#### 2. Declare the key and the model override

**Files**: `astro.config.mjs`, `.env.example`, `.dev.vars.example`

**Intent**: make the key a first-class server secret like the Supabase pair.

**Contract**: `ANTHROPIC_API_KEY` and `LLM_MODEL` added to `env.schema` as
`envField.string({ context: "server", access: "secret", optional: true })`.
`optional: true` matches the Supabase entries and is what lets a missing key be
a banner instead of a boot failure. `LLM_MODEL` is declared `secret` not because
it is one but because `access: "public"` in Astro means client-readable, which a
server-only knob should not be.

#### 3. Missing key is a banner, not a 500

**File**: `src/lib/config-status.ts`

**Intent**: the existing `configStatuses` list is how this app reports
misconfiguration; the new dependency joins it.

**Contract**: one more `ConfigStatus` entry, `configured: Boolean(ANTHROPIC_API_KEY)`,
with a message saying prefill is off and the form still works by hand — **plus an
`adminOnly: true` flag on it, and a filter in `src/layouts/Layout.astro:26` that
hides admin-only statuses from signed-out visitors.**

Without that flag the banner lands on the patient's page: `p/[token].astro:17`
uses the same layout, and that file's header states the no-disclosure invariant
(FR-060) — "missing-env … we never distinguish causes and never surface
internals". Supabase keeps its current always-visible behaviour, because a
patient page cannot render without it anyway.

#### 4. Fix the sign-out that fails silently

**File**: `src/pages/api/auth/signout.ts`

**Intent**: the M3L5 audit found one real swallowed error (research §"The
swallowed-error audit"): `await supabase.auth.signOut()` never reads `error` and
redirects to `/` either way. On a shared surgery computer, "I clicked log out
and it looked like it worked" is the failure that matters.

**Contract**: check `error` and surface it the way `signin.ts:13-17` does,
rather than redirecting unconditionally. Behaviour on success is unchanged, so
no e2e locator moves.

### Success Criteria

#### Automated Verification

- Linting passes: `npm run lint`
- Type checking passes: `npx astro check`
- Unit suite passes: `npm test`
- Build succeeds against the Workers runtime: `npm run build`
- **E2E regression gate green, specs untouched**: `npm run test:e2e`

#### Manual Verification

- `POST /api/admin/quotes/parse` without a session cookie returns 401
- A 5000-character body returns 400 and never reaches the model
- A real note returns 200 with a populated `content` and a `warnings` array — **from `npm run dev`, i.e. the workerd runtime**, not a Node harness. The provider has only ever run here under `tsx`; a bundle that builds is not a bundle that runs.
- With the key removed locally, the app boots, shows the config banner **in the admin panel only**, and the endpoint answers 503
- With the key removed, an anonymous `/p/<token>` page carries no configuration banner

---

## Phase 3: The button, the warnings, and the merge

### Overview

The only user-visible part. Additive by construction.

### Changes Required

#### 1. Prefill action in the editor

**File**: `src/components/admin/QuoteEditor.tsx`

**Intent**: a button under the existing diagnosis textarea that calls the
endpoint and merges the answer into the form.

**Contract**: a `handlePrefill` following the `handleSaveDraft` shape
(`:203-242`) — `inFlight` guard, `parsing` boolean, error state, try/catch/finally
— and a new `applyPrefill(result)` that calls `setTeeth`/`setVisits`/
`setGeneralItems` directly. `addTeeth()` is **not** reusable: it takes no
arguments and reads `toothInput` (`:98-129`).

Merge rules, all additive:

- teeth already on the form are **kept as they are**; a prefilled duplicate is
  skipped and reported as a warning. Nothing the dentystka typed is overwritten;
- new teeth are appended and the list re-sorted, matching `addTeeth`;
- visits are appended with numbers continuing the existing ones, and prefilled
  `visitNumber`s are remapped onto them;
- general items get `g-<n>` ids from the existing `generalCounter` ref (`:73`),
  which is already seeded past the highest restored id (`:44-49`);
- `rawText` is untouched and still absent from `treePayload()`.

The button lives inside the existing `Section title="Notatka z diagnozy (roboczo)"`
(`:354-369`), guarded by `!readOnly`, labelled `{parsing ? "Wypełnianie…" : "Wypełnij z notatki"}`
and disabled when `parsing` or the textarea is empty. On failure it renders the
FR-013 message — _"Nie udało się przetworzyć notatki — wypełnij formularz
ręcznie."_ — and changes nothing on the form.

**No existing role, label, or button text changes.**

#### 2. The warnings component

**File**: `src/components/admin/ParseWarnings.tsx`

**Intent**: FR-012's warnings need a home; the editor already has the visual
pattern.

**Contract**: `ParseWarnings({ warnings }: { warnings: string[] })`, rendering
nothing when empty and otherwise the same list markup as `toothWarnings`
(`:418-424`). Given its own heading and `aria-label` so it is reachable and
distinguishable from the tooth warnings above it.

### Success Criteria

#### Automated Verification

- Linting passes: `npm run lint`
- Type checking passes: `npx astro check`
- Unit suite passes: `npm test`
- **E2E regression gate green, specs untouched**: `npm run test:e2e`

#### Manual Verification

- The PRD example note fills teeth 17, 16, 34, 37, 36 and 32, with 32 `uncertain`
- Clicking the button twice does not duplicate teeth; the second run warns instead
- Teeth added by hand before the click survive it unchanged
- With the endpoint failing (key removed), the message appears and the form stays usable
- A screenshot of the editor after a prefill, warnings visible

---

## Phase 4: The documents that record the decision

### Overview

PRD, roadmap, test plan and README move in the same session as the code.

### Changes Required

#### 1. Close the FR-012 validation question in the PRD

**File**: `context/foundation/prd.md`

**Intent**: Open Question 8 asks for "the concrete set of parsing-output
validations" and defers it to implementation. Implementation just answered it.

**Contract**: mark Open Question 8 resolved with the actual rule set from the
mapper (FDI membership, catalog membership, per-context validity, `(32?)` →
`uncertain`, dangling visit references) and note that `note` is deliberately not
model-writable, with the patient-visibility reason. No new FR numbers —
FR-011/012/013 already cover the behaviour.

#### 2. Risk #7 in the test plan

**File**: `context/foundation/test-plan.md`

**Intent**: the risk map is the source of the tests, so the new risk goes in it.

**Contract**: risk #7 — _the LLM puts something in the form the dentystka never
wrote, or a pricelist item / tooth number that does not exist, and it reaches
approval_ — added to §2 with impact, likelihood and source, plus a Risk Response
Guidance row. §3 gains a phase row for this slice. §7 ("What We Deliberately
Don't Test") gains **one sentence** saying why there is no e2e for the prefill:
the assertion would depend on model output, so it would be a flaky test of
someone else's service rather than of this app's mapping.

#### 3. Answer the question `contract-surfaces.md` already asked

**File**: `docs/reference/contract-surfaces.md`

**Intent**: the invariant section (`:76-88`) ends with "Downstream slices (S-01
form payloads, **S-02 LLM prefill**) must honor it when shaping `content`". This
slice is that S-02, so "must honor" becomes "honors it, and here is how".

**Contract**: under the invariant, record the two mechanisms — the model is
never given a writable `note`, and pricelist ids are resolved server-side from
the seed rather than taken from the model's output.

#### 4. Roadmap and README

**Files**: `context/foundation/roadmap.md`, `README.md`

**Contract**: S-02 → `done` in the At-a-glance table, the slice section and the Backlog Handoff row. README gains prefill in _What the MVP does_,
`ANTHROPIC_API_KEY` in _Running it locally_, and S-02 in _Roadmap status_.

### Success Criteria

#### Automated Verification

- Linting passes: `npm run lint`
- Type checking passes: `npx astro check`
- Unit suite passes: `npm test`
- No stale claim: `grep -n "blocked" context/foundation/roadmap.md` shows no S-02 row

#### Manual Verification

- A reader who has not seen this session can tell from the PRD why `note` is not model-writable
- Test plan §7 explains the missing e2e in one sentence
- `contract-surfaces.md` records how S-02 honours the `content` invariant

---

## Testing Strategy

### Unit Tests

- The mapper against fixtures: valid answer, unknown pricelist id, tooth 99,
  `(32?)` → `uncertain`, dangling `visitNumber`, general id used per-tooth.
- The prompt contains every catalog id.
- Existing suites (`cost`, `format`, `quote-payload`) unchanged and still green.

### Integration Tests

None new. The endpoint is thin and its interesting behaviour — the mapping — is
unit-tested; its auth and validation follow a pattern already exercised.

### Manual Testing Steps

1. Locally, paste the PRD example note and click "Wypełnij z notatki".
2. Add tooth 11 by hand, click again, confirm 11 survives and the duplicate is warned.
3. Remove `ANTHROPIC_API_KEY` from `.env`, restart, confirm banner + 503 + usable form.
4. On production: paste an invented note, prefill, correct, approve, open the
   patient link. Then delete the row via SQL (FR-053 makes it immutable).

## Performance Considerations

One model call per click, on a request path. `timeout` and `maxRetries` are set
explicitly so a slow provider cannot hold a Worker request open indefinitely.
The 4000-character cap bounds input tokens. No caching — the same note pasted
twice is a rare case and caching it would mean storing the note.

## Migration Notes

None. No schema change, no migration, nothing written to the database by this
slice.

## References

- Research: `context/changes/llm-parsing-prefill/research.md`
- AI SDK call precedent: `scripts/review/agent.ts:56-88`
- Payload contract this mirrors: `src/lib/services/quote-payload.ts:88-106`
- Warnings UI to reuse: `src/components/admin/QuoteEditor.tsx:418-424`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: The parsing boundary

#### Automated

- [x] 1.1 Linting passes: `npm run lint` — c0605b1
- [x] 1.2 Type checking passes: `npx astro check` — c0605b1
- [x] 1.3 Unit suite passes, including the new files: `npm test` — c0605b1
- [x] 1.4 Dependency graph clean: `npm run depcruise` — c0605b1
- [x] 1.5 No test in `src/lib/llm/` performs a network call — c0605b1

#### Manual

- [x] 1.6 `parseDiagnosis` cannot be called with anything but a string — c0605b1
- [x] 1.7 Warnings read as Polish sentences a dentist would understand — c0605b1

### Phase 2: The endpoint, the secret, and the one swallowed error

#### Automated

- [x] 2.1 Linting passes: `npm run lint` — c7f2d85
- [x] 2.2 Type checking passes: `npx astro check` — c7f2d85
- [x] 2.3 Unit suite passes: `npm test` — c7f2d85
- [x] 2.4 Build succeeds against the Workers runtime: `npm run build` — c7f2d85
- [x] 2.5 E2E regression gate green, specs untouched: `npm run test:e2e` — c7f2d85

#### Manual

- [x] 2.6 `POST /api/admin/quotes/parse` without a session cookie returns 401 — c7f2d85
- [x] 2.7 A 5000-character body returns 400 and never reaches the model — c7f2d85
- [x] 2.8 A real note returns 200 with populated `content` and `warnings`, from the workerd dev server — c7f2d85
- [x] 2.9 With the key removed, the app boots, banners, and the endpoint answers 503 — c7f2d85
- [x] 2.10 With the key removed, `/p/<token>` shows **no** configuration banner — c7f2d85

### Phase 3: The button, the warnings, and the merge

#### Automated

- [x] 3.1 Linting passes: `npm run lint`
- [x] 3.2 Type checking passes: `npx astro check`
- [x] 3.3 Unit suite passes: `npm test`
- [x] 3.4 E2E regression gate green, specs untouched: `npm run test:e2e`

#### Manual

- [x] 3.5 The PRD example note fills 17, 16, 34, 37, 36 and 32, with 32 `uncertain`
- [x] 3.6 Clicking twice warns instead of duplicating
- [x] 3.7 Teeth added by hand survive a prefill unchanged
- [x] 3.8 With the endpoint failing, the FR-013 message appears and the form stays usable
- [x] 3.9 Screenshot of the editor after a prefill, warnings visible

### Phase 4: The documents that record the decision

#### Automated

- [ ] 4.1 Linting passes: `npm run lint`
- [ ] 4.2 Type checking passes: `npx astro check`
- [ ] 4.3 Unit suite passes: `npm test`
- [ ] 4.4 No stale `blocked` on the S-02 roadmap row

#### Manual

- [ ] 4.5 The PRD explains why `note` is not model-writable
- [ ] 4.6 Test plan §7 explains the missing e2e in one sentence
- [ ] 4.7 `contract-surfaces.md` records how S-02 honours the `content` invariant
