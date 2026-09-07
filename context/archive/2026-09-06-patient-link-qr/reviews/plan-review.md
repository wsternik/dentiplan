<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Patient Link QR

- **Plan**: `context/changes/patient-link-qr/plan.md`
- **Mode**: Deep
- **Date**: 2026-09-06
- **Verdict**: REVISE → SOUND after fixes
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension             | Verdict | After fixes |
| --------------------- | ------- | ----------- |
| End-State Alignment   | PASS    | PASS        |
| Lean Execution        | PASS    | PASS        |
| Architectural Fitness | WARNING | PASS        |
| Blind Spots           | WARNING | PASS        |
| Plan Completeness     | WARNING | PASS        |

## Grounding

9/9 existing paths ✓, 6/6 symbols ✓, Progress↔Phase structure ✓, brief↔plan ✓. New paths are explicitly marked new. One read-only deep verification covered package interop, both admin call sites, the Astro SSR boundary, print geometry, and blast radius.

## Findings

### F1 — The package's ESM export and TypeScript declaration disagree

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 — QR dependency and renderer
- **Detail**: `qrcode-generator` 2.0.4 exposes `qrcode` as a named export from `dist/qrcode.mjs`, but `dist/qrcode.d.ts` declares `export = qrcode`. A default import can type-check and fail at ESM runtime; a named import can run and fail type checking. The original plan assumed the published types and runtime aligned.
- **Fix**: Use the named ESM runtime export, add a narrow local declaration for only the factory and matrix methods used here, and require `npm run build` in phase 1.
- **Decision**: FIXED

### F2 — The roadmap update did not name every live surface

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — Requirements and roadmap
- **Detail**: The roadmap carries current slices in `At a glance`, `Streams`, a detailed slice section, and `Done`. “Update the relevant summary/stream” left the implementer to rediscover the rest and could produce an internally inconsistent roadmap.
- **Fix**: Name all four locations explicitly and state that a completed S-07 does not belong in `Backlog Handoff`.
- **Decision**: FIXED

### F3 — Admin URL normalization remains duplicated

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 2 — `QrCode.tsx`
- **Detail**: `CopyLink` already builds `${window.location.origin}${path}` and the new component will do the same. A shared URL helper could make drift mechanically impossible.
- **Fix**: None applied. The accepted product contract is that both controls receive the same relative `path`; extracting a helper for one expression would widen this smallest slice without changing the boundary.
- **Decision**: ACCEPTED

### F4 — Automated browser checks do not assert the new QR integration

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Testing Strategy
- **Detail**: The existing print E2E measures the two treatment variants at 717 px but does not inspect the QR footer, its physical size, or screen visibility. The existing patient-link test also does not expand a QR.
- **Fix**: None applied. The scoped verification is a pure renderer unit test, the unchanged regression suite, geometry checks during the phase, and the required real-phone scans from screen and PDF. A new E2E would create another immutable approved quote while still being unable to prove scanability.
- **Decision**: ACCEPTED
