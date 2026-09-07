# Save diagnosis notes and simplify the quote form

## Goal

Persist an optional raw diagnosis note with a quote for the authenticated dentist while preserving the hard boundary that patient-visible `content` and `get_quote_by_token` never expose it. Make new-quote creation note-first and deliver the specified vocabulary, layout, read-only, tooltip, chart, and prefill-loading refinements.

## Current State Analysis

- `QuotePayloadSchema` intentionally strips `patient_email`; `buildQuoteContent()` derives the patient payload only from that schema.
- The three write routes already persist `patient_email`; `approve.ts` writes it in the approval transaction, which is the only safe time for an approved row.
- The anonymous RPC selects an explicit column whitelist. It must remain unchanged.
- `QuoteEditor` merges prefill against `treeRef.current`; the loading affordance must not replace this mechanism.

## Scope

### In scope

- Polish display wording from “znieczulenie ogólne” to “narkoza”, limited to the agreed UI and prompt text.
- Nullable `diagnosis_note` storage, panel-only reads, and private write paths.
- Note-first new drafts; manual form progressive disclosure and an in-flight overlay.
- Agreed responsive, read-only, odontogram, and accessible-hint refinements.
- FR-077, FR-078, S-10 roadmap entry, risk #13, and a migration procedure note if needed.

### Out of scope

- Any diagnosis note on patient pages, list/search, revision history, or post-approval editing.
- Changing local anaesthesia pricing/names, English identifiers, approval semantics, `get_quote_by_token`, prefill cancellation, or additional hints.

## Phase 1: Vocabulary

### Changes Required

- `src/components/admin/TotalsPreview.tsx`, `src/components/patient/VariantComparison.astro`, and patient page copy: use “narkoza” only where the copy denotes general anaesthesia.
- `src/lib/llm/prompt.ts` and `prompt.test.ts`: rename the Polish prompt section and retain an assertion for it.
- `e2e/patient-print-layout.spec.ts` and `e2e/patient-link-content.spec.ts`: change exactly the two literal headings that cite the updated text; no locator or behavioural change.
- Leave the local-anaesthesia pricing item, `localAnesthesia`, and English names untouched.

### Success Criteria

#### Automated Verification

- `npm test` passes with the prompt-section assertion.
- `git diff main...HEAD -- e2e/*.spec.ts` contains only the two approved string substitutions.
- `npm run test:e2e` passes.

#### Manual Verification

- General-anaesthesia variants read “narkoza”; the local price item still reads “Znieczulenie”.

## Phase 2: Private diagnosis note

### Changes Required

- Add `diagnosis_note text` (nullable) to a new migration, including a table comment documenting that `content` is patient-visible and cannot contain raw notes. Link the CLI, record the currently applied migration state, apply the migration manually before deployment, and regenerate `src/db/database.types.ts` with Supabase.
- Extend the draft-create, draft-update, and approval request validation and writes with an optional note normalized to `null` when empty. The approval write must remain in the approval transaction.
- Select the note only in `src/pages/admin/quotes/[id].astro`, pass it as `initialDiagnosisNote`, and render non-empty notes as `whitespace-pre-line` text in the authenticated read-only panel.
- Keep `QuotePayloadSchema`, `buildQuoteContent`, the `QuoteContent` invariant, and `get_quote_by_token` free of the note.
- Add the symmetric `QuotePayloadSchema` stripping test and risk #13 E2E assertion that a known note occurs neither in anonymous HTML nor the patient RPC response.

### Success Criteria

#### Automated Verification

- The new migration is present, generated database types include `diagnosis_note`, and targeted unit tests pass.
- The anonymous E2E probe proves the note is absent from both response surfaces.
- `npm test`, `npm run lint`, and `npm run build` pass.

#### Manual Verification

- A draft and an approved quote show a non-empty note only in the admin panel; an empty note renders no empty frame.

## Phase 3: Note-first quote creation

### Changes Required

- In `src/components/admin/QuoteEditor.tsx`, make the note block the first and dominant section only for a new draft.
- Start the detailed form collapsed behind “Dostosuj formularz ręcznie”; after prefill, keep it collapsed until the dentist explicitly opens it.
- Preserve the existing open form for existing drafts and read-only quotes, all field semantics, and approval flow.
- Include the note in the existing draft autosave and approval request bodies without making it a prefill/approval requirement.

### Success Criteria

#### Automated Verification

- `npm run test:e2e` passes without unrelated specification edits.

#### Manual Verification

- A new draft is note-first, manual controls can be opened and corrected after prefill, and existing drafts stay expanded.

## Phase 4: Editor, chart, and loading polish

### Changes Required

- Use a `sm:grid-cols-2` wrapper for the two existing email and patient-type sections; preserve their titles and mobile stacking.
- Place `ToothChart` and `ChartLegend` beside each other in editor and patient views at `lg`, vertically below it and in print. Keep the print layout compatible with paper width.
- Render populated notes as text, no empty note containers, and approved tooth selections as wrapping text-labelled badges rather than disabled controls.
- Give the chart a contrasting surface; retain white fill outside plan teeth; render centered, subdued FDI labels only inside planned teeth, with a focused unit test. Preserve non-colour print cues.
- Add the shared controlled `InfoHint` component using installed Radix Tooltip and `Info`; its button trigger supports hover, focus, and tap and keeps text in the accessibility tree through `aria-describedby`.
- Move the two agreed help sentences into hints and use the new truthful private-note wording.
- Add an `aria-busy`, inert/pointer-events overlay during parsing. It blocks form editing but not scroll and retains the `treeRef.current` merge path.

### Success Criteria

#### Automated Verification

- Chart-label unit tests, `npm test`, and `npm run test:e2e` pass.
- `patient-print-layout.spec.ts` remains behavioural-identical except for its approved heading string.

#### Manual Verification

- At desktop the paired layouts are side-by-side; at mobile and A4 print they stack.
- Tooltip content is available by keyboard and touch; prefill visibly marks the editor busy.

## Phase 5: Product documents

### Changes Required

- Add FR-077 and FR-078 to `context/foundation/prd.md`.
- Mark roadmap slice S-10 `quote-form-polish` done with its prerequisites and PRD references.
- Add risk #13 and phase coverage to `context/foundation/test-plan.md`.
- Update README only if its migration section needs one sentence explaining the now-real manual migration procedure.

### Success Criteria

#### Automated Verification

- Documentation references match the implemented routes, migration, and test names.

#### Manual Verification

- The product contract states the privacy boundary without implying that the patient page receives the note.

## Testing Strategy

- Unit: prompt wording, payload stripping, FDI-label display condition.
- E2E: anonymous note non-disclosure; existing print, patient-content, quote round-trip, and chart contracts.
- Manual: actual device scan and visual review are deferred to the session D evidence workflow; no image is treated as an agent visual sign-off.

## Migration Notes

The migration is additive and nullable, so no backfill is required. Before phase 2 completes, link the Supabase CLI to `ebvqvxtuhdcfopifuzsl`, record the applied state, run the documented manual `supabase db push`, regenerate types, and record the result. A rollback can remove the unused nullable column only before writes rely on it; after deployment, revert application code first and preserve data unless a deliberate migration is approved.

## References

- Session scope: `PLAN-ROZSZERZENIE.md` §3 “Sesja 14” in the coordination repository.
- Privacy boundary: `src/types.ts`, `src/lib/services/quote-payload.ts`, `supabase/migrations/20260603194110_quotes_foundation.sql`.
- Existing write pattern: `src/pages/api/admin/quotes/{index,[id],approve}.ts`.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Vocabulary

#### Automated

- [x] 1.1 Prompt, UI, and two approved E2E string updates pass tests. — f1addd1

#### Manual

- [x] 1.2 Verify general and local anaesthesia wording remains distinct. — f1addd1

### Phase 2: Private diagnosis note

#### Automated

- [x] 2.1 Apply and type-regenerate the nullable diagnosis-note migration.
- [x] 2.2 Prove payload stripping and anonymous non-disclosure with unit and E2E tests.
- [x] 2.3 Run unit, lint, and production-build verification.

#### Manual

- [x] 2.4 Verify admin-only draft and approved note rendering, including empty state.

### Phase 3: Note-first quote creation

#### Automated

- [ ] 3.1 Note-first creation and autosave/approval wiring pass E2E.

#### Manual

- [ ] 3.2 Verify progressive disclosure for new versus existing quotes.

### Phase 4: Editor, chart, and loading polish

#### Automated

- [ ] 4.1 Responsive/read-only/chart/hint/overlay coverage and E2E pass.
- [ ] 4.2 Preserve the patient print contract outside the approved heading update.

#### Manual

- [ ] 4.3 Verify A4, keyboard/touch hints, and visible parsing busy state.

### Phase 5: Product documents

#### Automated

- [ ] 5.1 Product documents describe the delivered privacy and loading contracts.

#### Manual

- [ ] 5.2 Review documents against the implementation before PR.
