alter table public.quotes
  add column diagnosis_note text;

comment on column public.quotes.diagnosis_note is
  'Admin-only raw diagnosis note. Never copy this value into content or expose it through get_quote_by_token.';

comment on table public.quotes is
  'DentiPlan quotes. content jsonb is patient-visible verbatim via get_quote_by_token and must never contain raw diagnosis notes or other admin-only data.';
