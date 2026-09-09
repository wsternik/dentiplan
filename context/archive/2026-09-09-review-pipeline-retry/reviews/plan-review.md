# Plan review: review-pipeline-retry

## Verdict

APPROVED

## Scope reviewed

- `context/changes/review-pipeline-retry/plan.md`
- `context/changes/review-pipeline-retry/plan-brief.md`

## Findings

No blocking findings. Two points were argued through before the plan was accepted.

- **Delete the trigger instead of fixing it.** The cheaper option, and the one the plan rejects: "Re-run jobs" only exists while the original run does, and it re-runs the old code rather than the current head of the pull request. Since a review is precisely the job worth repeating after a provider error or a prompt edit, the mode is worth having for real.
- **Reviewing an arbitrary pull request with repository secrets.** The dispatch path runs in the base repository, so the fork guard on the `pull_request` path does not cover it. The plan answers this with an explicit `isCrossRepository` check rather than by trusting whoever can press the button.

Scope is proportionate: two files of workflow and script changes plus tests, no product code, and the model pin and prompt are explicitly left alone.
