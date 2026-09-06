# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Verifying a media-dependent behaviour needs the medium's dimensions, not just its name

- **Context:** `ui-redesign`, phase 4. The patient page must print with the two
  treatment variants side by side — stated in the design brief and in the plan's
  phase contract.
- **Problem:** The criterion was marked verified against a screenshot taken with
  `emulateMedia({ media: "print" })` at a **1280px viewport**. The grid is
  `md:grid-cols-2` (768px) and A4 at default margins is about 717px of printable
  width, so on real paper the tabs stacked. Emulating the medium changed which
  CSS applied; it did not change the width the breakpoint was evaluated against,
  and the capture showed exactly the expected result. An implementation reviewer
  found it by reading the breakpoint against the paper size.
- **Rule:** When a behaviour depends on a media query, verify it at the
  **dimensions** of that medium, not only under its name. For print, measure at
  the printable width (~717px A4 / ~739px Letter at default margins) or render an
  actual PDF and inspect it — never a print-emulated screenshot at a screen
  viewport. Prefer `sm:` (640px) over `md:` (768px) for any layout that must
  survive printing.
- **Applies to:** every `@media print` rule and every responsive layout with a
  print contract. Immediately relevant to S-07, which puts a QR code on this same
  printed page.

## Print drops background images, so a background cannot carry meaning on paper

- **Context:** `ui-redesign`, phase 4. Deferred teeth are distinguished by dimming
  plus a hatched rule drawn as a `repeating-linear-gradient`.
- **Problem:** Browsers suppress background images in print unless the reader
  ticks "Background graphics", and the print block deliberately removed the
  dimming (opacity prints as grey mush). On paper the section lost both of its
  distinctions at once and deferred teeth looked identical to teeth in the plan —
  the one thing the section exists to prevent, on a document whose whole point is
  being printed.
- **Rule:** Never let a `background-image` or `background-color` be the only
  carrier of meaning on something that gets printed. Add
  `print-color-adjust: exact`, and back it with a property that always prints —
  a border, a glyph, or text. If a distinction matters, it must survive the
  reader's default print settings.
- **Applies to:** the patient page and anything else a patient takes home.

## Composed dimming multiplies, and clinical text has a contrast floor

- **Context:** `ui-redesign`. A section carried `opacity-65`; its descendants
  carried `text-muted-foreground`.
- **Problem:** The two dims multiply. 5.55:1 became 2.72:1 — under the AA floor,
  on patient-facing text about the reader's own mouth. Neither value looks wrong
  on its own.
- **Rule:** Use one dimming mechanism per subtree. If a container is dimmed, its
  text uses the full-strength foreground. Measure composited contrast by painting
  the colour to a canvas — `getComputedStyle().color` returns `oklch()` strings
  in Chrome, and parsing those as RGB gives numbers that look plausible and are
  nonsense.
- **Applies to:** any patient-facing text; the tooth chart in S-06 in particular,
  where marks and labels sit together.

## Do not dim a container whose controls are still live

- **Context:** `ui-redesign`, phase 3. An out-of-plan tooth row was dimmed to 65%.
- **Problem:** Every control inside stayed enabled, so the row read as disabled
  while being fully interactive — and the control needed to put the tooth back
  into the plan was itself the dimmed one.
- **Rule:** Opacity on a container is a claim that everything inside is inactive.
  If the controls still work, signal state with an outline, a ground, or a label
  instead.
- **Applies to:** the editor's status treatments, and any future read-only or
  de-emphasised state.

## A field the model writes is patient-visible until something stops it

- **Context:** `llm-parsing-prefill` closed `note` — the model was no longer
  allowed to write a tooth's note, because `content` is returned byte-for-byte to
  anyone holding the patient link. `visit-planning-prefill`, a whole slice later,
  found `Visit.label` sitting one line away in the same mapper: the model wrote
  it, the mapper copied it verbatim into `content`, and it rendered on the
  patient page.
- **Problem:** The first excision was made as a fix to one field, not as a sweep
  of the boundary, so the second free-text field stayed open and nothing was
  watching it. Zod v4 objects **strip** unknown keys, so removing the field from
  the wire schema breaks no fixture on its own — the hole is invisible in both
  directions until someone reads the four hops end to end.
- **Rule:** When a model-authored field turns out to reach a surface the model
  must not write on, treat it as a **class**, not an instance: enumerate every
  free-text field crossing that boundary in the same pass, and leave behind an
  assertion that fails when a new one appears — a positive check that the visible
  string is a member of a closed dictionary, not a negative check that one known
  field is gone. Facts from the model, sentences from the code; anything the
  model needs to say in prose goes to the warnings, which only the dentystka
  reads.
- **Applies to:** every field of `QuoteContent` a prefill or a future model call
  can fill, and the invariant test in `parse-diagnosis.test.ts` that guards them.

## A green unit suite says nothing about the latency the prompt spends

- **Context:** `visit-planning-prefill`. Phase 2 grew `buildInstructions()` to ~9000
  characters — grouping rules, urgency evidence, the visit ceiling. Every test
  in `src/lib/llm/` passed, because they all feed a fixture through a stubbed
  `DiagnosisModel` and never make a call.
- **Problem:** Sonnet 5 thinks adaptively by default. The longer prompt pushed it
  to ~2600 reasoning tokens and **33.7 s** against the `TIMEOUT_MS = 30_000` in
  `client.ts`, so `/api/admin/quotes/parse` answered 502 on the first realistic
  note ever sent to production — deterministically, not intermittently. 83 unit
  tests, `astro check`, lint, five E2E specs and three review passes were all
  green on a feature that could not complete a single call. The seam that keeps
  `parse-diagnosis.ts` pure is exactly what hides this: the one thing no test
  crosses is the one thing the request budget is spent on.
- **Rule:** A change that edits the prompt has changed the **cost** of the call,
  not just its wording. Measure the call once against the real provider before
  merging, and size the timeout against that measurement rather than a round
  number. Reading a note and naming what is in it is extraction, not
  deliberation — set `effort` explicitly (`medium` here: same split, ~17 s) so a
  provider default cannot silently spend the budget on reasoning.
- **Applies to:** every future edit to `src/lib/llm/prompt.ts`, the S12 eval
  corpus (whose per-case cost is this same number), and any second model call
  added to a request path.
