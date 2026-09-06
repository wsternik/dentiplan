---
title: Verification — the hosted project refuses sign-ups, and nobody used the open door
change_id: remove-self-service-signup
date: 2026-09-06
---

# Verification

Two questions the code change cannot answer on its own: does the _hosted_
Supabase project still accept a registration, and did anyone register while the
door stood open? Both were checked against the production project, not inferred.

## 1. The hosted GoTrue endpoint refuses sign-ups

`supabase/config.toml` configures a local stack; the deployed app talks to the
hosted project, whose `auth/v1/signup` is reachable with the publishable key
(`sb_publishable_…`, public by design) whatever the app ships. Probed with a
deliberately invalid password, so that a project _accepting_ sign-ups would
answer `weak_password` rather than create anything:

```
$ curl -s -X POST "$SUPABASE_URL/auth/v1/signup" -H "apikey: $SUPABASE_KEY" \
    -H "Content-Type: application/json" \
    -d '{"email":"probe-signup-check@example.invalid","password":"x"}'
HTTP 422
{"code":422,"error_code":"signup_disabled","msg":"Signups not allowed for this instance"}
```

`signup_disabled`, not `weak_password` — the project rejects registration before
it looks at the credentials. Re-run this probe after any change to the project's
Authentication settings; it is the only check that covers the path the app does
not own.

## 2. Only the two intended accounts exist

```sql
select left(email, 3) || '***@' || split_part(email, '@', 2) as who,
       created_at, last_sign_in_at, email_confirmed_at is not null as confirmed
from auth.users order by created_at;
```

| who                | created_at          | last_sign_in_at     | confirmed |
| ------------------ | ------------------- | ------------------- | --------- |
| `wst***@gmail.com` | 2026-05-24 20:26:24 | 2026-09-06 16:00:15 | true      |
| `den***@gmail.com` | 2026-09-04 14:27:41 | 2026-09-06 15:51:08 | true      |

Two accounts, both created by hand in the Supabase console, none from the
outside. Nothing to revoke, and
no quote was read by an account that should not exist — which matters because
RLS grants every `authenticated` role full CRUD on `public.quotes`.
