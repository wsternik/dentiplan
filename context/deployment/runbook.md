---
project: dentiplan
applies_to: dentiplan-production (Cloudflare Worker)
updated_at: 2026-05-24
---

# DentiPlan ops runbook — Cloudflare Workers

One-page operations cheat sheet for the `dentiplan-production` worker. Every command assumes `CLOUDFLARE_API_TOKEN` is exported (set in `~/.zshenv` and `~/.zshrc`).

## Daily operations

### Tail production logs

```bash
npx wrangler tail --format=pretty
```

Streams every request/response. Use during incident triage or when verifying a fresh deploy.

For structured queries against historical logs (Workers Observability is enabled in `wrangler.jsonc`), use the Cloudflare dashboard → Workers & Pages → `dentiplan-production` → Logs, or wire up the Workers Observability MCP server.

### Deploy

Two paths, equivalent outcome:

1. **CI**: push to `main` → `.github/workflows/ci.yml` runs lint + build + `npx wrangler deploy`. This is the default path.
2. **Laptop**: `npm run build && npx wrangler deploy` from the project root. Use only when CI is broken or you need to ship without a commit (rare).

Always rebuild before running `wrangler deploy` from your laptop — wrangler reads `dist/server/wrangler.json`, which `@astrojs/cloudflare` regenerates from `wrangler.jsonc` at build time.

### Rollback

```bash
npx wrangler rollback
```

Single command, reverts to the previous version. Confirms before action. Use the moment a deploy ships a regression.

Caveats:
- Does **not** roll back KV data (session tokens) — sessions are eventually consistent and survive code rollback.
- Does **not** roll back Supabase schema migrations — they're a separate surface (apply via `supabase` CLI against the hosted project).

### Rotate a secret

```bash
npx wrangler secret put SUPABASE_URL   # then paste the new value at the prompt
npx wrangler secret put SUPABASE_KEY
```

`wrangler secret put` overwrites. No version history is exposed. Verify with `npx wrangler secret list`.

### Update environment variables visible to the worker

For non-secret config, declare in `astro.config.mjs` under `env.schema` and rebuild. For secret values, always use `wrangler secret put`. Never commit secrets to `.env` (gitignored) or `.dev.vars` (gitignored).

## Known issues / gotchas

### Stale `dist/server/wrangler.json` after editing `wrangler.jsonc`

`@astrojs/cloudflare` copies `wrangler.jsonc` into `dist/server/wrangler.json` at build time. Wrangler reads the **dist copy** at deploy, not the source. If you change the worker name, env blocks, or any wrangler field, **run `npm run build` before `wrangler deploy`** or the change won't take effect.

This bit us during the first deploy: a stale `dist/server/wrangler.json` from a pre-rename build caused wrangler to deploy under the wrong worker name.

### Free-tier CPU cap — 10 ms/invocation

`infrastructure.md` Risk #1. If `wrangler tail` shows `1015` errors or "Exceeded CPU" messages during normal use, **upgrade to Workers Paid ($5/mo)** in the Cloudflare dashboard:

1. Dashboard → Workers & Pages → Plans → Workers Paid → Subscribe.
2. ~30 seconds, no code changes required.
3. Caps go from 10 ms → 30 M CPU-ms/mo and 50 → 1 000 subrequests/request.

Don't wait for the dentist to see "wystąpił błąd" mid-consultation.

### KV propagation lag on post-deploy sign-ins

After a fresh deploy, KV-backed session tokens (binding `SESSION`) can take ~60 s to propagate across PoPs. The user may see an intermittent sign-in failure within that window. Resolution: retry. Document this for the dentist if it ever shows up; consider Durable Objects for sessions if it recurs.

### Account-wide token if you `wrangler login`

The default `wrangler login` flow grants account-wide scope. Don't use it. Always set `CLOUDFLARE_API_TOKEN` to a scoped API token created in the dashboard (Workers Scripts Edit + Workers KV Storage Edit + Workers Observability Read, scoped to this account only).

## Production access boundary

- **Agent-driven** (safe): `wrangler deploy`, `wrangler tail`, `wrangler secret list`, `wrangler kv namespace list`, `wrangler deployments list`. These are read-only or idempotent.
- **Human-only** (irreversible): `wrangler delete --name dentiplan-production`, `wrangler kv namespace delete`, dashboard plan upgrades, secret rotation that requires coordinating with Supabase (e.g. when migrating to a new project). Even if the agent suggests these, the keystroke is yours.

## Quick reference

| Action | Command |
|---|---|
| Production URL | https://dentiplan-production.wsternik.workers.dev |
| Tail logs | `npx wrangler tail --format=pretty` |
| Deploy from laptop | `npm run build && npx wrangler deploy` |
| Rollback | `npx wrangler rollback` |
| List secrets | `npx wrangler secret list` |
| Rotate secret | `npx wrangler secret put <NAME>` |
| List recent deployments | `npx wrangler deployments list` |
| Whoami / verify auth | `npx wrangler whoami` |
