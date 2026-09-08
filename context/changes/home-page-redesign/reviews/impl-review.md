# Implementation review — home-page-redesign

One round, against `plan.md` (Design, Hazards, Success criteria) and `AGENTS.md`.
Reviewed at `beb3e6c`; commits `f085866` (p1) and `beb3e6c` (p2).

## Scope check

`git diff main...HEAD --stat` touches six files: the change folder, `test-plan.md`,
`e2e/home.spec.ts`, `src/components/home/SampleQuote.astro`, `src/pages/index.astro`.
None of the Out-of-scope files are in it — `Layout.astro`, `global.css`,
`src/pages/auth/*`, `src/components/auth/*` and `middleware.ts` are untouched, so
both layout invariants (byte-identical error pages; the banner filter) are
structurally safe, and `patient-link-probe.spec.ts` passing confirms it rather
than assuming it.

`git diff main...HEAD -- 'e2e/*.spec.ts'` adds one file and edits none — the
"never edit an existing spec to make it pass" rule holds.

## Findings

### F1 — `test-plan.md` reflows the whole risk table (accepted)

The added clause in row #6 widened the last column, so Prettier re-padded all
eleven rows. The diff is 25 lines for one sentence of content. Nothing but
whitespace changed in the other rows, and Prettier on staged Markdown is a
committed gate, so this is the repository's own formatting, not drift.

### F2 — Importing `buttonVariants` from `button.tsx` pulls React into the module graph of `/` (accepted)

`src/components/ui/button.tsx` imports `react` and `@radix-ui/react-slot` at the
top level, so rendering `/` now evaluates them server-side even though the page
ships no island. Considered and kept: the Cloudflare adapter emits one worker
bundle, and `/admin` and `/p/<token>` already put React in it, so there is no
extra cold-start cost — only a graph edge. The alternative (hand-copying the
button's class string onto an `<a>`) is exactly the drift the plan's
"`buttonVariants` in Astro frontmatter" instruction exists to prevent, and would
silently diverge the front page's one action from every other button in the app.

### F3 — The footer sits at the bottom via `grow` on `<main>`, not `mt-auto` on `<footer>` (accepted)

The plan's Layout section names both mechanisms ("a growing `main`" in the prose,
`mt-auto` in the footer bullet). They are equivalent inside a
`min-h-screen flex flex-col` column; using both would be a redundant class.
Verified at 1440×900: the footer rests at the bottom with the content at 783px.

### F4 — The `<figure>`'s caption is announced before its contents despite being last in the DOM (verified, no change)

Worth checking rather than assuming, because the caption is what tells a reader
the amounts are invented and it is the last thing on screen. `<figcaption>`
supplies the accessible name of `<figure>` (HTML-AAM), so assistive technology
announces "Przykład z wymyślonymi kwotami…" on entering the figure, not after the
numbers. No DOM reorder needed, and none was made — reordering for visual effect
would have been the worse fix.

### F5 — `<meta name="description">` is 216 characters (accepted)

Longer than the ~160 characters a search result typically shows, so it will be
truncated. The copy is fixed by the plan's Copy section ("Final wording; do not
paraphrase") and the first sentence carries the meaning on its own. Not changed
unilaterally; noted for whoever revisits the copy.

### F6 — No heading below `h1` anywhere on the page (intended, re-confirmed)

The document panel's title, tab names and sub-line are all `<p>`. This is Hazard
#5 and it is what makes the sample an illustration rather than a second patient
page: heading names on this route belong to `/p/<token>`, and a reader navigating
`/` by headings must not find an outline describing somebody's treatment. The
spec asserts `heading, level 1` is visible, which would also catch the page
losing its `h1` entirely.

### F7 — Hazard #2 (`quotes` / `draft` as substrings) (verified)

Neither file carries a `<style>` block, and no class name contains either word.
`SampleQuote.astro` is a filename, not a class, and Astro injects a component
path only for scoped styles. Confirmed empirically rather than by reading:
`patient-link-probe.spec.ts`, which asserts the served `/p/` bytes contain
neither string, passes in the full run.

## Rejected

- **Adding `aria-labelledby` tying each panel name to its panel.** The two `<p>`
  names are adjacent to the panels they name and the figure has its own
  accessible name. Adding ARIA to a decorative illustration buys nothing and
  starts a pattern the patient page would then be expected to follow.
- **Restoring the "Zakres leczenia" block at a smaller size.** The plan forbids
  shrinking type to make the page fit, and the block was dropped for two
  independent reasons (see `plan.md` Departures), only one of which was height.
- **Pinning copy, layout or the sample's amounts in `e2e/home.spec.ts`.** The
  page expects to be revisited; a spec that fails on a reworded headline is a
  spec that gets edited, which is how a contract stops meaning anything. The spec
  asserts the single-door shape and nothing else.

## Verification actually run

| Gate                                                           | Result                                                             |
| -------------------------------------------------------------- | ------------------------------------------------------------------ |
| `npm run lint`                                                 | exit 0                                                             |
| `npx astro check`                                              | 0 errors, 0 warnings (4 pre-existing hints in `eslint.config.js`)  |
| `npm test`                                                     | 128 passed / 14 files                                              |
| `npm run build`                                                | complete                                                           |
| `grep -rn "signup" src/pages/index.astro src/components/home/` | no match                                                           |
| `curl -s localhost:4321/ \| grep -c 'href="/auth/signin"'`     | `1`                                                                |
| `npm run test:e2e` (after `pkill`/`rm -rf node_modules/.vite`) | 10 passed, first run                                               |
| Negative test of the new spec                                  | red on a duplicated link (count 2) and on a removed link (count 0) |
| Viewports 1280×800 / 1440×900 / 390×844 / 320×800 / 900×900    | measurements in `plan.md` `## Progress`                            |

Node 22.14.0 (`.nvmrc`) throughout.
