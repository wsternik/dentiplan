---
change_id: ui-redesign
title: A visual identity for DentiPlan — tokens, type, and layout across every page
status: impl_reviewed
created: 2026-09-05
updated: 2026-09-05
archived_at: null
---

## Notes

DentiPlan should look like a product, not like a starter. The patient page is the
hero: it is what a person sees after being handed a link, usually on a phone,
usually right after leaving the chair. Behaviour does not change — this is
tokens, typography, layout and component styling only.

Visual direction worked out with the `frontend-design` skill; the result lives in
`design-brief.md` next to this file.

Two constraints that shape the work:

- **DOM semantics are frozen.** `e2e/*.spec.ts` locate by role, label and button
  text. Those do not move. The redesign changes classes, tokens and layout.
- **The palette has a downstream consumer.** The tooth chart (S-06) colours teeth
  by urgency and distinguishes plan status by more than colour, so the brief has
  to name `urgent`/`moderate`/`mild` and `in-plan`/`uncertain`/`out-of-current-plan`
  as tokens now, rather than leaving the drawing to invent its own palette later.
