-- Keep the anonymous patient RPC limited to fields the patient page consumes.
-- PostgreSQL cannot change a function's RETURNS TABLE shape with
-- CREATE OR REPLACE, so replace the function and restore its explicit grants
-- in the same migration.

drop function public.get_quote_by_token(text);

create function public.get_quote_by_token(p_token text)
returns table (patient_type text, content jsonb, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select patient_type, content, created_at
  from public.quotes
  where token = p_token and status = 'approved'
$$;

revoke all on function public.get_quote_by_token(text) from public;
grant execute on function public.get_quote_by_token(text) to anon, authenticated;
