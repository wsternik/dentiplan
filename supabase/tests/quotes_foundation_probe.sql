-- quotes_foundation_probe.sql — F-01 acceptance probe (local-only, manual/dev gate)
--
-- Exercises the real RLS / RPC / trigger behavior of the quotes foundation
-- end-to-end against a live Postgres, with NO app code. This is the repeatable
-- evidence for this DB-only change; it is NOT wired into CI (CI has no database).
--
-- Run against local Supabase:
--   supabase db reset
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--        -f supabase/tests/quotes_foundation_probe.sql
--
-- The whole probe runs inside a single transaction that is ROLLED BACK at the
-- end, so it seeds its own fixtures (one draft, one approved) and leaves the
-- database byte-for-byte unchanged. ON_ERROR_STOP makes any failed assertion
-- abort psql with a non-zero exit code, so a clean run == all guarantees hold.

\set ON_ERROR_STOP on
\timing off

begin;

-- ---------------------------------------------------------------------------
-- Fixtures: one draft, one approved. Inserted as the superuser connection;
-- inserting an already-approved row is fine (the immutability trigger guards
-- UPDATE only, not INSERT).
-- ---------------------------------------------------------------------------
insert into public.quotes (id, patient_type, status, token, patient_email, content, approved_at)
values
  ('11111111-1111-1111-1111-111111111111', 'adult', 'draft',
   'tok-draft', 'draft@example.com', '{}'::jsonb, null),
  ('22222222-2222-2222-2222-222222222222', 'child', 'approved',
   'tok-approved', 'approved@example.com', '{"teeth":[]}'::jsonb, now());

-- ===========================================================================
-- (a) anon CANNOT read the quotes table directly.
--     Either a permission-denied error (no table grant) or zero visible rows
--     (grant present but RLS denies) is acceptable — both mean no data leaks.
-- ===========================================================================
set local role anon;
do $$
declare
  visible int;
begin
  begin
    select count(*) into visible from public.quotes;
  exception when insufficient_privilege then
    visible := -1;  -- permission denied: anon has no table grant at all
  end;

  if visible > 0 then
    raise exception 'FAIL (a): anon read % row(s) directly from public.quotes (expected 0 or permission denied)', visible;
  end if;
  raise notice 'PASS (a): anon direct table read blocked (rows visible to anon: %)', greatest(visible, 0);
end $$;
reset role;

-- ===========================================================================
-- (b) get_quote_by_token: 1 patient-safe row for an approved token, 0 for
--     unknown AND draft tokens (FR-060 no-disclosure: the two non-approved
--     cases are indistinguishable). Called AS anon — its only read path.
-- ===========================================================================
set local role anon;
do $$
declare
  cnt int;
begin
  select count(*) into cnt from public.get_quote_by_token('tok-approved');
  if cnt <> 1 then raise exception 'FAIL (b1): approved token returned % row(s) (expected 1)', cnt; end if;

  select count(*) into cnt from public.get_quote_by_token('does-not-exist');
  if cnt <> 0 then raise exception 'FAIL (b2): unknown token returned % row(s) (expected 0)', cnt; end if;

  select count(*) into cnt from public.get_quote_by_token('tok-draft');
  if cnt <> 0 then raise exception 'FAIL (b3): draft token returned % row(s) (expected 0)', cnt; end if;

  raise notice 'PASS (b): RPC returns 1 for approved, 0 for unknown, 0 for draft (no-disclosure: unknown == draft)';
end $$;
reset role;

-- (b4) Structural: the RPC return signature must whitelist ONLY patient-safe
--      columns — never patient_email, status, or token. Checked against the
--      catalog so it holds regardless of stored data.
do $$
declare
  sig text;
begin
  select pg_get_function_result(p.oid) into sig
  from pg_proc p
  where p.proname = 'get_quote_by_token'
    and p.pronamespace = 'public'::regnamespace;

  if sig is null then
    raise exception 'FAIL (b4): get_quote_by_token not found in public schema';
  end if;
  if sig ilike '%patient_email%' or sig ilike '%status%' or sig ilike '%token%' then
    raise exception 'FAIL (b4): RPC return signature leaks an admin-only field: %', sig;
  end if;
  raise notice 'PASS (b4): RPC return signature whitelists only patient-safe columns -> %', sig;
end $$;

-- ===========================================================================
-- (c) UPDATE on an already-approved row RAISES (FR-053 forensic immutability).
-- ===========================================================================
do $$
declare
  raised boolean := false;
begin
  begin
    update public.quotes
       set content = '{"tampered":true}'::jsonb
     where id = '22222222-2222-2222-2222-222222222222';
  exception when others then
    raised := true;
    raise notice 'PASS (c): UPDATE on approved row raised as expected -> %', sqlerrm;
  end;

  if not raised then
    raise exception 'FAIL (c): UPDATE on an approved row did NOT raise';
  end if;
end $$;

-- ===========================================================================
-- (d) UPDATE of a draft row succeeds, INCLUDING the one-time draft->approved
--     transition (the trigger keys on OLD.status, so this must pass through).
-- ===========================================================================
do $$
declare
  st text;
begin
  -- plain draft mutation
  update public.quotes
     set content = '{"teeth":[]}'::jsonb
   where id = '11111111-1111-1111-1111-111111111111';

  -- draft -> approved transition (sets approval fields)
  update public.quotes
     set status = 'approved',
         approved_at = now(),
         token = 'tok-draft-now-approved'
   where id = '11111111-1111-1111-1111-111111111111';

  select status into st from public.quotes
   where id = '11111111-1111-1111-1111-111111111111';

  if st <> 'approved' then
    raise exception 'FAIL (d): draft->approved transition did not persist (status=%)', st;
  end if;
  raise notice 'PASS (d): draft UPDATE and draft->approved transition both succeeded';
end $$;

\echo ''
\echo '=================================================='
\echo ' ALL PROBE ASSERTIONS PASSED (a, b, b4, c, d)'
\echo '=================================================='
\echo ''

-- Clean up: roll back the whole transaction; the database is left untouched.
rollback;
