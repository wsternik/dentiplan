# Follow-ups from the implementation review

Deferred with reason on 2026-09-06; see `../reviews/impl-review.md` for the full
findings.

## F2 — Verify the prompt against a live model

The three manual criteria that need a real call (2.5, 2.6, 3.5) were ticked
without one. Run the plan's Manual testing steps 1–5 against the endpoint once
the spending cap (**B10**) is settled, and clean the production rows up with SQL
afterwards (FR-053). This is the only check that the prompt's grouping rules and
the mapper actually meet.

## F3 — A teeth-less hygiene visit has no name

`visitLabel` takes teeth only, so `"Higienizacja"` — a member of `VISIT_LABELS` —
is unreachable and a visit made of general items alone renders with `VisitList`'s
placeholder. Closing it means widening `visitLabel` / `orderVisits` to take the
visit's general items, plus deciding which catalog items count as hygiene. That
second half belongs with **B12**, where the grouping rules are being rewritten
anyway.

## Carried over from the plan review

Deduplication of general items is keyed on the item id, not on the pair
(id, visit), so hygiene proposed for visit 1 and visit 4 collapses to the first
with a warning. Deliberate: it is one dropdown for her and a dedup-key redesign
for us.

## Triage of the CI review agent's pass on PR #8

Verdict **APPROVED**, three findings, all `minor` — nothing critical or high, so
nothing was fixed before the merge.

1. _Unreachable `"Higienizacja"`_ — the same defect as **F3** above, found
   independently. Stays deferred there.
2. _Unverified consumer of the changed `generalItems` shape_ — dismissed. What
   changed is `PrefillResult` in `src/lib/llm/schema.ts`, whose only consumer is
   `merge.ts`, and that is in the diff. The application-wide `GeneralItem` in
   `src/types.ts` already carried `visitNumber` before this change; `types.ts` is
   untouched by the diff, which is why no UI call site moved.
3. _No test for a three-way urgency tie_ — accepted as a real gap, not worth a
   pre-merge commit. `orderVisits` sorts with `Array.prototype.sort`, stable per
   spec, so the two-visit test already exercises the mechanism; a third visit
   would harden the guarantee, not change it. Fold it in with **F3**, which
   touches the same signature.
