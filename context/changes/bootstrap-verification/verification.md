---
bootstrapped_at: 2026-05-24T17:36:56Z
starter_id: 10x-astro-starter
starter_name: 10x Astro Starter (Astro + Supabase + Cloudflare)
project_name: dentiplan
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: npm audit --json
---

## Hand-off

Hand-off frontmatter (verbatim from `context/foundation/tech-stack.md`):

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: dentiplan
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
```

### Why this stack

DentiPlan is a 3-week MVP for a single dental practice: an authenticated admin panel for the dentystka plus a token-protected public page for patients, with an LLM call to parse the raw diagnosis text. 10x-astro-starter is the recommended default for the `(web, js)` cell and clears all four agent-friendly gates (typed via TypeScript + Zod, convention-based via Astro, popular in training data, well-documented). It bundles auth + Postgres + storage (Supabase) and edge deploy (Cloudflare Pages/Workers) out of the box, so FR-001–003 (auth), FR-050 (pricelist snapshot), and FR-051/060 (token-protected public route) land without assembling a database layer. TypeScript + Zod give a natural place to validate the LLM parsing output against a schema (FR-012). The Cloudflare runtime cleanly serves the public `/p/<token>` page at low cost for 1 gabinet. Standard path — no quality gates failed, no overrides. Bootstrapper confidence is `first-class` (not `verified`); expect occasional manual steps during scaffold.

## Pre-scaffold verification

| Signal      | Value                                                | Severity | Notes                                                                |
| ----------- | ---------------------------------------------------- | -------- | -------------------------------------------------------------------- |
| npm package | not run                                              | n/a      | cmd_template starts with `git clone` — no npm CLI to recency-check   |
| GitHub repo | przeprogramowani/10x-astro-starter pushed 2026-05-17 | fresh    | from card.docs_url; 7 days before bootstrap                          |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 19 (`.env.example`, `.github/`, `.husky/`, `.nvmrc`, `.prettierrc.json`, `.vscode/`, `README.md`, `astro.config.mjs`, `components.json`, `eslint.config.js`, `node_modules/`, `package-lock.json`, `package.json`, `public/`, `src/`, `supabase/`, `tsconfig.json`, `wrangler.jsonc`, `.gitignore` (append-merged))
**Conflicts (.scaffold siblings)**: `CLAUDE.md.scaffold`
**.gitignore handling**: append-merged (existing `.idea` retained; scaffold lines appended below `# from 10x-astro-starter` separator)
**.bootstrap-scaffold cleanup**: deleted
**Upstream .git/ handling**: deleted before move-up (no upstream history leaked into your repo)

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 0 CRITICAL, 1 HIGH, 9 MODERATE, 0 LOW
**Direct vs transitive**: 0/0/2/0 direct of total 0/1/9/0 (2 direct moderate: `@astrojs/check`, `wrangler`; 1 high + 7 moderate are transitive)

#### CRITICAL findings

None.

#### HIGH findings

- **devalue** (transitive, range 5.6.3 – 5.8.0)
  - Advisory: GHSA-77vg-94rm-hx3p — Svelte devalue: DoS via sparse array deserialization
  - CVSS 7.5 (AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H)
  - Fix available via dependency upgrade.

#### MODERATE findings

- **@astrojs/check** (direct, >=0.9.3) — vulnerable via `@astrojs/language-server`. Fix requires SemVer-major downgrade to 0.9.2.
- **@astrojs/language-server** (transitive, >=2.14.0) — vulnerable via `volar-service-yaml`.
- **@cloudflare/vite-plugin** (transitive) — vulnerable via `miniflare`, `wrangler`, `ws`. Fix available.
- **miniflare** (transitive) — vulnerable via `ws`. Fix available.
- **volar-service-yaml** (transitive, <=0.0.70) — vulnerable via `yaml-language-server`.
- **wrangler** (direct) — vulnerable via `miniflare`. Fix available.
- **ws** (transitive, 8.0.0 – 8.20.0) — GHSA-58qx-3vcg-4xpx, uninitialized memory disclosure. CVSS 4.4. Fix available.
- **yaml** (transitive, 2.0.0 – 2.8.2) — GHSA-48c2-rrv3-qjmp, stack overflow via deeply nested YAML collections. CVSS 4.3.
- **yaml-language-server** (transitive) — vulnerable via `yaml`.

#### LOW / INFO findings

None.

To address the non-breaking issues: `npm audit fix`. For the SemVer-major changes (notably `@astrojs/check` downgrade): `npm audit fix --force` — review the diff before committing.

## Hints recorded but not acted on

| Hint                    | Value                |
| ----------------------- | -------------------- |
| bootstrapper_confidence | first-class          |
| quality_override        | false                |
| path_taken              | standard             |
| self_check_answers      | null                 |
| team_size               | solo                 |
| deployment_target       | cloudflare-pages     |
| ci_provider             | github-actions       |
| ci_default_flow         | auto-deploy-on-merge |
| has_auth                | true                 |
| has_payments            | false                |
| has_realtime            | false                |
| has_ai                  | true                 |
| has_background_jobs     | false                |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` is not needed — this repo already has `.git/`. Stage and commit the scaffolded files when ready.
- Review the `CLAUDE.md.scaffold` sibling against your existing `CLAUDE.md` and merge anything from the starter's version you want to keep (commands, conventions for the Astro/Supabase/Cloudflare stack).
- Run `npm audit fix` to clear the non-breaking moderate findings; consider `npm audit fix --force` for the `@astrojs/check` SemVer-major fix after reviewing the diff.
- Copy `.env.example` to `.env` (Node dev) or `.dev.vars` (Cloudflare local dev) and fill in `SUPABASE_URL` / `SUPABASE_KEY` before running `npm run dev`.
