---
change_id: quote-approval-flow-analysis
title: Analysis of the quote approval flow, editor through patient link
status: implemented
created: 2026-09-04
updated: 2026-09-06
archived_at: null
---

## Notes

Deep Focus on one flow, chosen from `context/map/repo-map.md`: the approval
transaction — editor → server-side validation → pricelist snapshot → INSERT →
token → patient page.

Why this flow, in the map's own terms:

- **Risk zone R1** — `src/pages/api/admin/quotes/approve.ts` is the deepest
  endpoint in the repo (Ce=7), composes four separately-tested modules into one
  irreversible transaction, and has no test of its own.
- **Risk zone R2** — the `/p/<token>` render path is the product's privacy
  boundary and is 100% invisible to dependency-cruiser, so the structural map
  cannot say anything about it. Whatever is true there has to be established by
  reading and by e2e.
- **Entry points** (map §6): `approve.ts`, `src/types.ts`,
  `src/pages/p/[token].astro`.
- **First unknowns** carried over from the map's §7: the DB-side guarantees
  (RLS policies, the immutability trigger, the `get_quote_by_token` RPC) are
  outside every instrument used so far.

This change is analysis only — describe the current state, change no code. The
question of _which_ of the findings deserve fixing is deliberately left open
for a separate change.

## Outcome

Delivered: `research.md` (517 lines, its own frontmatter `status: complete`) —
six recorded problems D1–D6 across the approval transaction and the patient
path, each with its blast radius and the instrument that would prove it.

There is no `plan.md` and no implementation here, and there was never meant to
be one: `status: implemented` on an analysis-only change means the deliverable
is delivered, not that code moved. The half this change deliberately left open
— which of the findings are worth fixing, in what order — was picked up by
`refactor-opportunities`, which takes this file as its stated input and ranks
the six into three opportunities; one of them (C2) shipped in `dc8e89e`.

Closed 2026-09-06. Nothing in the analysis was invalidated in the meantime; the
findings that remain unfixed live on in `refactor-opportunities`, not here.
