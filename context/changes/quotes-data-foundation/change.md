---
change_id: quotes-data-foundation
roadmap_id: F-01
title: Domain schema for quotes/teeth/visits/snapshot in Supabase with RLS
status: implementing
created: 2026-06-03
updated: 2026-06-03
prd_refs: [FR-050, FR-051, FR-070, FR-072, FR-053, Access Control]
prerequisites: []
unlocks: [first-thin-quote-and-patient-link, llm-parsing-prefill, admin-quote-list, rodo-retention-enforcement]
---

# Change: quotes-data-foundation (F-01)

## Identity

Foundation slice. Establishes the Supabase domain schema every downstream slice
(S-01–S-04) reads and writes: the `quotes` table with a JSONB `content` tree
(teeth, visits, per-tooth pricelist items, general items), the immutable
approval snapshot, the cryptographic patient token, the dentystka's reference
e-mail, RLS, the public patient-read RPC, and the TypeScript + Zod type layer.

## Scope anchor

Pure data layer: migrations, DB security objects (RLS, RPC, trigger), and types.
No UI, no API endpoints, no token generation, no cost calculation, no pricelist
table (the pricelist is a repo seed — F-02). Those belong to S-01 and later.

## Artifacts

- `plan.md` — implementation contract
- `plan-brief.md` — compressed handoff
