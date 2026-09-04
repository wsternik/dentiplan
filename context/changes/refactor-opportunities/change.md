---
change_id: refactor-opportunities
title: Which of the recorded problems to fix, in what shape, in what order
status: preparing
created: 2026-09-04
updated: 2026-09-04
archived_at: null
---

## Notes

We have an analysis of this repository documenting technical debt and
structural risk: `context/changes/quote-approval-flow-analysis/research.md`.
This change answers the question that analysis deliberately left open: WHICH of
those problems are worth fixing, in what target shape, and in what order.

We explore each recorded problem in the code and in the history, then order
them as refactor opportunities.

The change runs in stages: exploration → decision and plan → implementation.
**Nothing is refactored during exploration and no decision is taken there.**

Output of exploration: this change's `research.md`, ending in a ranking of
options with trade-offs. The report gets read first; the decision about what we
actually do is taken at the planning stage, and the refactor starts only
according to the accepted plan.
