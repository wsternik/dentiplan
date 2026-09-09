---
change_id: review-pipeline-retry
title: Make the manual re-review real and test the review helpers
status: archived
created: 2026-09-09
updated: 2026-09-09
archived_at: 2026-09-09T05:45:00Z
---

## Notes

The AI review workflow advertises an on-demand re-run through `workflow_dispatch`, but the dispatch path checks out a branch instead of a pull request: the diff is empty and there is no pull request to comment on. The change makes the manual path take a pull request number and behave like the automatic one, and closes the follow-up left open by the pipeline's own implementation review — unit tests for `truncate`, `clampScores` and `render`.
