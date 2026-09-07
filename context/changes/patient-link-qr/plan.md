# Patient Link QR Implementation Plan

## Overview

Add a QR code beneath the existing copyable patient link in both approved-quote admin views, and add the same online URL as a QR code to the printed patient estimate. Generation stays inside the application: a pure SVG renderer uses `qrcode-generator`, with no external QR service and no stored QR payload.

## Current State Analysis

Approval already returns a canonical relative path, `/p/<token>`, and the editor passes it to the shared `CopyLink` control. The same control is used immediately after approval and when an approved quote is reopened (`src/components/admin/ApprovalConfirmation.tsx:19-28`, `src/components/admin/QuoteEditor.tsx:461-462,653-663`). `CopyLink` turns that path into an absolute URL in the browser (`src/components/admin/CopyLink.tsx:17-24`).

The public route is Astro SSR and currently passes content, patient type, and creation time to `PatientQuote` (`src/pages/p/[token].astro:41-73`). The patient component already has an empty `#patient-print-footer` that is hidden on screen, while the existing print stylesheet reveals it (`src/components/patient/PatientQuote.astro:74-78`, `src/styles/global.css:191-280`). No QR dependency or renderer exists.

## Desired End State

- Immediately after approval and when reopening an approved quote, the dentystka sees a horizontally centred QR code at least 200 px wide beneath the existing copy control. The visible link beneath the code and the copied URL are derived from the same `path` prop.
- The public patient page remains unchanged on screen. In print media it shows a high-contrast QR code at least 2 cm square plus `Wersja online: <url>`, using the exact URL of the page being printed.
- The QR is rendered locally as deterministic SVG with error correction level M and a four-module quiet zone. No request leaves the application and no QR representation is stored.
- The product requirements contain FR-054 and FR-055, and roadmap slice S-07 `patient-link-qr` is marked `done` after delivery.

### Key Discoveries

- The approval endpoint already owns the patient-path contract and returns `{ token, path }`; no endpoint or persistence change is needed (`src/pages/api/admin/quotes/approve.ts:105-138`).
- Existing E2E flows expect exactly one textbox in the approval confirmation, so the QR's visible URL must not be another input (`e2e/patient-link-content.spec.ts:57-64`).
- Print behaviour must be verified with both print media and an A4 printable viewport near 717 px; media emulation alone previously hid a layout defect (`e2e/patient-print-layout.spec.ts:30-35,60-93`, `context/foundation/lessons.md`).
- The token is a capability secret. In-process generation preserves the route's `no-referrer` boundary and avoids disclosing it to a third-party image service (`src/pages/p/[token].astro:25-31`).
- `qrcode-generator` 2.0.4 publishes the runtime factory as a named ESM export, while its bundled declaration still uses the CommonJS-shaped `export = qrcode`. The plan must bridge that mismatch locally and prove both TypeScript and the production bundle before UI work begins.

## What We're NOT Doing

- Sending e-mail or adding a `mailto:` action
- Adding an optional patient-email flow
- Adding a separate print route
- Putting a logo or other artwork inside the QR code
- Persisting QR markup or calling an external QR service
- Changing token generation, approval responses, database schema, or existing E2E contracts

## Implementation Approach

Create one pure `patientUrl -> SVG string` renderer around `qrcode-generator`. Admin React surfaces generate the absolute URL after hydration and show the centred SVG by default. The Astro patient route can construct its absolute URL from `Astro.url.origin` and the current token during SSR, then pass it to `PatientQuote` for a print-only footer. Both paths use the existing patient path as their only payload source.

## Critical Implementation Details

### URL lifecycle

The admin origin exists only in the hydrated browser, while the patient page origin exists during Astro SSR. The admin QR must therefore be generated only after client hydration; the print QR must receive an absolute URL from the route. Neither surface should encode query strings or hashes.

### Print geometry

The renderer must include a four-module white quiet zone inside its SVG viewBox, not depend on surrounding CSS for scanner clearance. Print sizing must use physical units (`cm`) with a minimum of 2 cm and must be checked at an A4 printable width near 717 px. Dark modules and the quiet zone are document content, not CSS backgrounds.

## Phase 1: Pure SVG renderer

### Overview

Install the zero-dependency QR encoder and add a deterministic, runtime-neutral SVG renderer with unit coverage.

### Changes Required

#### 1. QR dependency

**Files**: `package.json`, `package-lock.json`

**Intent**: Add `qrcode-generator` as a production dependency because the renderer runs in both the browser bundle and Cloudflare SSR.

**Contract**: Use the package's named ESM `qrcode` runtime export. Do not add `@types/qrcode-generator`; its stub adds no value and the package declaration does not describe the ESM export correctly. Add the narrow local declaration below and make a production build part of this phase's gate.

#### 2. ESM type adapter

**File**: `src/types/qrcode-generator.d.ts` (new)

**Intent**: Describe only the named ESM factory and methods this application calls, keeping the package's runtime/type mismatch out of product code.

**Contract**: Declare the `qrcode(typeNumber, errorCorrectionLevel)` named export plus the returned object's `addData`, `make`, `getModuleCount`, and `isDark` methods. Limit correction levels and data modes to the package's published string unions; do not reproduce unrelated package APIs.

#### 3. SVG renderer

**File**: `src/lib/quote/qr.ts` (new)

**Intent**: Convert an absolute patient URL into compact, high-contrast SVG without DOM or Node-only APIs.

**Contract**: Export a pure `renderPatientQrSvg(patientUrl: string): string`. Create an automatically sized QR at correction level `M`, add the URL as byte data, and render dark modules into SVG geometry with a four-module quiet zone and a square `viewBox`. The returned markup must not interpolate the URL as executable markup or depend on CSS backgrounds.

#### 4. Renderer tests

**File**: `src/lib/quote/qr.test.ts` (new)

**Intent**: Guard the stable rendering contract without coupling tests to a specific QR version or attempting to implement a decoder.

**Contract**: For a representative production-shaped patient URL, assert valid SVG framing, non-empty dark-module geometry, a quiet-zone-aware viewBox, and byte-for-byte determinism. Assert a different URL produces different SVG so the payload is not accidentally constant.

### Success Criteria

#### Automated Verification

- Renderer tests pass: `npx vitest run src/lib/quote/qr.test.ts`
- The full unit suite passes: `npm test`
- New TypeScript files pass ESLint: `npx eslint src/lib/quote/qr.ts src/lib/quote/qr.test.ts`
- TypeScript and the ESM production bundle accept the adapter: `npm run build`

#### Manual Verification

- Generated markup for a production-shaped patient URL contains a square SVG with a visible quiet zone and dark modules

## Phase 2: Admin QR disclosure

### Overview

Add the visible, centred QR affordance to both admin surfaces that already expose the copyable patient link.

### Changes Required

#### 1. QR disclosure component

**File**: `src/components/admin/QrCode.tsx` (new)

**Intent**: Keep the patient QR immediately available and visually centred beneath the copyable link.

**Contract**: Accept the same relative `path: string` as `CopyLink`. Render an accessible, horizontally centred panel by default containing the locally rendered SVG at least 200 px square and a non-input textual or anchor representation of the absolute URL beneath it.

#### 2. Post-approval surface

**File**: `src/components/admin/ApprovalConfirmation.tsx`

**Intent**: Put the QR disclosure next to the existing link action immediately after approval.

**Contract**: Pass the exact `path` prop to both `CopyLink` and `QrCode`. Preserve the existing heading, reset action, and single textbox contract.

#### 3. Reopened approved quote surface

**File**: `src/components/admin/QuoteEditor.tsx`

**Intent**: Offer the same QR disclosure when an immutable approved quote is reopened from the list.

**Contract**: Construct `/p/${patientToken}` once in the read-only link section and pass that same value to both controls. Preserve the missing-token error path and every editing/approval behaviour.

### Success Criteria

#### Automated Verification

- Touched React files pass ESLint: `npx eslint src/components/admin/QrCode.tsx src/components/admin/ApprovalConfirmation.tsx src/components/admin/QuoteEditor.tsx`
- The full unit suite passes: `npm test`
- Existing browser contracts pass unchanged: `npm run test:e2e`

#### Manual Verification

- Immediately after approval, a horizontally centred QR code at least 200 px wide is visible and the URL beneath it matches the copy field exactly
- Reopening an approved quote exposes the same QR behaviour; a draft has no QR affordance
- The approval confirmation still contains exactly one textbox and remains usable by keyboard

## Phase 3: Print footer and product records

### Overview

Render the online URL into the patient document during SSR, reveal it only for print, and record the delivered behaviour in the product requirements and roadmap.

### Changes Required

#### 1. Patient route URL

**File**: `src/pages/p/[token].astro`

**Intent**: Give the patient document the absolute URL required by a self-contained printed QR.

**Contract**: When a quote resolves, build the URL from `Astro.url.origin` and `/p/${token}` and pass it as a required `patientUrl` prop to `PatientQuote`. Preserve the generic 404 behaviour, response headers, and anonymous RPC boundary.

#### 2. Patient print footer

**File**: `src/components/patient/PatientQuote.astro`

**Intent**: Fill the reserved footer with an SSR-rendered QR and a readable fallback URL.

**Contract**: Extend props with `patientUrl: string`, render `renderPatientQrSvg(patientUrl)` in `#patient-print-footer`, and add `Wersja online: <url>` as escaped text. Keep the entire footer hidden on screen and do not create a client island.

#### 3. Print rules

**File**: `src/styles/global.css`

**Intent**: Make the footer scan-friendly on an actual printed page without disturbing the existing comparison or tooth-chart layout.

**Contract**: In the existing `@media print` block, reveal and lay out the footer with `break-inside: avoid`, black modules on a white ground, and a QR size of at least 2 cm in physical units. Do not rely on background colour or image for meaning.

#### 4. Requirements and roadmap

**Files**: `context/foundation/prd.md`, `context/foundation/roadmap.md`

**Intent**: Keep product records aligned with the shipped capability.

**Contract**: Add FR-054 for the admin QR and FR-055 for the printed patient QR. In the roadmap, add S-07 `patient-link-qr` with prerequisite S-01 and refs FR-052/054/055 to `At a glance`, Stream A, and a full slice section; add the delivered outcome to `Done`. Do not add an already-completed slice to `Backlog Handoff` or change unrelated priorities.

### Success Criteria

#### Automated Verification

- Touched Astro and CSS files pass their checks: `npx eslint 'src/pages/p/[token].astro' src/components/patient/PatientQuote.astro && npx prettier --check src/styles/global.css`
- The full unit suite passes: `npm test`
- Existing E2E suite passes unchanged at the required media dimensions: `npm run test:e2e`
- Production build succeeds: `npm run build`
- Product records contain FR-054, FR-055, and a done S-07 entry: `rg -n 'FR-054|FR-055|patient-link-qr' context/foundation/prd.md context/foundation/roadmap.md`

#### Manual Verification

- At print media and approximately 717 px printable width, the footer is visible, stays together, and its QR measures at least 2 cm
- The patient page has no QR footer visible in screen media
- A real phone opens the exact current patient URL from both the admin-screen QR and a PDF/print rendering

## Testing Strategy

### Unit Tests

- Treat the renderer as a pure function: deterministic SVG framing and different output for different URLs.
- Avoid brittle snapshots of the entire matrix and do not add a second QR implementation as a decoder.

### Integration Tests

- Run the existing Playwright suite after phases that touch React/Astro UI, without changing existing specs to accommodate the feature.
- Preserve the approval flow's single-textbox and anonymous patient-link contracts.

### Manual Testing Steps

1. Approve a quote, confirm the centred QR is immediately visible, and compare its URL with the existing copy field.
2. Reopen that approved quote and repeat the comparison.
3. Open its patient page and confirm the footer is absent in screen media.
4. Render at print media and an A4-width viewport, then confirm the footer stays intact and is at least 2 cm square.
5. Scan the admin QR and the PDF/print QR with a real phone and confirm both open that quote.

## Performance Considerations

QR generation is bounded by one short URL. The admin renderer runs once when the approved view renders; the SSR renderer runs once per successful patient-page request. SVG avoids bitmap encoding and external I/O.

## Migration Notes

No data migration, API change, or deployment ordering is required. Each phase is independently revertible. After merge, run the repository's test-plan procedure to record risks #7-#9 and their coverage before closing the change.

## References

- Product scope: `context/foundation/prd.md` FR-052 and the planned FR-054/055
- Patient-link response: `src/pages/api/admin/quotes/approve.ts:105-138`
- Admin link surfaces: `src/components/admin/ApprovalConfirmation.tsx`, `src/components/admin/QuoteEditor.tsx`
- Patient SSR boundary: `src/pages/p/[token].astro`
- Existing print contract: `src/styles/global.css:191-280`, `e2e/patient-print-layout.spec.ts`
- Recurring print rules: `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Pure SVG renderer

#### Automated

- [x] 1.1 Renderer tests pass: `npx vitest run src/lib/quote/qr.test.ts` — 89ed090
- [x] 1.2 The full unit suite passes: `npm test` — 89ed090
- [x] 1.3 New TypeScript files pass ESLint: `npx eslint src/lib/quote/qr.ts src/lib/quote/qr.test.ts` — 89ed090
- [x] 1.4 TypeScript and the ESM production bundle accept the adapter: `npm run build` — 89ed090

#### Manual

- [x] 1.5 Generated markup for a production-shaped patient URL contains a square SVG with a visible quiet zone and dark modules — 89ed090

### Phase 2: Admin QR disclosure

#### Automated

- [x] 2.1 Touched React files pass ESLint: `npx eslint src/components/admin/QrCode.tsx src/components/admin/ApprovalConfirmation.tsx src/components/admin/QuoteEditor.tsx` — 90e4000
- [x] 2.2 The full unit suite passes: `npm test` — 90e4000
- [x] 2.3 Existing browser contracts pass unchanged: `npm run test:e2e` — 90e4000

#### Manual

- [x] 2.4 Immediately after approval, a horizontally centred QR code at least 200 px wide is visible and the URL beneath it matches the copy field exactly — 90e4000
- [x] 2.5 Reopening an approved quote exposes the same QR behaviour; a draft has no QR affordance — 90e4000
- [x] 2.6 The approval confirmation still contains exactly one textbox and remains usable by keyboard — 90e4000

### Phase 3: Print footer and product records

#### Automated

- [ ] 3.1 Touched Astro and CSS files pass their checks: `npx eslint 'src/pages/p/[token].astro' src/components/patient/PatientQuote.astro && npx prettier --check src/styles/global.css`
- [ ] 3.2 The full unit suite passes: `npm test`
- [ ] 3.3 Existing E2E suite passes unchanged at the required media dimensions: `npm run test:e2e`
- [ ] 3.4 Production build succeeds: `npm run build`
- [ ] 3.5 Product records contain FR-054, FR-055, and a done S-07 entry: `rg -n 'FR-054|FR-055|patient-link-qr' context/foundation/prd.md context/foundation/roadmap.md`

#### Manual

- [ ] 3.6 At print media and approximately 717 px printable width, the footer is visible, stays together, and its QR measures at least 2 cm
- [ ] 3.7 The patient page has no QR footer visible in screen media
- [ ] 3.8 A real phone opens the exact current patient URL from both the admin-screen QR and a PDF/print rendering
