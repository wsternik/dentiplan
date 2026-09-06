# Follow-ups from the implementation review

Three findings were consciously left unfixed in the review round (2026-09-06). The
reasons are in `../reviews/impl-review.md`; this file is the queue.

- **F5 — Safari focus ring.** The chart's only focus indicator is
  `focus-visible:outline-*` on an SVG `<g>` (`ToothChart.tsx:144-147`). WebKit
  historically does not paint CSS `outline` on SVG. Verify in Safari (desktop and iOS)
  during the manual visual pass; if it does not paint, replace it with a stroke-based
  indicator, which also survives print and forced-colors. Blocks nothing; the ring is
  confirmed working in Chromium.

- **F7 — `URGENCY_INK` belongs in `marks.ts`.** `ChartLegend.tsx:23-27` defines a
  fourth urgency table in a component. Moving only that copy would leave four call
  sites bypassing it (`Banner.astro:20-21`, `ToothRow.tsx:161`, `QuoteEditor.tsx:579`,
  `ParseWarnings.tsx:34`), so the fix is one sweep: extract the table into `marks.ts`
  beside `URGENCY_MARK` / `URGENCY_FILL` and route all five through it. Touches files
  outside this change's scope, which is why it is not in this PR.

- **F4 — React on the patient page.** `client:load` costs ~70 KB gz on a document that
  previously shipped no JavaScript, and buys a hover/tap tooltip over an SVG that is
  already fully server-rendered. The plan decided "measure before optimising"; the
  measurement is recorded in the review. If the weight ever shows as a real cost, the
  plan's own fallback applies: render the base drawing server-side and hydrate only the
  tooltip.
