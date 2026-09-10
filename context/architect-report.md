# Architecture report - DentiPlan

**Analysis snapshot:** `f0e916e`, 4 September 2026

This two-page synthesis links four Module 4 artifacts: the
[repository map](https://github.com/wsternik/dentiplan/blob/main/context/map/repo-map.md),
[feature research](https://github.com/wsternik/dentiplan/blob/main/context/archive/2026-09-04-quote-approval-flow-analysis/research.md),
[refactoring plan](https://github.com/wsternik/dentiplan/blob/main/context/changes/refactor-opportunities/plan.md),
and [domain notes](https://github.com/wsternik/dentiplan/tree/main/context/domain).
The analysis describes its historical snapshot; later product work is not
presented as if it had existed on 4 September.

## 1. Project

DentiPlan helps one dentist turn a semi-structured diagnosis into a patient
quote. The approved result compares a standard multi-visit plan with a
single-session general-anaesthesia plan and is shared through an unguessable
patient link. The stack is Astro SSR, React islands, Tailwind, Zod and Supabase,
deployed to Cloudflare Workers. The defining property is not repository size but
irreversibility: approved quotes cannot be edited or deleted.

## 2. Repository map

The map reconciled git co-change, a dependency graph and authorship. Three
independent signals converged on the approval path: the admin editor and page
co-changed in every relevant historical commit; `approve.ts` was the widest
reaching code file; and the earlier test plan already ranked approval risks
first. The graph had no dependency cycles and React islands did not import the
database client or server environment. Its important limitation was explicit:
the analyser could not parse `.astro`, so roughly 23% of real import edges -
including much of the patient render path - remained invisible.

## 3. Feature analysis

The analysed flow was editor -> validation -> price freeze -> one database write
-> token -> patient page. The client sends price-list identifiers; the server
re-resolves them, recomputes totals and writes either an approved INSERT or an
UPDATE guarded by `status = 'draft'`. Splitting this write could create an
approved row without a token, after which the immutability trigger would prevent
repair. Anonymous reads go through a `SECURITY DEFINER` RPC that returns the same
empty result for unknown, malformed and draft tokens.

The highest-risk debt was a duplicated approval wire format with no test across
the producer/consumer seam. The irreversible endpoint also had eleven untested
branches, and two E2E assertions could stay green while displaying a zero total.
AST-grep confirmed repeated response helpers and scattered status definitions;
every zero-result query was checked with plain grep after one AST pattern proved
too narrow.

## 4. Refactoring plan

Fourteen observations became six structural candidates and eight non-candidates.
The chosen change moved `PickerOption` from the admin UI into the pricing layer.
It was smaller than sharing the approval contract, but its proof was complete:
the forbidden UI-to-UI dependency fell from one to zero, TypeScript made the old
import invalid, and dependency-cruiser could enforce the boundary in CI. Phase 1
was implemented as `dc8e89e`; the enforcement followed separately so a gate
failure could not be confused with the move itself.

Larger changes were deferred for concrete reasons. Bounding persisted visit
labels on the read side could turn immutable historical quotes into silent 404s.
Introducing a database generic depended on generated database state that CI did
not reproduce. The approval contract remained the highest-value follow-up, but
needed a seam test before migration.

## 5. Domain design

The central invariant is "an approved quote never changes." It belongs to a
Quote aggregate but was enforced independently by a database trigger, endpoint
status filters and the UI. The trigger is the strongest protection and should
remain even if application code gains a named `approveQuote()` operation. A
Supabase anti-corruption layer is justified by testability and by centralising
access rules, not by an invented portability requirement: only two files import
the client, yet eleven files still program against query-builder shapes.

The domain review also separated historical compatibility from stricter future
writes. Tightening `VisitSchema` on reads would apply a new constraint to
immutable stored content and could silently hide live patient links. Write-side
validation can improve without pretending old data can be repaired.

## 6. Decisions that are mine

I chose the approval flow because a mistake there survives the editing session:
once a quote is approved, its content is frozen and shared with the patient.
That made it more important to understand than the size of any individual file.
I selected the smaller `PickerOption` refactor because I could prove the
dependency had disappeared and enforce that boundary in CI. Sharing the approval
contract still matters, but I wanted a seam test before changing it.

I left read-side visit labels unchanged because stricter validation could hide
existing patient quotes that I could no longer edit. I would tighten future
writes separately. I also rejected database portability as the reason for an
anti-corruption layer: I had no concrete migration requirement. The useful
benefits were easier testing and one place to express access rules, which
addressed problems already visible in the code.

The complete historical analysis remains available in
[`context/architect-report.md`](https://github.com/wsternik/dentiplan/blob/main/context/architect-report.md).
