# Local setup documentation consistency — Plan Brief

> Full plan: `context/changes/setup-docs-consistency/plan.md`

## What & Why

Correct four small inconsistencies that can mislead a reviewer or break local setup: the Worker env template, the archived design-brief link, the shipped odontogram status, and the nonexistent Supabase seed file.

## Starting Point

The product and migrations are already shipped. Only README and local Supabase configuration lag behind the repository state.

## Desired End State

A clean checkout has resolvable documentation links and commands, accurately describes shipped UI, and can reset its local database without an absent seed file.

## Key Decisions Made

| Decision           | Choice            | Why                                                                                                  |
| ------------------ | ----------------- | ---------------------------------------------------------------------------------------------------- |
| Database seed      | Disable `db.seed` | The project defines no DB seed data; pricelist data is bundled and the operator is created manually. |
| Odontogram wording | List as shipped   | The roadmap records S-06 as done and the feature is present in current UI/tests.                     |
| Design brief       | Link to archive   | Completed change artifacts are immutable under the dated archive path.                               |

## Scope

**In scope:** `README.md`, `supabase/config.toml`, link/config/reset verification.

**Out of scope:** migrations, hosted schema, sample data, auth automation, product behavior.

## Phases at a Glance

| Phase                | What it delivers                              | Key risk                                                                |
| -------------------- | --------------------------------------------- | ----------------------------------------------------------------------- |
| 1. Setup consistency | Correct docs/config plus clean-reset evidence | Docker may be unavailable locally, leaving reset explicitly unverified. |

**Prerequisites:** clean `main`; Docker for full reset verification.

## Success Criteria (Summary)

- Every local README link resolves.
- README statements match repository files and shipped status.
- Supabase reset does not request a missing seed file and completes when Docker is available.
