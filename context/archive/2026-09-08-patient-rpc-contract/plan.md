# Public Patient RPC Contract Implementation Plan

## Overview

Remove `id` from the anonymous `get_quote_by_token` return shape and synchronize every representation and verification surface. Preserve the existing approved-only, token-capability, no-disclosure, and `SECURITY DEFINER` behaviour.

## Current State Analysis

- `supabase/migrations/20260603194110_quotes_foundation.sql` returns and selects `id` alongside three patient-facing fields.
- `src/db/database.types.ts` therefore exposes `id` in the generated RPC return row, and `src/types.ts` derives `PatientView` from that row.
- `docs/reference/contract-surfaces.md` documents the four-field shape.
- `supabase/tests/quotes_foundation_probe.sql` rejects named admin fields but does not require the exact result signature.
- `e2e/diagnosis-note-privacy.spec.ts` checks the raw body for the diagnosis note but not its exact keys.

## Desired End State

The deployed RPC returns at most one approved quote and exactly the columns `patient_type`, `content`, and `created_at`. Generated and domain types match that signature, documentation names it, and two independent checks fail on any extra top-level field.

## What We're NOT Doing

- No change to `public.quotes`, its UUID primary key, RLS, token handling, or immutability trigger.
- No edit to the historical foundation migration.
- No patient UI or response-status change.
- No cleanup of existing approved records beyond the established E2E-prefix procedure.

## Phase 1: Synchronize the database contract

### Changes Required

1. **`supabase/migrations/20260908*_restrict_patient_rpc_fields.sql`**
   - **Intent:** Narrow the anonymous boundary at its source.
   - **Contract:** Drop the existing text-argument function and recreate it with the same language, stability, security-definer setting, pinned search path, approved-token predicate, and explicit grants, returning only `patient_type text`, `content jsonb`, and `created_at timestamptz`.
2. **`src/db/database.types.ts` and `src/types.ts`**
   - **Intent:** Keep generated and narrowed application types mechanically aligned with the deployed schema.
   - **Contract:** Regenerate linked Supabase types after migration; `PatientView` remains derived from the RPC row and contains no `id`.
3. **`supabase/tests/quotes_foundation_probe.sql`**
   - **Intent:** Turn the whitelist from a negative spot-check into an exact structural assertion.
   - **Contract:** Catalog signature must equal the three-column table result in order and type while the existing role/row-count checks remain intact.
4. **`docs/reference/contract-surfaces.md`**
   - **Intent:** Make the registry state the new load-bearing signature.
   - **Contract:** Document exactly the three returned fields and the exact-whitelist verification rule.

### Success Criteria

#### Automated Verification

- The forward migration applies to the linked hosted project and `supabase migration list` shows no local/remote divergence.
- Linked type generation removes `id` from `get_quote_by_token.Returns` while retaining the three required fields.
- `npm test`, `npm run lint`, `npx astro check`, and `npm run build` pass.

## Phase 2: Enforce the caller-visible response

### Changes Required

1. **`e2e/diagnosis-note-privacy.spec.ts`**
   - **Intent:** Prove the raw anonymous caller receives no unlisted top-level field.
   - **Contract:** Parse the one-row JSON response and assert its keys equal `content`, `created_at`, and `patient_type`; keep the existing positive persistence and negative note-leak checks.
2. **Hosted verification**
   - **Intent:** Exercise the exact deployed schema/code combination used by the application.
   - **Contract:** Run the focused privacy E2E after the hosted migration, then the unchanged full E2E suite before review.

### Success Criteria

#### Automated Verification

- The focused diagnosis-note privacy E2E passes against the hosted Supabase project.
- The full E2E suite passes without edits to unrelated specs.
- A raw anonymous RPC response contains exactly one row with the three approved patient-safe keys.

## Testing Strategy

- The catalog probe owns the SQL-level exact function signature and role/row semantics.
- The privacy E2E owns the actual PostgREST response visible to an anonymous token holder.
- Existing unit, lint, typecheck, build, and full E2E gates guard regressions outside the boundary.

## Migration Notes

PostgreSQL requires dropping the old function before recreating it because the `RETURNS TABLE` row type changes. The migration performs both statements together and then reapplies explicit grants. If rollback becomes necessary, create a new forward migration that recreates the prior signature; do not rewrite applied history.

## References

- `docs/reference/contract-surfaces.md`
- `context/foundation/test-plan.md` risk #13
- `context/deployment/runbook.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Synchronize the database contract

#### Automated

- [x] 1.1 Apply the forward migration and confirm hosted migration parity. — d4c4e27
- [x] 1.2 Regenerate types and verify the exact three-field RPC contract across code, probe, and registry. — d4c4e27
- [x] 1.3 Pass unit, lint, typecheck, and production build checks. — d4c4e27

### Phase 2: Enforce the caller-visible response

#### Automated

- [x] 2.1 Assert exact keys in the raw anonymous RPC response. — 89b4d6f
- [x] 2.2 Pass the focused privacy E2E against the hosted schema. — 89b4d6f
- [x] 2.3 Pass the unchanged full E2E suite. — 89b4d6f
