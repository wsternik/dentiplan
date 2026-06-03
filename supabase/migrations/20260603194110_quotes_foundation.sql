-- Migration: quotes foundation (F-01)
--
-- Establishes DentiPlan's sole domain table `public.quotes`, deny-by-default RLS
-- with owner policies for the single authenticated dentystka, the public
-- patient-read RPC (`get_quote_by_token`, SECURITY DEFINER), and the
-- approved-quote immutability trigger.
--
-- Statement order is load-bearing:
--   table -> indexes -> RLS enable -> policies -> trigger fn + trigger -> RPC + grant
--
-- Phase 1 (this block): table, constraints, indexes, RLS enable + owner policies.
-- Phase 2 (appended below): immutability trigger + get_quote_by_token RPC.

-- ---------------------------------------------------------------------------
-- Phase 1: core schema
-- ---------------------------------------------------------------------------

-- 1. Table: the sole domain table. One JSONB `content` tree holds each quote's
--    working data (teeth, visits, per-tooth pricelist items, general items);
--    `content` is frozen on approval by the Phase 2 trigger and is returned
--    verbatim to anon by the Phase 2 RPC, so it must contain ONLY patient-safe
--    data (no email, notes, margins, raw LLM output, or identifiers).
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  patient_type text not null check (patient_type in ('child', 'adult')),
  status text not null default 'draft' check (status in ('draft', 'approved')),
  token text,                              -- nullable until approval (populated by S-01); uniqueness enforced by partial index below
  patient_email text,                      -- nullable; admin-only reference per FR-072
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  approved_at timestamptz                  -- set on draft -> approved transition (S-01)
);

comment on table public.quotes is
  'DentiPlan quotes. content jsonb is patient-visible verbatim via get_quote_by_token; never store admin-only data inside content.';

-- 2. Indexes.
--    Partial unique index enforces token uniqueness only over populated tokens
--    (drafts carry a NULL token until approval). `created_at` index serves the
--    admin list ordering (S-03) and the retention scan (S-04).
create unique index quotes_token_key on public.quotes (token) where token is not null;
create index quotes_created_at_idx on public.quotes (created_at);

-- ---------------------------------------------------------------------------
-- Phase 1: RLS — deny by default, full CRUD for the single authenticated operator
-- ---------------------------------------------------------------------------

alter table public.quotes enable row level security;

-- Single-operator model: exactly one dentystka, no per-user ownership column.
-- Granular per-operation policies for `authenticated`. No policy is created for
-- `anon`, so anon has no direct table access — its only path is the Phase 2 RPC.

create policy quotes_authenticated_select on public.quotes
  for select to authenticated
  using (true);

create policy quotes_authenticated_insert on public.quotes
  for insert to authenticated
  with check (true);

create policy quotes_authenticated_update on public.quotes
  for update to authenticated
  using (true)
  with check (true);

create policy quotes_authenticated_delete on public.quotes
  for delete to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Phase 2: approved-quote immutability trigger
-- ---------------------------------------------------------------------------

-- Guarantees at the database that an already-approved quote can never be
-- mutated (FR-053 forensic snapshot), independent of any future app bug. The
-- guard keys on OLD.status: it blocks UPDATEs to rows that are *already*
-- approved, while letting the one-time draft -> approved transition (and any
-- other update to a still-draft row) pass through. UPDATE only — DELETE of an
-- approved row is deliberately left to the owner so S-04 retention can purge
-- aged quotes.
create function public.prevent_approved_update() returns trigger
language plpgsql as $$
begin
  if OLD.status = 'approved' then
    raise exception 'approved quotes are immutable (id=%)', OLD.id;
  end if;
  return NEW;
end;
$$;

create trigger quotes_immutable before update on public.quotes
  for each row execute function public.prevent_approved_update();

-- ---------------------------------------------------------------------------
-- Phase 2: public patient-read RPC (SECURITY DEFINER)
-- ---------------------------------------------------------------------------

-- The single anon-callable read path for the patient page. Returns at most one
-- row of whitelisted, patient-safe columns for a valid *approved* token and is
-- byte-for-byte indistinguishable from "not found" for any other input —
-- unknown token, draft token, future-expired token all yield zero rows
-- (FR-060 no-disclosure). Never returns patient_email, status, or token
-- (FR-066/FR-072).
--
-- Security hardening: SECURITY DEFINER runs as the function owner (which can
-- read the table despite RLS), `set search_path = ''` plus the fully-qualified
-- public.quotes neutralises search-path injection, and the explicit column
-- whitelist (never select *) keeps admin-only fields off the public path.
create function public.get_quote_by_token(p_token text)
returns table (id uuid, patient_type text, content jsonb, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select id, patient_type, content, created_at
  from public.quotes
  where token = p_token and status = 'approved'
$$;

-- anon has no direct table privileges; this RPC is its only read path. Revoke
-- the default PUBLIC execute grant, then grant explicitly to the roles allowed
-- to call it.
revoke all on function public.get_quote_by_token(text) from public;
grant execute on function public.get_quote_by_token(text) to anon, authenticated;
