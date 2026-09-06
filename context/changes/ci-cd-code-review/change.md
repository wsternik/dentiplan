---
change_id: ci-cd-code-review
title: A first-pass code review agent, running on every pull request
status: impl_reviewed
created: 2026-09-05
updated: 2026-09-06
archived_at: null
---

## Notes

Every change in this repository goes through a review before it merges, and
until now that reviewer has been a person reading a diff. That is fine at one
pull request a day and it is the first thing to go when the rate goes up —
which, in a codebase written mostly with agents, it does.

This change adds a first pass in front of the human one: an agent that reads
the diff on a pull request, scores it against the five criteria this project
already cares about, and leaves the verdict as a comment. It does not gate the
merge. The point is to have the obvious things — an unvalidated payload, a
missing test on a risky path, a convention drifting — already on the page when
a person opens the PR, so their attention goes to the parts that need a head.

Started from `requirements.md` rather than from a research pass: the shape of
this change was known up front (agent, workflow, comment) and the open
questions were about our own standards, not about the codebase. That is why
there is no `plan.md` here and no `/10x-impl-review` report: with no plan to
implement against, the review that mattered was the one the pipeline ran on the
pull request that introduced it — recorded in `reviews/impl-review.md`, with the
three findings still open at close.

Artefacts:

- `requirements.md` — what the pipeline has to do, and the criteria it judges by
- `scripts/review/` — the agent, its schema, its rubric, and a fixture diff
- `.github/workflows/review.yml` — the workflow that runs it on every PR
- `reviews/impl-review.md` — the pipeline's three verdicts on its own PR, and what came of them
