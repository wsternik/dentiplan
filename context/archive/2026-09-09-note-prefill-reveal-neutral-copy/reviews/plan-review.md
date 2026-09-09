<!-- PLAN-REVIEW-REPORT -->

# Plan review — note-prefill-reveal-neutral-copy

Reviewed: `context/changes/note-prefill-reveal-neutral-copy/plan.md` (+ `plan-brief.md`), 2026-09-09.
Mode: document scan + grounding. No sub-agent verification — the plan touches one function
and five prose files, so the riskiest claims were checkable directly.

Grounding: 7/7 paths ✓ · symbols ✓ (`manualFormOpen`, `handlePrefill`, `applyPrefill`,
`PrefillResult`, `ToothEntrySchema`) · brief↔plan ✓ · Progress↔Phase ✓ (2 phases, 9 bullets,
plain bullets in phase bodies).

Contract surfaces (`docs/reference/contract-surfaces.md`): the plan text matches **F-02 —
Pricelist Seed** through `src/lib/pricing/data/pricing.json`. The edit is confined to the
`$comment` string; no id, name, category, or fee constant changes, so no consumer contract
moves. See F1 for the gate this nevertheless implies.

## Findings

### F1 — WARNING · 🏃 LOW · Blind Spots — Phase 2 touches the pricelist seed without naming its gate

**Location**: Phase 2 → Success Criteria → Automated Verification

The repo guards `src/lib/pricing/` with a dedicated fail-fast gate, `npm run validate:pricing`
(`docs/reference/contract-surfaces.md` §F-02 "Validation gate"), because the seed has no test
file of its own. Editing `pricing.json` — even only its `$comment` — is exactly the change
that gate exists to catch if a quote or brace goes astray, and the plan does not list it.

**Fix**: add `npm run validate:pricing` to Phase 2's automated verification and to Progress.

### F2 — OBSERVATION · 🏃 LOW · Plan Completeness — the "no hits" gate reads as a failure

**Location**: Phase 2 → Success Criteria → `git ls-files … | xargs -0 grep -il …`

A `grep` that finds nothing exits non-zero. Stated as "returns nothing", the implementer
running it inside a `&&` chain will read the exit code as a failed gate.

**Fix**: state the expected outcome as "no output (exit 1 from grep is the pass)".

### F3 — OBSERVATION · 🏃 LOW · End-State Alignment — reveal after a manual collapse

**Location**: Desired End State

Manual testing step 3 exercises "collapse, prefill again, it reopens", but the end state does
not say the reveal is unconditional on success. It is the intended behaviour (the reveal is a
`true` write, not a toggle), and it is worth stating so nobody later "fixes" it into a
remembered preference.

**Fix**: one clause in Desired End State. No code impact.

## Verdict

Plan is sound: scope is honest, the failure path is explicitly preserved, and the one place it
could have quietly grown a pure-function seam for testability (the reveal) is correctly left as
component state with a Playwright proof instead. Apply F1–F3 as text edits and proceed to
`/10x-implement`.
