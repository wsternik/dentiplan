---
project: dentiplan
deployed_at: 2026-05-24
platform: Cloudflare Workers
worker_name: dentiplan-production
production_url: https://dentiplan-production.wsternik.workers.dev
account_id: 903bfc20d68a3b26fed47065a0c8c09f
context_type: mvp
---

# DentiPlan — first deploy audit trail

This file is the audit trail of what was supposed to happen during the first production deploy. Downstream skills (milestone planning) read it as ground truth for "what's already deployed, which secrets are wired, what URL serves prod."

## What shipped on 2026-05-24

- Astro 6 SSR scaffold (`@astrojs/cloudflare` v13.5.4) deployed to Cloudflare Workers as worker `dentiplan-production`.
- Public URL: `https://dentiplan-production.wsternik.workers.dev`.
- Auth flow live (Supabase SSR cookie sessions): `/`, `/auth/signin`, `/auth/signup`, `/auth/confirm-email`, `/admin` (protected, redirects to `/auth/signin` when unauthenticated; `/dashboard` was starter scaffolding and was removed with the redesign).
- KV namespace `dentiplan-production-session` auto-provisioned by Astro 6 for sessions.
- Cloudflare PoP serving traffic: WAW (Warsaw) — confirmed via smoke test `cf-ray` header.

## Mutations made against the platform

1. Worker `dentiplan-production` created on Cloudflare account `Wsternik@gmail.com's Account` (`903bfc20d68a3b26fed47065a0c8c09f`).
2. Secrets `SUPABASE_URL` and `SUPABASE_KEY` (anon public key) uploaded via `wrangler secret put`. Values point at the hosted Supabase project for DentiPlan.
3. KV namespace `dentiplan-production-session` created and bound as `SESSION`.
4. `workers_dev` route auto-enabled (defaults; wrangler warned). Preview URLs auto-enabled.

## Configuration as of this deploy

- `wrangler.jsonc` — top-level `name: "dentiplan-production"`, `compatibility_date: "2026-05-08"`, `compatibility_flags: ["nodejs_compat"]`. No env blocks (production-only setup).
- `astro.config.mjs` — `output: "server"`, `@astrojs/cloudflare` adapter, env schema declares `SUPABASE_URL` + `SUPABASE_KEY` as server-only secrets.
- `.github/workflows/ci.yml` — lint + build runs on push/PR to `main`; `deploy-production` job runs `npx wrangler deploy` on push to `main` only (gated on `ci` job success). Requires repo secrets `SUPABASE_URL`, `SUPABASE_KEY`, `CLOUDFLARE_API_TOKEN`.
- `.dev.vars.example` — template for local Cloudflare dev secrets (mirrors `.env.example`).

## Database migrations are not part of the deploy pipeline

`.github/workflows/ci.yml` deploys the Worker. It does **not** run
`supabase db push`, and nothing else does either — so a migration merged to
`main` reaches the repo but never the database until someone applies it by
hand.

This bit once, and silently: the F-01 migration
(`supabase/migrations/20260603194110_quotes_foundation.sql`) sat in the repo
from June while the hosted project had no `public.quotes` table at all. The
failure was invisible because the patient page translates every read failure
into the same generic "Link nieaktywny lub nieprawidłowy" it shows for an
unknown token (FR-060) — correct, fail-closed behaviour that also happens to
hide a missing table. Applied 2026-09-04, and the schema-migration registry was
back-dated to the file's own `20260603194110` version so `supabase db push`
agrees with the database.

One thing to know if you apply a migration outside the CLI: Supabase's default
privileges did not grant the `authenticated` role table access, so `GRANT
select, insert, update, delete on public.quotes to authenticated` had to be
issued separately. `anon` deliberately holds no table privileges — the
`get_quote_by_token` RPC is its only read path.

Until a migration step exists in CI, applying a migration is a manual
deploy step: run it, then confirm the table, its RLS policies, the
`quotes_immutable` trigger and the RPC all exist before calling the slice done.

## Decisions explicitly deferred

Captured here so a future agent doesn't propose re-litigating them without cause.

- **No staging environment.** User chose production-only on 2026-05-24 for the first deploy. Risk: regressions ship directly to prod. Mitigation: solo dev + CI lint+build gate; can revisit by re-introducing `env.staging` in wrangler.jsonc when team or traffic grows.
- **Free tier Workers, not Paid.** `infrastructure.md` Risk #1 (10 ms CPU/invocation on free) is consciously accepted. Upgrade path: dashboard → Workers Paid ($5/mo). Trigger: first `1015` / `Exceeded CPU` error in `wrangler tail`. See runbook.
- **CI auto-deploys production.** Diverges from `infrastructure.md`'s "production is human-only" approval policy. Solo MVP context; acceptable pre-launch. Revisit when a real dentist starts using the tool — at that point, gate production behind a manual `workflow_dispatch` or a release tag.
- **`workers_dev` route auto-enabled.** No custom domain configured. Move to `dentiplan.<custom-domain>` before public launch.
- **No Cloudflare Access on the worker.** Public URL accessible to anyone. Acceptable while no real patient data exists; revisit before fixtures land.

## Reference: the approved plan

The full step-by-step plan that drove this deploy is preserved at `a local plan file outside this repo`. Two adjustments were made during execution and approved by the user inline (not by re-running the plan):

1. **Staging dropped.** Plan called for `staging` + `production` env blocks; user changed to production-only after the secrets step.
2. **CI auto-deploys production.** Plan called for staging auto-deploy with manual production; user opted for production auto-deploy.

A residual issue during execution: the first `wrangler deploy --env production` ignored the `env.production.name` override (created a worker named `dentiplan` instead of `dentiplan-production`). Root cause was a stale `dist/server/wrangler.json` generated by an earlier build before the wrangler.jsonc rename. Resolved by simplifying to a flat config (no env blocks) and rebuilding. Lesson: **always rebuild after editing `wrangler.jsonc`, since `@astrojs/cloudflare` snapshots it into `dist/server/wrangler.json` at build time, and that is the file wrangler actually reads at deploy.**
