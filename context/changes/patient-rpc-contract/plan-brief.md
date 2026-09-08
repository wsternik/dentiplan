# Public Patient RPC Contract — Plan Brief

> Full plan: `context/changes/patient-rpc-contract/plan.md`

## What & Why

The anonymous `get_quote_by_token` RPC currently exposes the internal quote UUID even though the patient page needs only patient type, frozen content, and creation time. Narrowing the database return signature removes that unnecessary identifier at the source and restores the documented patient-safe boundary.

## Starting Point

The RPC is already the only anonymous read path and correctly restricts rows to approved tokens. Its return signature, generated types, `PatientView`, SQL probe, contract registry, and privacy E2E still encode or tolerate a four-field response.

## Desired End State

An anonymous raw RPC call returns exactly `patient_type`, `content`, and `created_at`. The hosted migration history, generated TypeScript types, application contract, probe, and test all describe and enforce that same shape.

## Key Decisions Made

| Decision        | Choice                                                                    | Why                                                                              |
| --------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Migration form  | Drop and recreate the function in one migration                           | PostgreSQL cannot change a function's table return type with `CREATE OR REPLACE` |
| Public contract | Exact three-field whitelist                                               | Exactness prevents future accidental additions, not only the known `id` leak     |
| Behaviour       | Preserve token filter, grants, `SECURITY DEFINER`, and pinned search path | The defect is response shape, not access semantics                               |
| Verification    | Catalog probe plus raw anonymous HTTP assertion                           | Covers both deployed schema structure and caller-visible JSON                    |

## Scope

**In scope:** one forward migration, hosted application, generated types, `PatientView`, contract registry, SQL probe, and exact E2E response keys.

**Out of scope:** changing table IDs, token generation, patient route UX, RLS policies, existing E2E flow, or historical migrations.

## Architecture / Approach

The migration replaces only `public.get_quote_by_token(text)`, preserving its security properties and grants while narrowing the selected columns. All downstream representations are regenerated or derived from that database contract, and both catalog-level and HTTP-level checks assert the exact whitelist.

## Phases at a Glance

| Phase                       | What it delivers                                                 | Key risk                                         |
| --------------------------- | ---------------------------------------------------------------- | ------------------------------------------------ |
| 1. Contract synchronization | Migration, generated/domain types, registry, and exact SQL probe | Hosted/local schema drift during type generation |
| 2. Anonymous verification   | Exact raw-response E2E and hosted-schema verification            | E2E must run only after the migration is applied |

**Prerequisites:** linked hosted Supabase project and configured anonymous key.
**Estimated effort:** one focused change across two phases.

## Open Risks & Assumptions

- The migration must be applied before running the updated hosted-backed E2E.
- Rollback requires another migration recreating the prior four-column signature; reverting application code alone does not alter Supabase schema.

## Success Criteria (Summary)

- Hosted and local migration histories contain the new migration and generated types contain no RPC `id`.
- SQL probe and raw anonymous HTTP response assert exactly the three patient-safe fields.
- Unit, lint, typecheck, build, and E2E gates are green without modifying existing flow semantics.
