# AGENTS.md

Canonical working rules for Codex and other AI agents in this repository.
Maintain shared instructions here; `CLAUDE.md` is the compatibility entry point. Product background and the
full requirements live in [`README.md`](README.md) and
[`context/foundation/prd.md`](context/foundation/prd.md); the architecture notes
in [`CLAUDE.md`](CLAUDE.md) go deeper on the framework specifics.

## What this is

**DentiPlan** turns a dentist's semi-structured diagnosis note into a
patient-readable treatment plan with two comparable cost estimates (standard
multi-visit plan vs. one session under general anaesthesia), shared as a single
unguessable link. Astro 6 SSR + React 19 islands + Tailwind 4 + Supabase, running
on Cloudflare Workers. One operator: the dentist. Patients read `/p/<token>`
without an account.

The app makes no medical decisions. It structures and presents what the dentist
has already diagnosed.

## Read this first, every time

**[`context/foundation/lessons.md`](context/foundation/lessons.md)** — an
append-only register of rules distilled from real defects that shipped here.
It is short and every one of its entries cost something. Read it before planning
or writing code.

## Start each task

1. Read the lessons above, then inspect `git status --short`, the current branch,
   and recent commits. Preserve existing edits and untracked files.
2. Read `README.md` and the relevant PRD/roadmap sections. For an existing
   change, read its `change.md`, `plan.md` **including Progress**, and reviews
   before resuming. Check completed SHAs against code; old briefs and repository
   maps describe their date, not necessarily today's implementation.
3. Use `context/map/repo-map.md` for orientation and
   `docs/reference/contract-surfaces.md` for data boundaries. Read
   `context/foundation/test-plan.md` when choosing verification and
   `context/deployment/runbook.md` before deployment work.

## Codex workflow

- Codex uses this `AGENTS.md`; Claude's `.claude/settings.json` hooks and slash
  commands are not a Codex setup. Run the per-edit checks below explicitly.
  Husky and GitHub Actions remain shared gates.
- `.agents/skills/` holds the tracked AI SDK skills. Read the relevant skill for
  AI SDK work. The ignored `.claude/skills/10x-*/SKILL.md` procedures can be read
  directly when needed; translate their tool names to available Codex tools.
  Do not copy third-party lesson packs into tracked `.agents/skills/`.
- On a fresh checkout without the lesson packs, use the change cycle below as
  the baseline. Consult `.claude/.10x-cli-manifest.json` for the installed
  lessons before fetching a needed pack. Do not assume a slash command exists.
- Keep handoff state in the change's `plan.md`: completed work, actual checks,
  remaining work, and blockers. Never record an unrun check as passing.
- This agent handover does not change the application's Anthropic provider or
  the advisory review agent in `scripts/review/`.

## Commands

```
npm run dev          # dev server (Cloudflare workerd runtime), port 4321
npm run build        # production build (SSR via @astrojs/cloudflare)
npm test             # vitest run — unit
npm run test:e2e     # playwright — local only, never runs in CI
npm run lint         # eslint, type-checked rules
npm run lint:fix
npm run format       # prettier (astro + tailwind plugins)
npm run depcruise    # dependency-cruiser (currently not a CI gate)
npm run validate:pricing # pricelist validation
npx astro check     # project typecheck
npm run review       # the LLM review agent used by the PR workflow
npx wrangler deploy  # deploy (CI does this automatically on green main)
```

## Quality gates

| When                                                      | What runs                                                                                                | Configured in                                                                      |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| after editing `*.ts`, `*.tsx`, `*.astro`, `*.js`, `*.mjs` | `npx eslint --fix <file>`                                                                                | Run explicitly in Codex; `.claude/settings.json` provides this only in Claude Code |
| after editing Markdown, JSON or CSS                       | `npx prettier --write <file>`                                                                            | Run on the changed files only; Markdown is not an ESLint target                    |
| on commit                                                 | ESLint on staged TS/TSX/Astro; Prettier on staged JSON/CSS/Markdown; then `astro check` over the project | `.husky/pre-commit` + `lint-staged`                                                |
| on push and PR to `main`                                  | lint, `npm test`, build; deploy only on a green push to `main`                                           | `.github/workflows/ci.yml`                                                         |
| on every PR                                               | an LLM review agent posts a verdict and findings as a PR comment                                         | `.github/workflows/review.yml`                                                     |

The review agent's verdict is **advisory**. Read its comment once, fix what is
critical or high, push once. Do not loop pushes chasing `APPROVED`.

Typecheck deliberately sits at the commit layer, not per-edit: `astro check`
takes ~6s against ~3s for linting a single file.

## How changes are made here

Every change of substance follows the same cycle, and the repository keeps its
paper trail:

```
context/changes/<change-id>/
  change.md        what and why
  research.md      only when the change needs a recon pass first
  plan.md          phased plan; ## Progress carries per-phase SHAs
  plan-brief.md
  reviews/         plan-review.md, impl-review.md
```

1. Branch `feat/<change-id>` off `main`.
2. Open the change folder, research if the problem is not yet understood, write
   the phased plan, review the plan (one round).
3. Implement **one phase per commit**: `feat(<change-id>): <what> (pN)`. Stamp
   the phase's SHA into `plan.md` `## Progress` — that file, not the
   conversation, is where the state lives, so any session can resume from it.
4. Before opening the PR: `npm run test:e2e` green, then an implementation
   review (one round, triage finding by finding, record deliberate rejections
   with a reason in `reviews/impl-review.md`), then fixes as
   `fix(<change-id>): …`, then `gh pr create`.
5. After merge: archive the change folder into
   `context/archive/<YYYY-MM-DD>-<change-id>/`, move the roadmap slice to `done`,
   update the PRD in the **same** change as the code that implements it.

The `/10x-*` skills in `.claude/skills/` implement each of these steps. They are
markdown procedures — read and follow them even if your harness has no slash
commands for them. They are fetched with
`npx @przeprogramowani/10x-cli@latest get <lesson>`, are **not part of this
project's source**, and are gitignored along with `.claude/prompts/`. Never
commit them. The `<!-- BEGIN @przeprogramowani/10x-cli -->` block in `CLAUDE.md`
and `.claude/.10x-cli-manifest.json` are tracked on purpose.

## Where artifacts belong

Do not invent new paths for these — tooling and readers both look here.

```
context/foundation/   prd.md, roadmap.md, test-plan.md, tech-stack.md,
                      shape-notes.md, infrastructure.md, lessons.md
context/changes/      open changes (see above)
context/archive/      closed changes, dated
context/map/          repository map: territory, structure, contributors
context/domain/       domain distillation, invariants/aggregates, ACL
context/architect-report.md
docs/, supabase/migrations/, e2e/, scripts/
```

## Code conventions

- **Path alias** `@/*` → `./src/*`.
- **Astro components** for static content and layout; **React** only where
  interactivity is genuinely needed. No Next.js directives.
- **Class merging** through `cn()` from `@/lib/utils` (clsx + tailwind-merge).
  Never concatenate class strings by hand.
- **shadcn/ui** lives in `src/components/ui/`, "new-york" variant;
  `npx shadcn@latest add <name>`.
- **API routes** export uppercase `GET` / `POST`, validate input with zod, and
  set `export const prerender = false`.
- **Hooks** go to `src/components/hooks/`; business logic to `src/lib/services/`;
  shared entities and DTOs to `src/types.ts`.
- **Migrations** in `supabase/migrations/YYYYMMDDHHmmss_short_description.sql`.
  Always enable RLS on a new table, with granular per-operation, per-role
  policies. Migrations are **not** applied by the deploy pipeline — the procedure
  is in `context/deployment/`.
- **Commits**: conventional, scope is the change-id, one per phase. Keep the tone
  of `git log`; it is deliberately plain and descriptive.

## Testing rules that are not negotiable

- **Never edit an existing E2E spec to make it pass after a UI change.** The spec
  is a contract over DOM semantics; a changed role or label is an accessibility
  regression, not a test that needs adjusting. Adding new specs is fine.
- **E2E is local only** — CI does not run Playwright. Green CI plus red E2E means
  a broken production deploy. Run `npm run test:e2e` before opening a PR and
  after merging.
- Before an E2E run: `pkill -f "astro dev"; rm -rf node_modules/.vite`. If the
  port looks stuck, `lsof -nP -iTCP:4321 -sTCP:LISTEN`. A first run against a
  cold server can fail in `auth.setup.ts` (it is the one spec that does not wait
  for island hydration) — warm the server with `curl` on `/`, `/auth/signin`,
  `/admin` and re-run **once**. A third red run is a bug, not flake.
- **Clean up test data by the `e2e-` prefix, never by the `@example.test`
  domain.** Approved quotes are immutable by design (FR-053), and a
  domain-shaped filter has already destroyed demo quotes that could not be
  recreated.
- Playwright locators: `getByRole` / `getByLabel` / `getByText` first,
  `getByTestId` only when accessibility attributes are ambiguous. Never CSS
  selectors, XPath or DOM structure. Never `page.waitForTimeout()` — wait for
  state.

## Patient-data boundary

Approval freezes both the quote and its pricelist snapshot (FR-053). All of
`quotes.content` is returned to a patient holding the token: keep raw diagnosis,
internal warnings, patient e-mail and other admin-only data outside that JSON.
The RPC's top-level whitelist does not sanitize nested fields. See
`docs/reference/contract-surfaces.md` before changing payloads or stored types.
UI text is Polish; prices are PLN and dates use Polish formatting.

## Auth

One account, created by hand in Supabase. **There is no self-service sign-up** —
it was removed deliberately: RLS grants every `authenticated` role full CRUD on
`public.quotes`, so any new account was a dentist account. `enable_signup =
false` in `supabase/config.toml`, the hosted project mirrors it, and
`e2e/auth-no-signup.spec.ts` guards the absence. Do not reintroduce one.

Sessions are cookie-based via `@supabase/ssr` (`src/lib/supabase.ts`);
`src/middleware.ts` resolves the user onto `context.locals.user` and redirects
anonymous traffic away from `PROTECTED_ROUTES`.

## Working with the model call

`src/lib/llm/` sends the diagnosis note — and nothing else — to Anthropic.

- **Facts from the model, sentences from the code.** No model-authored string
  reaches the patient page verbatim. Visible labels come from a closed dictionary
  in code; anything the model wants to say in prose goes into the warnings, which
  only the dentist reads. There is an invariant test guarding this in
  `parse-diagnosis.test.ts` — keep it passing rather than working around it.
- **Editing the prompt changes the cost and the latency of the call, not just its
  wording.** The unit suite stubs the model and will stay green through a change
  that cannot complete a single real call. `effort` is set explicitly and the
  timeout in `client.ts` is sized against a measured run; measure once against
  the real provider before merging a prompt change.
- Model output is treated like untrusted client input: the schema guards its
  shape, the code guards its meaning.
- `ANTHROPIC_API_KEY` is a Worker secret and a repository secret. Locally it goes
  in `.env` / `.dev.vars`, both gitignored.

## Print and accessibility

The patient page is meant to be printed and handed over, so:

- **Verify a `@media print` behaviour at the medium's dimensions, not under its
  name.** A4 gives ~717px of printable width; a print-emulated screenshot at a
  1280px viewport has already "proved" a layout that does not exist on paper.
  Prefer `sm:` (640px) over `md:` (768px) for anything with a print contract.
- **A background cannot carry meaning on paper** — browsers drop background
  images in print. Back every distinction with a border, a glyph or text.
- One dimming mechanism per subtree; patient-facing clinical text has a contrast
  floor. Do not dim a container whose controls are still interactive.

## Do not

- **Force-push, to any branch.** Revert a bad merge with
  `git revert -m 1 <merge-sha>` through a PR.
- **Change the repository's visibility.** That is the owner's call, never the
  agent's.
- **Commit** `.claude/skills/10x-*`, `.claude/prompts/`, `example-doctor-input/`
  (real patient documents), `.env`, `.dev.vars`, or anything under
  `playwright/.auth/`.
- **Use `example-doctor-input/` as test or evaluation material.** Write fixtures
  from scratch.
- **Merge with red E2E** because CI is green.
- **Add features nobody asked for.** Out of scope today: `mailto:` links, sending
  e-mail, drag-and-drop, an optional `patient_email`. The roadmap
  (`context/foundation/roadmap.md`) says what is next and why.

## Environment

Use Node 22.14.0 (`.nvmrc`; `nvm use` when available) and the committed npm
lockfile. Check `node --version` before interpreting tool failures. `SUPABASE_URL`, `SUPABASE_KEY`, `ANTHROPIC_API_KEY`,
optional `LLM_MODEL` — copy `.env.example` to `.env` for Node, `.dev.vars.example`
to `.dev.vars` for the Workers runtime. Local Supabase: `npx supabase start`
(needs Docker). CI additionally needs `CLOUDFLARE_API_TOKEN` for the deploy job.

E2E also needs `E2E_EMAIL` and `E2E_PASSWORD` in `.env`; see
`playwright.config.ts`. The current suite runs the local Worker against the
configured hosted Supabase project, not an automatically provisioned local DB.
Never print credentials or saved browser sessions while checking setup.
