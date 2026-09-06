# Requirements

## Overall concept

- A GitHub Actions workflow on every pull request to `main`.
- Separate from `ci.yml`. The review is advisory; mixing it into the workflow
  that gates the merge would make it look like a gate.
- Agent assembled from the Vercel AI SDK, not an off-the-shelf coding agent:
  the job is "read this diff, return this shape", and the model should be
  swappable in a line.

## Input

- The diff between the merge base and the PR head.
- **Not** the whole diff. This repository carries far more documentation than
  code — a single change runs to thousands of lines of Markdown under
  `context/` — and that prose costs tokens while diluting a judgement whose
  criteria are all about code. Exclude `context/` and the lockfile.
- Not the PR title or description, for now. They are cheap to add and they are
  also the easiest way for a PR author to talk the reviewer into a verdict.

## Criteria

Five, scored 1-10. They live in `scripts/review/criteria.md` as prose, so the
standard can be edited without touching the agent, and are injected into the
system prompt.

They are drawn from what this project has already written down, not from a
generic checklist:

1. **Server-side validation at the trust boundary** — risk #1 in
   `context/foundation/test-plan.md`, and finding F1 on the first quote slice,
   where client-side zod was mistaken for validation.
2. **Data access stays closed** — risks #2 and #6: RLS on, granular, and an
   approved quote immutable against a direct request.
3. **The patient page leaks nothing** — risks #3 and #4, and finding F2. No
   e-mail, no raw diagnosis, and a miss indistinguishable from a not-yours.
4. **Tests proportional to risk** — `test-plan.md` §2, including its warning
   about asserting today's output instead of the rule.
5. **Fit with this codebase** — the conventions in `CLAUDE.md`. The criterion
   an agent checks most cheaply, and where drift accumulates fastest.

## Output shape

Structured, schema-validated, not prose. A per-criterion score, a verdict of
`APPROVED` / `NEEDS_ATTENTION` / `REJECTED`, and three to five findings each
carrying severity, location, problem and suggestion. The schema is what turns a
fuzzy opinion into something a pipeline could act on.

Rendering to Markdown is a separate step, so the agent's stdout stays machine
readable.

## Expected side effects

- One comment on the pull request, per run.
- Nothing else. No commits, no labels, no status check.

## Explicitly not doing

- **Blocking the merge.** A model's opinion should not be the thing that stops
  a change. Revisit once there is a record of how often it is right.
- **Plan adherence as a sixth criterion.** It is the one this project would
  most like automated — does the diff implement the `plan.md` it claims to —
  and it needs the agent to read a file, which is a different design than the
  toolless one here.
- **A composite action.** One repository, one consumer. Extract it when there
  is a second.
- **Evaluating the prompt with promptfoo.** The right next step, and it needs a
  corpus of diffs with known verdicts that does not exist yet.
- **Labels and on-demand retry.** `workflow_dispatch` covers the retry case
  without any state to keep in sync.
