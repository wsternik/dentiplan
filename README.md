# DentiPlan

Turns a dentist's semi-structured diagnosis note into a patient-readable treatment
plan with two comparable cost estimates, shared as a single unguessable link.

Live: **https://dentiplan-production.wsternik.workers.dev**

## Agent onboarding

Start with [AGENTS.md](AGENTS.md) for repository rules, quality gates and the
change workflow. It is the canonical guide for Codex; [CLAUDE.md](CLAUDE.md)
retains the Claude Code entry point and toolkit-managed instructions.

## The problem

After the first consultation (panoramic X-ray plus clinical examination), the
dentist running the Dentina practice in Kołobrzeg records the diagnosis in her
existing medical-records system as semi-structured text — something like
`Do leczenia: 17,16,15... Kanałowe: 34,37,36, (32?) Kamień do usunięcia`. To put
a proposal in front of the patient she then has to rework that note by hand:
identify every tooth, pick pricelist items, and total it up twice — once for the
standard multi-visit plan and once for the single session under general
anaesthesia the practice prefers — then describe the conditional scenarios and
present the whole thing legibly. That is several to a dozen-odd minutes per
patient, with no consistent side-by-side presentation and a real chance of
arithmetic slips.

The practice-management systems available on the Polish market aim at medical
documentation, not at presenting a plan to the patient; a two-variant comparison
is the gap this fills. The app makes no medical decisions — it structures and
presents what the dentist has already diagnosed.

Full problem statement, persona and requirements: [`context/foundation/prd.md`](context/foundation/prd.md).

## What the MVP does

**For the dentist** (`/admin`, behind sign-in):

- paste the raw diagnosis note and press **"Wypełnij z notatki"** — the note (and
  nothing else: no name, no e-mail, no identifier) goes to Anthropic, and the
  teeth, procedures, uncertainty markers and practice-wide items it reads come
  back into the form. It appends, never overwrites, and everything it could not
  place — an unknown pricelist item, a tooth number outside FDI — is listed as a
  warning instead of quietly dropped or quietly accepted. If the call fails the
  form is filled in by hand exactly as before; the parser is an accelerator, not
  a dependency
- paste the raw diagnosis text and fill the form: patient type (child/adult),
  and per tooth the procedure, urgency, status (`in-plan` / `uncertain` /
  `out-of-current-plan`), pricelist items and a note; plus practice-wide items
  and an assignment of `in-plan` teeth to visits
- see costs computed for both variants as you go, price ranges staying ranges
- approve once — approval is final and freezes a snapshot of the pricelist into
  the quote, so later price changes never alter a quote a patient already has
- browse every quote, reopen drafts, and keep the recipient's e-mail next to the
  quote for the dentist's own reference (never sent anywhere, never shown to the
  patient)

**For the patient** (`/p/<token>`, no account, no login):

- teeth grouped and named, a _Odroczone_ section for what is out of the current
  plan, and a _Scenariusze, które mogą zmienić koszt_ section for uncertain teeth
- the standard plan (visits and their totals) and the general-anaesthesia plan
  (one session, fee by the practice's rule) side by side
- a disclaimer about the estimate's nature that cannot be dismissed

The token carries ≥ 128 bits of entropy and is not sequential, so links are
neither guessable nor enumerable.

## Stack

- [Astro](https://astro.build/) 6 — full SSR (`output: "server"`)
- [React](https://react.dev/) 19 — islands, only where the page is interactive
- [TypeScript](https://www.typescriptlang.org/) 5, [Zod](https://zod.dev/) 4 for validation
- [Tailwind CSS](https://tailwindcss.com/) 4 + [shadcn/ui](https://ui.shadcn.com/) ("new-york"), re-themed through tokens
- [Literata](https://fonts.google.com/specimen/Literata) and [Archivo](https://fonts.google.com/specimen/Archivo) as variable fonts from npm, bundled — no font CDN
- [Supabase](https://supabase.com/) — Postgres with RLS, cookie-based auth via `@supabase/ssr`
- [Cloudflare Workers](https://workers.cloudflare.com/) — deployment target (`workerd` locally too)

## Running it locally

Requires Node.js v22.14.0 (see `.nvmrc`) and, for a local database,
[Docker](https://www.docker.com/).

```bash
npm install
cp .env.example .env        # Node tooling (tests, scripts)
cp .dev.vars.example .dev.vars # Cloudflare local dev
```

`ANTHROPIC_API_KEY` powers the note prefill. Leave it unset and the app runs
fine — the panel shows a banner saying the button is off, and the form is filled
in by hand.

Then either point `SUPABASE_URL` / `SUPABASE_KEY` at a cloud Supabase project, or
start a local stack:

```bash
npx supabase start          # prints the URL and anon key to paste into .env
npx supabase db reset       # applies supabase/migrations/
```

For the hosted Supabase project, apply committed migrations deliberately with
`npx supabase db push` before deploying code that uses them; the deploy pipeline
does not run database migrations.

```bash
npm run dev                 # http://localhost:4321
```

There is no sign-up page — the practice runs on one account. Create it by hand in
Studio (`http://localhost:54323`) under **Authentication → Users → Add user**
(tick _Auto Confirm User_), then sign in at `/auth/signin`.

The pricelist lives in the repo, not in an admin UI — that was a deliberate v1
cut. How to change a price: [`src/lib/pricing/README.md`](src/lib/pricing/README.md).

## Tests

```bash
npm test          # Vitest — cost arithmetic, payload validation, formatting
npm run test:e2e  # Playwright — the flows a broken unit test would not catch
```

The E2E suite runs against `astro dev` on the real Supabase project and needs
`E2E_EMAIL` / `E2E_PASSWORD` in `.env`. It stays local rather than in CI, because
there is no local Supabase in this setup and the specs sign in as a real user —
the reasoning is in [`context/foundation/test-plan.md`](context/foundation/test-plan.md) §5.
Each spec name states the risk from that plan it covers.

Other checks: `npm run lint`, `npx astro check`, `npm run depcruise`,
`npm run validate:pricing`.

Before changing the diagnosis-prefill prompt or its default model, run the paid
manual regression gate with `npm run eval` under Node 22 and
`ANTHROPIC_API_KEY` configured. It compares the English production prompt and
Polish baseline across Sonnet and Haiku on eight synthetic cases; volatile prompts and model
responses stay in the ignored `evals/prefill/.generated/` directory. The gate is
deliberately outside CI because provider output is non-deterministic and each run
costs money. The current measured decision is recorded in
[`evals/README.md`](evals/README.md).

## Layout

```
src/
  pages/        admin/ (dentist), p/[token].astro (patient), api/, auth/
  components/   admin/, patient/, auth/, ui/ (shadcn)
  lib/
    supabase.ts SSR Supabase client (cookie sessions)
    quote/      cost arithmetic, token generation, labels, formatting
    pricing/    pricelist seed (data/*.json), resolver, picker options
    services/   quote payload validation
  db/           generated database types
  middleware.ts resolves the user, guards PROTECTED_ROUTES
supabase/       migrations/, tests/
e2e/            Playwright specs, named after the risks they cover
scripts/        pricing validation, PR review agent
```

Design and analysis documents live under `context/`:

| Path                                                         | What is there                                            |
| ------------------------------------------------------------ | -------------------------------------------------------- |
| [`context/foundation/`](context/foundation/)                 | PRD, roadmap, tech stack, infrastructure, test plan      |
| [`context/changes/`](context/changes/)                       | in-flight work: research, plan, reviews per change       |
| [`context/archive/`](context/archive/)                       | the same, for changes already shipped                    |
| [`context/map/`](context/map/)                               | repository map — territory, structure, contributors      |
| [`context/domain/`](context/domain/)                         | domain distillation, invariants, anti-corruption layer   |
| [`context/architect-report.md`](context/architect-report.md) | what that analysis found, and the one refactor it picked |
| [`context/deployment/`](context/deployment/)                 | deploy plan and open infrastructure decisions            |

## How it looks

The patient page is the one that matters: someone reads it on a phone shortly
after leaving the chair, deciding between several appointments and one session
under anesthesia. So it is built as a document rather than an app — a reading
serif, a single measured column, and the two options laid side by side as the
first thing on the page.

Colour in this interface means something clinical. Navigation, buttons and the
"recommended" marker are ink; the only saturated hues in the system are the
urgency marks on a tooth. Plan status is drawn rather than coloured — dashed for
uncertain, dimmed and hatched for deferred — so it survives being printed in
black and white and being read by someone who cannot separate red from green.

The palette lives as tokens in `src/styles/global.css`; the reasoning behind it
is in
[`context/archive/2026-09-05-ui-redesign/design-brief.md`](context/archive/2026-09-05-ui-redesign/design-brief.md).

## Roadmap status

Shipped: the domain schema (F-01), the pricelist seed (F-02), the end-to-end
quote and patient link (S-01), the admin quote list (S-03), note prefill and
visit planning (S-02/S-09), its prompt/model evaluation gate (S-08), the SVG
odontogram (S-06), patient-link QR (S-07), and the note-first form (S-10). What
is not built, and why:

|                                         | Status   | Why not yet                                                                                                                                                                                                                                         |
| --------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S-04** 12-month retention enforcement | proposed | The default is written down (link stops resolving, patient e-mail scrubbed), but "delete the quote or anonymise it" is a decision for the dentist and a GDPR lawyer, not for the code. It is a hard gate before real patients, not before the demo. |
| **S-05** Auth hardening                 | ready    | Session timeout, rate limiting against credential stuffing, and no account lockout. Independent of everything else, planned but not started.                                                                                                        |

Deliberately out of scope for v1 — drag-and-drop of teeth between visits,
sending e-mails from the app, and a pricelist admin UI — with the reasoning for
each in the roadmap's _Parked_ section:
[`context/foundation/roadmap.md`](context/foundation/roadmap.md).

## Deployment

Pushes to `main` run lint, unit tests and a build; if all three pass, the same
workflow deploys to Cloudflare Workers
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)). Every pull request also
gets a first-pass review from an LLM agent
([`.github/workflows/review.yml`](.github/workflows/review.yml), criteria in
[`scripts/review/criteria.md`](scripts/review/criteria.md)) — it comments, it does
not block the merge.

Deploying by hand:

```bash
npm run build
npx wrangler deploy
```

`SUPABASE_URL` and `SUPABASE_KEY` are Worker secrets (`npx wrangler secret put`)
and GitHub repository secrets for the build; deployment additionally needs
`CLOUDFLARE_API_TOKEN`, and the review workflow `ANTHROPIC_API_KEY`. Database
migrations are applied by hand — see
[`context/deployment/deploy-plan.md`](context/deployment/deploy-plan.md).

## License

MIT
