# Move `PickerOption` into the pricing layer — Plan Brief

> Full plan: `context/changes/refactor-opportunities/plan.md`
> Research: `context/changes/refactor-opportunities/research.md`

## What & Why

`src/lib/pricing/picker-options.ts` imports a type upward out of
`src/components/admin/types.ts`. It is the only `lib-not-to-components`
violation in the repository, and it is why `npm run depcruise` exits non-zero —
so the layer rules written during the repo-mapping exercise cannot be used as a
quality gate. Moving one interface fixes the direction and turns a broken
command into a usable one.

## Starting Point

`PickerOption` is declared at `src/components/admin/types.ts:13` and used by six
files: four React islands, its own declaration site, and the pricing module that
reaches up for it. The direction is accidental — the component type predates the
lib module by three months, and `git log -L` shows the option-building logic was
cut out of an Astro page into `src/lib/pricing/` and carried its type reference
with it. No plan or review ever discusses it; dependency-cruiser noticed it
first, in September.

## Desired End State

`PickerOption` lives in `src/lib/pricing/picker-options.ts` beside the
`PickerOptions` container that already owns it; `admin/types.ts` imports it
downward; `npm run depcruise` reports 0 violations; no runtime behaviour
changes. In Phase 2 the cruise joins CI, so the boundary defends itself.

## Key Decisions Made

| Decision                                            | Choice                                            | Why (1 sentence)                                                                                                                                                    | Source        |
| --------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Which candidate to implement                        | **C2 — move `PickerOption`**                      | Its cost is ~30 min and its proof is total and mechanical; the strongest candidate (C1) has no safety net at the moment it needs one.                               | Plan          |
| Destination for the type                            | `src/lib/pricing/picker-options.ts`               | The plural `PickerOptions` already lives there and is already re-exported by the barrel; `src/types.ts` would work but widens a hub that already has 15 dependents. | Research      |
| Re-export from `admin/types.ts` to shrink the diff? | **No**                                            | A re-export leaves the type looking like it still belongs to the UI folder — the exact confusion being removed.                                                     | Plan          |
| Add `depcruise` to CI in the same commit?           | **No — Phase 2**, with `astro check` alongside it | Enforcement is switched on after the code already complies; `astro check` joins it because it is this change's real verifier and is absent from CI today.           | Plan / Review |
| Add a unit test for the moved type                  | **No**                                            | It is an `interface`, erased at build; `astro check` proves everything a test could.                                                                                | Plan          |

## Scope

**In scope:** move one interface declaration; re-point six imports; add
`npm run depcruise` to CI in Phase 2.

**Out of scope:** C1 (sharing the approval wire format — two phases, the first
of which exists only to build the safety net it currently lacks); C5 (the `Database` generic — prerequisite lives in the
database); C6's read side (would apply a bound to already-stored immutable rows
and silently 404 patient links); any rename; any restructuring of
`QuoteEditorProps`.

## Architecture / Approach

One type declaration moves down a layer. `PickerOption extends PricelistItemRef`,
and `PricelistItemRef` comes from `@/types`, which `src/lib/pricing` may import
freely — so the move creates no new dependency, it only reverses an existing one.
The four islands then import from `@/lib/pricing` instead of `./types`.

## Phases at a Glance

| Phase                     | What it delivers                       | Key risk                                                                                        |
| ------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1. Move the declaration   | `depcruise` goes from 1 violation to 0 | A wrong import path — caught by `astro check`, not by any test, since no test imports this type |
| 2. Make the cruise a gate | `npm run depcruise` runs in CI         | None material; the code already complies by then                                                |

**Prerequisites:** none. `.dependency-cruiser.cjs` and the layer rules already
exist, and `npm run lint` was repaired in `4ddf54d`.
**Estimated effort:** one short session; six files, type-only.

## Open Risks & Assumptions

- **The safety net here is the compiler, not tests.** No test imports
  `PickerOption`, so `astro check` and `npm run build` are the real verification.
  This is acceptable precisely because the change is type-only and erased at
  build — but it means "tests still pass" proves nothing on its own.
- **The reward is deferred to Phase 2.** Phase 1 alone makes a command green
  without making it a gate. If Phase 2 never lands, the violation can silently
  come back.
- **Assumption:** nothing outside the six identified files references
  `PickerOption`. Verified by word-boundary grep across `.ts`, `.tsx` and
  `.astro`, and by a depcruise reach query — but a dynamic or string-based
  reference would evade both. Given it is a TypeScript interface, that risk is
  effectively zero.

## Success Criteria (Summary)

- `npm run depcruise` reports 0 violations, down from exactly 1.
- The admin editor's two pricelist pickers still list and add items.
- Nothing else moves: 40 tests still pass, `astro check` clean, build completes.
