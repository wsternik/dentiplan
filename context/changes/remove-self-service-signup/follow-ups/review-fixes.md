# Triage of the CI review agent's pass on PR #11

Verdict: ⚠️ NEEDS ATTENTION — one major, two minor. One fixed, two answered.

## F1 (major) — nothing in the diff enforces the hosted project's `enable_signup`

Correct, and it is the finding worth having: `supabase/config.toml` configures a
local stack, so the flag this PR flips is not the one that guards production.
The hosted project is already refusing (`signup_disabled`, probed in
`../verification.md`), so the hole is closed — what the agent is pointing at is
that it is closed by a setting nobody's pipeline watches.

**Not automated, deliberately.** The proposed parity check queries the Supabase
Management API, which means a management token in CI — a credential that can
rewrite the production project's configuration, added to catch a setting one
person changes by hand in a single-operator project. `deploy-plan.md` already
records the same trade for database migrations and answers it the same way: the
pipeline does not get write access to production for a step that runs about
once. The probe in `verification.md` is written as a command precisely so it can
be re-run rather than believed.

If this ever becomes worth automating, it belongs with roadmap **S-05**, next to
session TTL and rate limiting, where the auth boundary is the subject rather
than a side effect.

## F2 (minor) — the hosted check should be a cadence, not a one-time note

Same answer, and the same file. `verification.md` states the re-run condition —
after any change to the project's Authentication settings — rather than a date,
because a calendar reminder in a repo nobody schedules against decays faster
than the setting does. The e2e spec covers what the app owns; the probe covers
what it does not, and the two are deliberately in different places.

## F3 (minor) — dead props on the shared auth components — **fixed**

Real, and specific: `FormField`'s `name` and `hint` props existed only for the
sign-up form. `name` fell back to `id` for every other caller, and `hint`
carried the password-requirements line, taking the whole `else` branch of the
error/hint ternary with it. Both are gone; `SignInForm` never passed either.
`PasswordToggle`, `SubmitButton` and `ServerError` were checked too — every prop
they declare is passed by the sign-in form.
