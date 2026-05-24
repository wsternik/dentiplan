---
project: dentiplan
researched_at: 2026-05-24
recommended_platform: Cloudflare Workers (with Static Assets)
runner_up: Netlify
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 6 (SSR)
  runtime: Cloudflare workerd
---

## Recommendation

**Deploy on Cloudflare Workers (with Static Assets), using the existing `@astrojs/cloudflare` adapter (v13.x).**

Cloudflare scores Pass on all five agent-friendly criteria, matches the stack already wired into the project (no adapter swap), comfortably fits the MVP traffic envelope inside the free tier, and offers 17 first-party GA MCP servers that close the live-state loop for an agent-driven workflow. The single weakness — the developer's lack of prior Cloudflare familiarity (vs. Vercel/Netlify) — is *the specific friction* that the agent-readable docs (`llms.txt` / `llms-full.txt` published per-product) and the GA Workers Observability MCP server are designed to absorb. The decision was confirmed after the three-lens anti-bias cross-check; the surfaced risks are mitigated in the register below rather than triggering a swap.

## Platform Comparison

Scoring is Pass / Partial / Fail per criterion, sourced from `references/agent-friendly-criteria.md`. Soft weights from the interview answers (Q1 stateless, Q2 cost/DX equal, Q3 familiar with Vercel/Netlify, Q4 single region PL, Q5 external providers OK — Supabase stays) were applied after raw scoring; they reorder ties but do not override hard signals.

| Platform | CLI-first | Managed / Serverless | Agent docs | Stable deploy API | MCP / Integration |
|---|---|---|---|---|---|
| **Cloudflare Workers** | Pass — `wrangler` unified CLI (`deploy`, `tail`, `rollback`, `secret put`, `versions`) | Pass — serverless edge, no OS/network surface | Pass — `llms.txt` + `llms-full.txt` published per-product; "Docs for agents" product | Pass — `wrangler deploy` GA, scripted exit codes, non-interactive in CI | Pass — 17 first-party MCP servers GA since May 2025 (Workers Observability, Workers Bindings, Workers Builds, Documentation, global API) |
| **Netlify** | Pass — CLI mature, **`netlify deploy` draft-by-default** (safer agent posture), `netlify logs --follow` GA May 2026 | Pass — Functions (Node 22) + Edge Functions GA | Pass — `llms.txt` published at `docs.netlify.com/llms.txt`, official "AI context" feed | Pass — stable, scriptable, atomic-deploy rollback via "Publish Deploy" | Pass — official `@netlify/mcp` GA (launched 3 Jun 2025) |
| **Vercel** | Pass — best-in-class CLI (`vercel`, `--prod`, `env pull`, `logs`, `rollback`) | Pass — serverless (Node) default; Edge opt-in | Pass — `llms-full.txt` + `Accept: text/markdown` content negotiation (best of the six) | Pass — stable, scriptable, predictable | Partial — Vercel MCP **beta** (Aug 2025 launch, still beta May 2026), **read-only**, no env-var write tool |
| **Fly.io** | Pass — `flyctl` is best-in-class; `--json` on most commands | Partial — managed VMs + containers (lower-level than the others, but `auto_stop`/`suspend` is well-integrated) | Partial — markdown-rendered docs, deep linking, but **no `llms.txt`** at `fly.io/llms.txt` (404 confirmed 2026-05-24) | Pass — rollback via redeploy of prior image (caveat: images pruned over time → push to GHCR for guaranteed rollback) | Pass — `fly mcp server` GA in flyctl ≥0.3.125; `fly mcp server --claude` auto-configures Claude |
| **Render** | Pass — CLI v2.18.0 GA; deploy hooks GA; REST API GA; `RENDER_API_KEY` env-driven CI | Partial — containers / web services (more managed than Fly but less than CF/Vercel/Netlify) | Partial — markdown-rendered, agent-readable, but no `llms.txt` | Pass — deploy hooks, REST API, deploys-cancel API added 2025 | Pass — MCP GA Aug 21, 2025; conservative write scope (cannot delete resources) |
| **Railway** | Pass — `railway up`, `logs`, `variables`, `redeploy`; `--json`/`--yes`/`--service` flags | Partial — Railpack auto-detect is good for static, mediocre for SSR (Dockerfile required) | Partial — markdown source on GitHub, `.md` URLs fetchable, but no `llms.txt` at root | Pass — stable, scriptable | Partial — official Railway MCP exists but docs flag it as "a work in progress" (treat as **beta**) |

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Five Pass scores across the criteria; the only platform where the project's deploy can ship without an adapter swap (`@astrojs/cloudflare` v13.x is already wired). Free tier gives 100 000 req/day and 10 ms CPU/invocation — at ~30 000 req/month (PRD scale: 1 dental practice, low qps) that's three orders of magnitude of request headroom. Agent-readable docs are best-of-class: per-product `llms.txt`, MD source on GitHub, an explicit "Docs for agents" product. The 17 first-party MCP servers (Workers Observability, Bindings, Builds, Documentation, global API) give the agent typed access to live state without parsing CLI output. Frankfurt PoP serves Polish users at edge latency.

#### 2. Netlify (Runner-up)

Tied 5/5 on raw scoring. The dev's familiarity (interview Q3) is the soft weight that brings it to runner-up. Free credit tier (300 credits/month) covers DentiPlan's expected traffic with headroom; commercial use is explicitly allowed (no Hobby-style restriction); official `@netlify/mcp` is GA; CLI defaults are safer than Vercel/Wrangler (`netlify deploy` is draft until `--prod`). Gap vs. recommendation: a one-time adapter swap (`@astrojs/cloudflare` → `@astrojs/netlify`) and reconfig — a stack-shaped change that would require amending `tech-stack.md`. Real Supabase caveat: `@supabase/ssr` cookie writes on auth-touching routes must be served `Cache-Control: private, no-store` to prevent the CDN caching a `Set-Cookie` that leaks across patients.

#### 3. Vercel (Third)

Strongest CLI and docs of the six, *and* the dev is familiar (interview Q3). But the Vercel Hobby plan is restricted to **non-commercial use**; DentiPlan is a paid tool for a working dental practice, so Pro ($20/user/month) is mandatory, plus the `fra1` regional surcharge to keep Supabase EU latency reasonable. The MCP server is still beta and read-only, so live-state operations fall back to CLI. The cost gap vs. the recommendation (effectively $0 → ~$25/mo for the same agent-friendly properties) pushed it below Cloudflare and Netlify despite excellent technicals.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **10 ms CPU/invocation on free tier vs. the actual synchronous work the SSR routes do.** Network wait (Supabase, LLM call, KV) doesn't count, but Zod schema validation on parsed diagnosis, FDI tooth-name mapping, anesthesia fee math, and the pricelist snapshot construction on `Zatwierdź` are all sync. One slow `zod.refine` or a 40-item pricelist clone can push past 10 ms. Fix is the $5/mo Workers Paid plan; the "free" mental model silently breaks.
2. **`nodejs_compat` is best-effort, not 100%.** Required for `@supabase/ssr` to run under workerd. Future LLM SDK additions (Anthropic / OpenAI) may have a transitive dep (`worker_threads`, `async_hooks`, niche stream APIs) that fails at runtime in workerd despite working locally. Discovery happens at deploy or in prod.
3. **Operational unfamiliarity = doubled MTTR on first incident.** The dev has Vercel/Netlify dashboards in muscle memory; Cloudflare's `wrangler tail` + Workers Observability is a different model. The first 11 PM incident burns extra time discovering where the relevant log lives.
4. **`@astrojs/cloudflare` v13.x is recently rebuilt.** Astro 6 dropped Pages support in the adapter; the Workers-only path is GA but new. Community Q&A and Stack Overflow answers are mostly still Pages-shaped — searching for help yields outdated advice for 6–9 months.
5. **KV-backed sessions are eventually consistent globally.** Astro 6 auto-provisions a KV namespace for sessions; KV propagation across PoPs can take ~60 s. For 1 dentist this is invisible until a fresh deploy invalidates a session token and a sign-in click intermittently fails with no clear cause.

### Pre-Mortem — How This Could Fail

Six months in, DentiPlan limped on Cloudflare. The first hit came in month two: a long diagnosis text with a 40-item pricelist snapshot pushed the approval handler past 10 ms CPU on free tier — silent `1015` errors, the dentist saw a generic "wystąpił błąd" mid-consultation. The $5/mo upgrade fixed it but exposed the second issue: no observability habit. The dev had built debugging muscle memory on Vercel dashboards; Cloudflare's per-request logs lived in a different shape and tail-on-laptop required `wrangler` auth per machine. Month four, a chosen LLM SDK upgrade pulled in a transitive `worker_threads` dep — runtime error on production only, not local. The lazy rewrite to Cloudflare-native `fetch()` cost a weekend. Month five, a KV-backed session token regeneration during a deploy left the dentist signed out unpredictably for ~30 seconds; she lost trust in the tool for new patient sessions. Each issue had a fix; together they ate the budget that was supposed to ship v2 features. With Netlify the dev would have hit the cookie-cache caveat once, fixed it once, and moved on.

### Unknown Unknowns

- **Subrequest cap, not just CPU cap.** Free = 50 subrequests/request; Paid = 1000. An SSR route doing `LLM parse call → 4× Supabase reads → snapshot writes → KV session → 3× pricelist lookups` can quietly approach the cap on cold paths.
- **`@astrojs/cloudflare` v13.x is still settling.** The Astro 6 / workerd-only dev rebuild landed recently. Treat the adapter changelog as not-yet-stable — a `peerDependency` bump or workerd flag change can break local dev between minor versions.
- **`wrangler login` defaults to account-wide token scope.** Matching the lesson's minimal-permissions posture requires hand-creating a scoped API token in the dashboard (Workers Scripts Edit + KV Storage + Cloudflare Workers Observability Read, scoped to the DentiPlan account) before first deploy.
- **AI Gateway is the seductive on-ramp that locks you in.** Cloudflare will offer to route the LLM call via Workers AI / AI Gateway. Convenient for caching and analytics; later provider swap (Anthropic ↔ OpenAI ↔ local) costs extra refactor surface.
- **`astro:env/server` vs `cloudflare:workers` env binding.** Env vars declared in `astro.config.mjs`'s `env.schema` are statically validated at build, but workerd injects them at request scope. This works as long as no helper reaches for `node:process.env` — that returns `undefined` in workerd, and the failure is silent until the helper runs.

## Operational Story

How the chosen platform actually operates day-to-day. One concrete answer per axis.

- **Preview deploys**: each `wrangler deploy` to a non-prod environment (set up two environments in `wrangler.jsonc` — `staging` and `production`) produces a stable URL like `dentiplan-staging.<account>.workers.dev`. PR-driven previews require Workers Builds (CI-side) or GitHub Actions running `wrangler deploy --env staging`. Preview URLs are public by default; if patient data lands in staging fixtures, protect with Cloudflare Access (free tier supports 50 users) or a `Basic Auth` middleware.
- **Secrets**: production secrets via `wrangler secret put SUPABASE_KEY` / `SUPABASE_URL` / LLM API key — encrypted at rest, never echoed back. Local dev secrets in `.dev.vars` (already gitignored). CI uses a scoped `CLOUDFLARE_API_TOKEN` set in GitHub Actions repo secrets. Rotation: `wrangler secret put` overwrites; no version history is exposed to the agent.
- **Rollback**: `wrangler rollback` reverts to the previous version (single command, deterministic). Versioned deploys via `wrangler versions upload` + `wrangler versions deploy` if you want staged rollouts. Cost: rollback does not roll back KV data (sessions) or Supabase schema migrations — those are independent surfaces.
- **Approval**: the agent may run `wrangler deploy --env staging` and `wrangler tail` unattended. Production deploy (`wrangler deploy --env production`), `wrangler secret put` against prod, KV namespace deletion, and Workers Paid plan upgrade are **human-only** — clicked by the dev, even if the agent suggests them. The 30-second click cost is much cheaper than cleanup after a mistaken automated change against a live patient record.
- **Logs**: `wrangler tail --env production --format=pretty` for real-time streaming; Workers Observability MCP server (`observability.mcp.cloudflare.com/mcp`) exposes typed `query_logs` / `get_invocation` tools for structured, agent-readable access to historical logs without parsing CLI output.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 10 ms CPU/invocation exceeded by sync work (Zod, pricelist snapshot) on free tier → silent `1015` errors | Devil's advocate | M | H | Upgrade to **Workers Paid ($5/mo) at first deploy**, not after the first incident. Adds 30M CPU-ms/mo headroom. |
| `nodejs_compat` doesn't cover a future LLM SDK transitive dep | Devil's advocate | L–M | M | Pin LLM SDK version; smoke-test every SDK upgrade with `wrangler dev` (workerd) before deploy. Prefer SDKs that advertise edge-runtime support. |
| Operational unfamiliarity → doubled MTTR on first incident | Devil's advocate | M | M | Pre-write a 1-page "Cloudflare ops runbook" in `context/deployment/` covering: `wrangler tail`, rollback, secret rotation, KV inspection. Bookmark the Workers Observability MCP for the agent. |
| `@astrojs/cloudflare` v13 ecosystem still settling → outdated SO answers | Devil's advocate | M | L | Treat the Cloudflare docs `llms.txt` as canonical over community answers; pin both `astro` and `@astrojs/cloudflare` versions; review changelog before bumps. |
| KV eventual consistency → intermittent post-deploy sign-in failure for ~30 s | Devil's advocate | L | M (dentist's trust) | Document the failure shape in the runbook ("if first sign-in after deploy fails, retry — KV propagation"). Consider Durable Objects for session if it recurs in practice (v2). |
| Approval handler accumulates many subrequests, approaches free/paid cap | Unknown unknowns | L | M | Batch Supabase reads where possible; cache pricelist snapshot reads. Workers Paid 1000 subrequest cap is generous; free 50 is tight — another argument for Paid from day one. |
| Adapter minor-version bumps break local dev | Unknown unknowns | L–M | L | Pin `@astrojs/cloudflare` in `package.json` (no `^`); review changelog before bumps; Renovate/Dependabot in `update-only`, not auto-merge. |
| `wrangler login` grants account-wide token by default → over-permissioned agent posture | Unknown unknowns | M | M | Before first deploy, create a scoped API token in the Cloudflare dashboard (Workers Scripts Edit + KV Storage Write + Workers Observability Read, scoped to this account and zone). Store in `~/.wrangler/config` and CI secrets. |
| AI Gateway / Workers AI lock-in if used for LLM routing | Unknown unknowns | M | M | Keep LLM client behind a thin adapter in `src/lib/llm/`. If Workers AI is adopted later, the swap is one file. |
| `node:process.env` reached in a helper → `undefined` in workerd | Unknown unknowns | L | M | Lint rule (`no-restricted-imports`) against `node:process`; rely solely on `astro:env/server` for typed env access. |
| Pre-mortem composite: drift away from CF over 6 months | Pre-mortem | L–M | H (re-platform cost) | Quarterly platform check-in (re-run the agent-friendly criteria against current pain). If three or more risks materialize, swap to Netlify (the runner-up). |

## Getting Started

The project's `@astrojs/cloudflare` adapter is already wired (see `astro.config.mjs`). The dev loop uses `npm run dev` (workerd-backed) and `npm run build`. Per the skill's guardrail, these commands are validated against the **versions actually in the project**, not generic platform docs.

1. **Install `wrangler` globally and authenticate** with a scoped token (not the default account-wide login):
   - Create an API token in the Cloudflare dashboard → My Profile → API Tokens → Create Token. Permissions: *Account > Workers Scripts > Edit*, *Account > Workers KV Storage > Edit*, *Account > Workers Observability > Read*. Scope to the DentiPlan account.
   - Export it for `wrangler`: `export CLOUDFLARE_API_TOKEN=<token>` (in shell rc) or set in CI secrets.
2. **Confirm `wrangler.jsonc` (or `wrangler.toml`) has `compatibility_flags: ["nodejs_compat"]`.** Required by `@supabase/ssr`. The bootstrapper may have set this; verify.
3. **Add two environments** (`staging`, `production`) to `wrangler.jsonc` with distinct names. Production deploys: `npx wrangler deploy --env production`.
4. **Write secrets to production**: `npx wrangler secret put SUPABASE_URL --env production`, then `SUPABASE_KEY` and any LLM API key. Confirm with `npx wrangler secret list --env production` (values not echoed).
5. **Upgrade to Workers Paid ($5/mo) before first patient traffic** — see Risk #1. Done from dashboard, ~30 seconds. The 10 ms CPU cap on free is a near-term footgun for SSR work, not a long-term saving.
6. **First deploy**: `npm run build && npx wrangler deploy --env staging`. Verify with `npx wrangler tail --env staging`. Open the printed `workers.dev` URL, sign in as the dentystka, generate a test quote, open the `/p/<token>` page.

When all five steps pass, proceed to Plan Mode for the actual production deploy: `"Wykonajmy pierwsze wdrożenie w oparciu o @infrastructure.md, zgodnie ze stackiem z @tech-stack.md"`. The approved plan persists at `context/deployment/deploy-plan.md`.

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration (not needed for Cloudflare Workers — workerd is the runtime, no container build).
- CI/CD pipeline setup (covered later — GitHub Actions runs `wrangler deploy --env staging` on push, prod is human-clicked).
- Production-scale architecture (multi-region HA, DR, SLA commitments). DentiPlan is 1 gabinet, single-tenant; this is MVP scope only.
