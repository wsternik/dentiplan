# Review criteria

Five things a change to this codebase has to get right. They are injected
verbatim into the review agent's system prompt (`schema.ts` reads this file),
so editing this file changes what the agent looks for — no code change needed.

They are not generic good-practice bullets. Each one is a risk this project
already wrote down, in `context/foundation/test-plan.md` §2 or in the PRD, and
in two cases a defect a human review actually caught (findings F1 and F2 in
`context/archive/2026-06-04-first-thin-quote-and-patient-link/`). The agent is
cheapest where it re-checks a mistake we have already made once.

Each criterion is scored 1-10, where 1 is the worst outcome and 10 the best.

## 1. Server-side validation at the trust boundary

Every value that crosses into an API route or a server island is re-validated
and re-derived on the server, with zod, before it is persisted or priced.

- **1** — the handler trusts the request body: a tooth number, a pricelist code
  or an amount goes to storage the way the client sent it.
- **10** — the request is parsed by a schema, prices are re-resolved from the
  server's own pricelist, and a bad payload is rejected with nothing written.

Why it is here: risk #1, and finding F1 — client-side zod was mistaken for
validation once already. The browser is not a trust boundary.

## 2. Data access stays closed

Row Level Security stays on and stays granular; an approved quote stays
immutable against a direct request, not merely against a hidden button.

- **1** — a new table without RLS, a policy widened to `using (true)`, a
  service-role key on a request path, or a write path that can mutate an
  already-approved row.
- **10** — new tables ship with per-operation, per-role policies; writes against
  an approved quote are refused and the stored amounts, snapshot and token are
  untouched.

Why it is here: risks #2 and #6, and the project convention in `CLAUDE.md` that
every new table enables RLS.

## 3. The patient page leaks nothing

`/p/<token>` carries only what the patient is meant to see, and an unknown
token is indistinguishable from a well-formed one that does not exist.

- **1** — the patient's stored e-mail, the raw diagnosis text, or an internal id
  reaches the response — including through serialised island props or an error
  body — or a miss is reported differently from a not-yours.
- **10** — the response body contains the quote and nothing else, and every
  lookup failure produces the same generic page.

Why it is here: risks #3 and #4, PRD FR-066/FR-072, and finding F2. "The
component does not render it" is not the same as "the bytes do not contain it".

## 4. Tests proportional to risk

Changed behaviour on a risky path arrives with a test that would fail if the
behaviour regressed — and asserts the rule, not today's output.

- **1** — logic on an approval, auth or patient-facing path ships untested, or
  the new test asserts whatever the handler happens to return today.
- **10** — the risky part of the change is covered at the cheapest layer that
  can see the failure, with the PRD or the test plan as the oracle.

Why it is here: `test-plan.md` §2 and the oracle-problem warning in its risk
response guidance.

## 5. Fit with this codebase

The change reads like the code around it and follows the conventions in
`CLAUDE.md`.

- **1** — hand-concatenated Tailwind strings instead of `cn()`, a React island
  where an Astro component would do, a Next.js directive, an API route without
  `prerender = false`, a migration outside `supabase/migrations/`, business
  logic inlined in a page instead of `src/lib/`.
- **10** — indistinguishable from the surrounding code; a reader cannot tell
  which commit added it.

Why it is here: it is the criterion an agent can check cheaply and reliably,
and it is where drift accumulates fastest in a codebase written mostly with
agents.

## Parked

**Plan adherence** — whether the diff faithfully implements the
`context/changes/<id>/plan.md` it claims to. It is the criterion this project
would most like automated, and it is deliberately absent: this agent has no
tools, so it never sees the plan. Adding it would mean giving the agent a file
read, which is a different design than the one here.
