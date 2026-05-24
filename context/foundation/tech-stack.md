---
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
---

## Why this stack

DentiPlan is a 3-week MVP for a single dental practice: an authenticated admin panel for the dentystka plus a token-protected public page for patients, with an LLM call to parse the raw diagnosis text. 10x-astro-starter is the recommended default for the `(web, js)` cell and clears all four agent-friendly gates (typed via TypeScript + Zod, convention-based via Astro, popular in training data, well-documented). It bundles auth + Postgres + storage (Supabase) and edge deploy (Cloudflare Pages/Workers) out of the box, so FR-001–003 (auth), FR-050 (pricelist snapshot), and FR-051/060 (token-protected public route) land without assembling a database layer. TypeScript + Zod give a natural place to validate the LLM parsing output against a schema (FR-012). The Cloudflare runtime cleanly serves the public `/p/<token>` page at low cost for 1 gabinet. Standard path — no quality gates failed, no overrides. Bootstrapper confidence is `first-class` (not `verified`); expect occasional manual steps during scaffold.
