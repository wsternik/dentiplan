# Quotes Data Foundation (F-01) — Plan Brief

> Full plan: `context/changes/quotes-data-foundation/plan.md`

## What & Why

Build DentiPlan's data layer — the Supabase schema every quote flows through. A single `quotes` table stores each quote's full working tree (teeth, per-tooth pricelist items, visits, general items) as a Zod-validated JSONB `content` blob, plus the immutable approval snapshot, the cryptographic patient token, the dentystka's reference e-mail, and lifecycle timestamps. Without this foundation, none of S-01–S-04 can be built; getting its boundaries wrong forces painful migrations later.

## Starting Point

The project has Supabase auth (SSR cookie sessions, single dentystka, no roles) but **no domain schema at all**: no `supabase/migrations/`, no `src/types.ts`. This is the project's first migration. The pricelist is a repo seed (F-02), not a DB table, so pricelist values live in the DB only inside an approved quote's snapshot.

## Desired End State

A `quotes` table protected by deny-by-default RLS; the dentystka has full CRUD on her quotes; the public patient page reads through one `SECURITY DEFINER` RPC that returns only patient-safe fields for *approved* tokens and is indistinguishable from "not found" otherwise; an approved quote is immutable at the database level; and a synchronized TypeScript + Zod type layer makes the JSONB `content` a first-class contract. All proven by a checked-in SQL probe.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Quote content storage | One JSONB `content` blob | Atomic, editable as a document, trivial to freeze on approval; fits low data volume; matches the inline-snapshot decision | Plan |
| Patient read path | `SECURITY DEFINER` RPC by token | One place encodes token check + field whitelist + FR-060 no-disclosure; no service-role secret on the public route | Plan |
| Snapshot scope | Whole resolved quote (freeze `content`) | Approved quote is fully self-sufficient, immune to later pricelist/logic changes (FR-050/053) | Plan |
| Immutability enforcement | `BEFORE UPDATE` trigger on approved rows | Guaranteed at the source regardless of app bugs; "forensic snapshot" guarantee | Plan |
| Token at rest | Raw, unique-indexed | Ample entropy makes guessing infeasible; hashing adds little for single-tenant; keeps RPC simple | Plan |
| Types | Generated row types + hand-written domain types + Zod | Row types stay in sync with migrations; jsonb `content` gets a real type + runtime validator | Plan |
| Forward columns | Add `patient_email`, `created_at`, `approved_at`, `status` now | F-01 is the one-time foundation; S-03/S-04 add behavior, not migrations | Plan |
| Quote identifier | UUID PK | Non-enumerable, standard Supabase pattern, no sequence to manage | Plan |
| Verification | SQL probe against local Supabase | Only way to prove RLS/RPC/trigger pre-UI | Plan |

## Scope

**In scope:** First migration (table + constraints + indexes + RLS), patient-read RPC, immutability trigger, generated DB types + hand-written domain types/Zod in `src/types.ts`, SQL verification probe, contract-surfaces registry.

**Out of scope:** Token *generation* (S-01), pricelist table (F-02 seed), cost calculation (S-01), any UI/API/services, retention logic (S-04), token hashing, service-role secret.

## Architecture / Approach

One `quotes` table is the whole relational footprint; structured data lives in a single Zod-owned `content` jsonb. Security is layered in the database, not the app: RLS denies `anon` everything; the only public read is a search-path-pinned `SECURITY DEFINER` function returning whitelisted columns for approved tokens; a trigger freezes approved rows. Types flow schema → generated row types → hand-written `QuoteContent` + Zod validator.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Core schema & RLS | `quotes` table, constraints, indexes, deny-by-default RLS + owner policies | Missing a column that forces a later migration on the load-bearing table |
| 2. RPC & trigger | Public `get_quote_by_token` (anon, approved-only, whitelisted) + immutability trigger | RPC leaking email/draft data; trigger blocking the approving update itself |
| 3. Type & Zod contract | Generated `database.types.ts` + domain types + `QuoteContentSchema` in `src/types.ts` | `QuoteContent` shape missing a per-tooth field S-01 needs |
| 4. Probe & registry | SQL probe proving RLS/RPC/trigger + `contract-surfaces.md` | Shipping the security objects unverified |

**Prerequisites:** Local Supabase via Docker (`supabase start`); `supabase` CLI (already a devDependency).
**Estimated effort:** ~1–2 sessions across 4 phases (DB-only, no UI).

## Open Risks & Assumptions

- `content` integrity is enforced by Zod at app boundaries, not FK constraints — acceptable for a single-operator MVP, but later slices must always read/write through the schema.
- The `QuoteContent` shape is designed up front from the FRs; if S-01 surfaces a missing field it's a `content`-only change (no table migration), which is the cheap kind.
- Production migration apply happens during the first deploy that needs it (S-01); F-01 ships no runtime code.

## Success Criteria (Summary)

- A patient-safe quote is readable by token only when approved, with no email/draft leakage and no existence disclosure (FR-060/066).
- An approved quote can never be mutated; editing means a new quote (FR-053).
- Migrations apply cleanly, types compile, and the SQL probe passes against a fresh local database.
