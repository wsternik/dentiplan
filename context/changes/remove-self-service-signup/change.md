---
change_id: remove-self-service-signup
title: Remove self-service sign-up from the app and from the Supabase project
status: in-progress
created: 2026-09-06
updated: 2026-09-06
---

## Notes

The sign-in page offered "Don't have an account? Sign up", and behind that link
sat a working registration path: `src/pages/auth/signup.astro`, the `SignUpForm`
island, `POST /api/auth/signup` calling `supabase.auth.signUp`, and
`confirm-email.astro`. None of it was ever asked for. It is starter scaffolding
that survived the redesign, which restyled those pages instead of deleting them
(`context/archive/2026-09-05-ui-redesign/plan.md`, step 2.6).

It contradicts the documented access model. `prd.md` § Access Control:
"Konto dentystki tworzone ręcznie (1 konto na MVP, **brak self-service
signup**)"; `shape-notes.md` says the same. So does the schema — the RLS
migration writes the assumption down in a comment:

> Single-operator model: exactly one dentystka, no per-user ownership column.

and then grants `authenticated` unconditional `select / insert / update /
delete` on `public.quotes` (`20260603194110_quotes_foundation.sql`). The quotes
table has no owner column, because there is only supposed to be one owner. With
self-service sign-up open, anyone who registered got the `authenticated` role
and, with it, every patient's quote — read and write. `middleware.ts` protects
`/admin` by asking whether a session exists, not whose it is, which is the
correct check under the single-operator model and the wrong one the moment
strangers can mint sessions.

So this is not auth hardening (roadmap S-05: inactivity timeout, rate limiting)
and does not touch it. It is closing a door the PRD never opened.

## Scope

- Delete the sign-up page, the sign-up form island, the sign-up endpoint and the
  confirm-email page; remove the link from `signin.astro`.
- `enable_signup = false` in `supabase/config.toml` (both `[auth]` and
  `[auth.email]`), so a fresh local stack matches. The GoTrue API of the hosted
  project is reachable with the publishable key regardless of what the app ships,
  so the hosted project has to be switched too — that is a console setting, not
  a migration, and it is the half of this change that actually closes the hole.
- One e2e guard, so the door does not reopen with the next scaffold.
- Docs that described the old shape: `CLAUDE.md`, `README.md`, roadmap baseline,
  `deploy-plan.md`, and the risk-#6 row in `test-plan.md`.

Out of scope: how the one account is created (by hand in Supabase, as before),
session TTL, rate limiting, password policy — all S-05.
