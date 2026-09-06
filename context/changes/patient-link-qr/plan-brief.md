# Patient Link QR — Plan Brief

> Full plan: `context/changes/patient-link-qr/plan.md`

## What & Why

Approved quotes already expose a patient link, but handing that link to someone in the practice still means copying it through another channel. This change adds an on-demand QR in the admin panel and a print-only QR on the patient estimate, both pointing to the existing `/p/<token>` URL.

## Starting Point

The approval response and reopened approved-quote view already converge on the shared `CopyLink` component. The public Astro page already reserves an empty print footer, but it does not currently pass its own absolute URL into the patient document.

## Desired End State

The dentystka can show a scannable QR immediately after approval or from a reopened approved quote. A printed estimate carries a QR and readable URL back to the same online document, while the normal screen view stays unchanged.

## Key Decisions Made

| Decision         | Choice                                              | Why                                                                                         |
| ---------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Encoder          | `qrcode-generator`, correction M                    | Zero dependencies, ESM/types included, works in browser and Workers runtime                 |
| Output           | Pure in-process SVG renderer                        | One implementation serves React and Astro without external disclosure or storage            |
| Admin UX         | Collapsed `Pokaż QR`, at least 200 px               | Keeps the existing compact link control and expands only when needed                        |
| Admin URL source | Same `path` prop as `CopyLink`                      | Prevents the copied link and QR payload from drifting                                       |
| Print URL source | `Astro.url.origin` plus current `/p/<token>`        | Produces an absolute QR payload during SSR                                                  |
| Print geometry   | Four-module quiet zone, at least 2 cm               | Gives scanners physical clearance and survives default print settings                       |
| Verification     | Pure unit tests, existing E2E, two real-phone scans | Covers deterministic generation, regressions, and the medium no browser assertion can prove |

## Scope

**In scope:**

- Pure SVG QR renderer and colocated unit test
- Expandable QR beside the copy link on both approved admin surfaces
- SSR-rendered, print-only patient footer with QR and readable URL
- FR-054, FR-055, and roadmap S-07

**Out of scope:**

- E-mail sending, `mailto:`, or optional patient e-mail
- Separate print route or QR persistence
- Logo inside the code or an external QR service
- Token, API, database, or existing E2E-contract changes

## Architecture / Approach

The existing relative patient path remains the source of truth. React turns it into an absolute URL after hydration and reveals an SVG on demand; Astro builds the same absolute URL during SSR and places the renderer output in the reserved print footer. A pure module under `src/lib/quote/` contains all QR encoding and SVG generation.

## Phases at a Glance

| Phase                               | What it delivers                                      | Key risk                                                      |
| ----------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------- |
| 1. Pure SVG renderer                | Dependency, renderer, and deterministic unit coverage | Quiet zone or output contract becomes scanner-hostile         |
| 2. Admin QR disclosure              | Same QR affordance in both approved admin views       | QR URL drifts from the copyable link or adds a second textbox |
| 3. Print footer and product records | SSR QR, physical print rules, PRD and roadmap         | Screen leakage or an A4-only layout regression                |

**Prerequisites:** Existing S-01 patient link and approved-quote views on green `main`.
**Estimated effort:** Three small implementation phases plus review and closure.

## Open Risks & Assumptions

- The installed `qrcode-generator` package retains its published ESM entry and bundled declarations.
- Browser print scaling can still affect physical size, so a phone scan of the produced PDF/print is a required human check.
- `Astro.url.origin` reflects the externally reachable origin in the deployed Worker, as it does for the current request URL.

## Success Criteria Summary

- Both approved admin views reveal a QR whose visible URL matches the existing copy field.
- The QR is hidden on the patient screen view and present at at least 2 cm in print.
- A real phone opens the same patient quote from both the screen QR and the PDF/print QR.
