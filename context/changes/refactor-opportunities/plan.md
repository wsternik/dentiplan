# Move `PickerOption` into the pricing layer — Implementation Plan

## Overview

Move the `PickerOption` interface from `src/components/admin/types.ts` to
`src/lib/pricing/picker-options.ts`, so `src/lib/pricing` stops importing upward
into `src/components`. This is the single `lib-not-to-components` violation in
the repository, and it is the reason `npm run depcruise` exits non-zero — which
in turn is why the layer rules written during the M4L2 mapping cannot yet be a
quality gate.

## Current State Analysis

`PickerOption` is declared at `src/components/admin/types.ts:13` and used by six
files (verified by word-boundary grep — a naive substring search reports nine,
because it also matches `PickerOptions` and `buildPickerOptions`):

| File                                                 | Uses it for                                                                                     |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `src/components/admin/types.ts:13`                   | **the declaration**, plus `QuoteEditorProps.toothOptions` (`:20`) and `.generalOptions` (`:22`) |
| `src/components/admin/QuoteEditor.tsx:25,28,136,169` | `toRef()`, `addToothItem()`, `addGeneral()`                                                     |
| `src/components/admin/ToothRow.tsx:17,22,24`         | props                                                                                           |
| `src/components/admin/PricelistPicker.tsx:9,12,13`   | props                                                                                           |
| `src/components/admin/GeneralItems.tsx:12,16,18`     | props                                                                                           |
| `src/lib/pricing/picker-options.ts:16`               | **the upward `import type`** — the violation                                                    |

`npm run depcruise` today:

```
error lib-not-to-components: src/lib/pricing/picker-options.ts → src/components/admin/types.ts
x 1 dependency violations (1 errors, 0 warnings). 90 modules, 157 dependencies cruised.
```

The direction is accidental, not designed. The component type predates the lib
module by three months (`db9208e` vs `d8e1c0f`); `git log -L` shows the
option-building logic was cut out of the Astro page into `src/lib/pricing/` and
carried its type reference along with it. No plan or review ever discusses the
direction. Details in `research.md` §2 C2.

### Key Discoveries

- **`PickerOption` is an `interface`** — erased at build. A pure type move cannot
  change runtime behaviour. The verifier is the compiler, not a test.
- **No `.astro` file imports `src/components/admin/types.ts`** (grep-confirmed,
  `--include='*.astro'` → empty). This is the one candidate in the ranking where
  dependency-cruiser is **not** under-reporting, so its blast radius of 5
  importers is the true number.
- **No test imports `PickerOption`.** Its correctness is entirely a compile-time
  property.
- **`PickerOptions` (plural) already lives in `picker-options.ts:20`** and is
  re-exported by `src/lib/pricing/index.ts:17`. The destination is not a new home
  invented for this refactor — it is where the singular's own container already
  lives.
- **`PickerOption extends PricelistItemRef`** (`types.ts:13`), and
  `PricelistItemRef` comes from `@/types` — which `src/lib/pricing` may import
  freely. The move creates no new dependency.

## Desired End State

`PickerOption` is declared in `src/lib/pricing/picker-options.ts`;
`src/components/admin/types.ts` imports it downward from `@/lib/pricing`;
`npm run depcruise` reports **0 violations**; nothing else changes.

Verified by: `npm run depcruise` exits 0, `astro check` reports 0 errors,
`npm test` stays at 40 passing, `npm run build` completes.

## What We're NOT Doing

- **Not touching C1** (sharing the approval wire format). It is the
  highest-value candidate in the ranking and needs two phases, the first of which
  restructures a 691-line component. It is a change of its own.
- **Not touching C5** (the `Database` generic). Its prerequisite lives in the
  database, not the repo.
- **Not touching C6's read side.** Bounding `VisitSchema` in `types.ts` would
  apply to already-stored immutable rows and silently 404 patient links.
- **Not renaming anything.** `PickerOption` keeps its name; only its home moves.
- **Not restructuring `admin/types.ts`** beyond removing the one declaration.
  `QuoteEditorProps` stays exactly where it is.
- **Not adding `npm run depcruise` to CI in Phase 1.** That is Phase 2, on
  purpose — see below.

## Implementation Approach

Two phases, deliberately separated by the rule that **enforcement is switched on
as its own step, after the code already complies.** Phase 1 makes the cruise
green; Phase 2 makes it a gate. If they were one commit and something else in
the repo turned out to violate a different rule, the failure would be
indistinguishable from this change's own failure.

Phase 1 is a single revertible commit touching six files, no runtime behaviour,
no persisted data.

## Phase 1: Move the declaration

### Overview

Relocate `PickerOption` to the pricing layer and re-point every import.

### Changes Required:

#### 1. The destination

**File**: `src/lib/pricing/picker-options.ts`

**Intent**: Own the type it already builds. Declare `PickerOption` here and drop
the upward `import type` at `:16` that creates the violation.

**Contract**: `export interface PickerOption extends PricelistItemRef` — the same
shape as today, with `PricelistItemRef` imported from `@/types` (already the
module's own dependency direction). Keep the existing `PickerOptions` interface
immediately below it, unchanged.

#### 2. The barrel

**File**: `src/lib/pricing/index.ts`

**Intent**: Make the type reachable from the layer's public face, alongside the
`PickerOptions` it already re-exports at `:17`.

**Contract**: add `PickerOption` to the existing `export type { … } from "./picker-options"`.

#### 3. The former home

**File**: `src/components/admin/types.ts`

**Intent**: Stop declaring the type; import it downward instead, so
`QuoteEditorProps` keeps working unchanged.

**Contract**: remove the `export interface PickerOption` block at `:13`; add
`import type { PickerOption } from "@/lib/pricing"`. Re-export it if and only if
that keeps the four island imports unchanged — see the note below.

#### 4. The four islands

**Files**: `src/components/admin/QuoteEditor.tsx:25`,
`ToothRow.tsx:17`, `PricelistPicker.tsx:9`, `GeneralItems.tsx:12`

**Intent**: Point each `import type { PickerOption }` at the new home.

**Contract**: import from `@/lib/pricing` rather than `./types`. Where a file
imports both `PickerOption` and something that genuinely still lives in
`./types` (e.g. `QuoteEditorProps` in `QuoteEditor.tsx:25`), the import splits
into two lines.

**Note on re-exporting.** Re-exporting `PickerOption` from `admin/types.ts`
would let the four islands keep their imports untouched and shrink the diff to
two files. It is rejected: a re-export leaves the type looking like it still
belongs to the UI folder, which is the exact confusion this change exists to
remove, and dependency-cruiser would still record a `components → lib` edge
carrying the name. Prefer the honest six-file diff.

### Success Criteria:

#### Automated Verification:

- `npm run depcruise` reports **0 violations** (from exactly 1 today)
- `astro check` reports 0 errors, 0 warnings
- `npm test` passes — 40 tests, unchanged
- `npm run lint` exits 0
- `npm run build` completes
- `grep -rn "PickerOption\b" src --include='*.tsx' --include='*.ts' | grep -v PickerOptions` shows the declaration only in `src/lib/pricing/picker-options.ts`

#### Manual Verification:

- The admin quote editor still renders and its two pricelist pickers still list
  and add items — the one behaviour a wrong import path could plausibly break at
  runtime despite compiling.

**Implementation Note**: this phase is type-only. If any automated check other
than `depcruise` changes state, something beyond a type move happened — stop and
look rather than pressing on.

---

## Phase 2: Make the cruise a gate

### Overview

Add `npm run depcruise` to CI, so the layer rules defend themselves from here on.

### Changes Required:

#### 1. The workflow

**File**: `.github/workflows/ci.yml`

**Intent**: Run the dependency cruise alongside the existing lint step, so a
future upward import fails the PR rather than being discovered months later by a
mapping exercise.

**Contract**: a step invoking `npm run depcruise`, placed next to `lint` and
before `build`. It must run on the same trigger as the existing checks.

### Success Criteria:

#### Automated Verification:

- The CI run for the PR shows a passing `depcruise` step
- Deliberately re-introducing the upward import locally makes `npm run depcruise`
  exit non-zero (confirming the gate would actually catch the regression it
  exists for)

#### Manual Verification:

- None. This phase is entirely mechanical.

---

## Testing Strategy

### Unit Tests

**None added, deliberately.** `PickerOption` is an interface with no runtime
representation; there is nothing a unit test could assert that `astro check`
does not already prove. Adding one would be ceremony.

### Integration Tests

None. No integration surface changes.

### Manual Testing Steps

1. `npm run dev`, sign in, open `/admin/quotes/new`.
2. Add a tooth, open its pricelist picker, add an item — confirm options list and
   selection works.
3. Add a general item from its picker — same check on the second picker.

That is the whole manual surface: the two components that consume
`buildPickerOptions()`'s output.

## Migration Notes

None. No data, no schema, no deployed behaviour changes.

## References

- Exploration and ranking: `context/changes/refactor-opportunities/research.md` §4
- Why the violation exists: same file, §2 C2 (intentionality — accidental, from a
  code move in `d8e1c0f`)
- The rules this unblocks: `.dependency-cruiser.cjs`, written in
  `context/map/artifact-2-structure.md` §1
- The larger target this points at: `context/domain/03-anti-corruption-layer.md`
  §6 A6, which needs `depcruise` to be a working gate before its own enforcement
  step can land

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Move the declaration

#### Automated

- [ ] 1.1 `npm run depcruise` reports 0 violations
- [ ] 1.2 `astro check` reports 0 errors, 0 warnings
- [ ] 1.3 `npm test` passes, 40 tests
- [ ] 1.4 `npm run lint` exits 0
- [ ] 1.5 `npm run build` completes
- [ ] 1.6 the declaration appears only in `src/lib/pricing/picker-options.ts`

#### Manual

- [ ] 1.7 admin editor renders; both pricelist pickers list and add items

### Phase 2: Make the cruise a gate

#### Automated

- [ ] 2.1 CI run shows a passing `depcruise` step
- [ ] 2.2 re-introducing the upward import locally makes `npm run depcruise` fail
