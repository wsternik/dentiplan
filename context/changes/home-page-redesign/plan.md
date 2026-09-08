# A front page that says what DentiPlan is in one glance

> Executed by a fresh Claude Code session. Everything a designer and an
> implementer need is in this file; the rest of the repository's rules are in
> `AGENTS.md` and `context/foundation/lessons.md`. Read both first, every time.

## Goal

Replace `src/pages/index.astro` with a home page that a stranger understands in
one glance: DentiPlan turns a dentist's diagnosis note into a treatment plan with
two cost estimates that the patient opens from a link. The page is simple,
modern and minimal, set entirely in the product's existing visual system, and
offers exactly one action: **sign in**. There is no sign-up and must never be.

## Current state

`/` today (commit `9b56a73` on `main`) is the landing shipped by `ui-redesign`:

- Left column: a slate "DentiPlan" wordmark, a Literata headline _Dwa kosztorysy
  obok siebie, jeden link dla pacjenta._ with a hard `<br>`, two muted
  paragraphs, and a primary button _Zaloguj się_ linking to `/auth/signin`.
- Right column: a `<figure>` with two small variant tabs (Literata title,
  12px Archivo figures via `formatAmount`) and a caption that the numbers are
  invented.
- No header, no footer, no `<meta name="description">`. Rendered at 1280×800 it
  fits one screen; at 390px it stacks, tabs last.

What is wrong with it, judged from screenshots at 1280×800 and 390×844:

1. **It does not say who it is for.** The headline is a metaphor about
   estimates and links. "Dentist", "practice" and "patient page" only appear
   inside the second sentence of body copy, in slate. A first-time visitor has
   to read to find out this is a tool for a dental practice.
2. **The hero is not the hero.** The brief asked for the artifact as the hero.
   What shipped is a small pair of cards floating in the right half of the page,
   visually subordinate to a 48px headline. The composition is the generic
   "copy left, mockup right" template.
3. **The headline breaks badly.** The forced `<br>` after _siebie,_ leaves a
   one-word line on desktop. The wrap belongs to the browser, not to markup.
4. **The page ends mid-air.** No header row, no footer; the content block hangs
   centred in a `min-h-screen` grid. It looks like a placeholder for a page
   rather than a page.
5. **Everything is muted.** Both paragraphs are `text-muted-foreground`, so the
   sentence that actually explains the product is the least legible thing on the
   page.

What is right and is kept: tokens, both typefaces, the squared tab with a grip
edge as the mark of the recommended variant, `formatAmount` for every amount,
invented round numbers, the single sign-in link, and the `<p>`-not-heading rule
for the sample (the sample is an illustration; heading names on this route
belong to the patient-page contract).

Nothing in `e2e/` locates anything on `/`. The DOM of this page is free to
change. The DOM of `/auth/signin` is not, and this change does not touch it.

## Scope

### In scope

- `src/pages/index.astro` rewritten to the design below.
- A new `src/components/home/SampleQuote.astro` holding the note-to-document
  figure, so the page file stays readable.
- `<title>` and `<meta name="description">` for `/` through the layout's `head`
  slot.
- One anonymous E2E spec asserting the page's single-door contract.
- Screenshots at three viewports as the manual verification record.

### Out of scope

- `src/layouts/Layout.astro`, `src/styles/global.css`, `src/pages/auth/*`,
  `src/components/auth/*`, `src/middleware.ts`. Do not edit them. The layout
  carries two security invariants (see Hazards) and the sign-in page is an E2E
  contract.
- New dependencies, fonts, icons, images, illustrations, gradients, dark mode,
  animation, analytics, a second CTA, a sign-up path, a contact form, pricing,
  testimonials, a features grid, a footer navigation.
- Copy changes anywhere but `/`.

## Design

Worked out with the `frontend-design` skill against the product's design brief.
Everything below is a decision, not a menu. Where implementation must depart from
it, record why in `## Progress`.

### Who is looking

Three readers arrive at `/`, in this order of likelihood:

1. **The dentist**, on a laptop between patients, who wants the sign-in button
   and nothing else. She must find it in under a second, where convention puts
   it: top right.
2. **A stranger** who trimmed a `/p/<token>` link to its root, or was told the
   product exists: a patient, a colleague, a reviewer. They must understand what
   DentiPlan is and who uses it without scrolling or reading a paragraph, and
   understand why there is nothing for them to click except sign in.
3. **Nobody else.** There is no marketing funnel. The page does not sell; it
   states.

### The one memorable device

The product's real insight is that a messy, semi-structured note the dentist
already writes (`Do leczenia: 17,16,15 Kanałowe: 34,37,36, (32?) Kamień do
usunięcia`) becomes a clean document for the patient. So the hero shows exactly
that: **the note on the left, the patient page on the right.** Input and output,
side by side, in the product's own materials. No arrow between them; the
captions and the two different surfaces carry the relationship.

This is the only place the page spends any boldness. Everything else is quiet:
one headline, one paragraph, one button, one footer sentence.

### Palette

No new colours. The page uses six existing tokens and nothing else:

| Token                | Role on this page                                          |
| -------------------- | ---------------------------------------------------------- |
| `--background`       | the paper                                                  |
| `--secondary`        | the note panel: enamel one notch darker, "another system"  |
| `--card`             | the two variant tabs inside the document panel             |
| `--foreground`       | headline, lead paragraph, note text, figures               |
| `--muted-foreground` | panel names, sub-line, caption, footer                     |
| `--border`           | every rule; `--primary` only for the recommended grip edge |

Colour means something clinical and there is nothing clinical to say on this
page, so the only non-neutral pixel is the deep-ink grip edge on the recommended
tab. No urgency hues, no tooth chart, no badges.

### Type

- **Literata Variable** (`font-serif`): the headline and the document panel's
  title, tab names and tooth-group labels. Reading voice.
- **Archivo Variable** (`font-sans`, the body default): everything else,
  including every number (`numeric` utility for tabular figures).

| Element           | Face     | Size / line-height              | Weight  | Colour           |
| ----------------- | -------- | ------------------------------- | ------- | ---------------- |
| Wordmark          | Archivo  | 16 / 1                          | 600     | foreground       |
| Headline `h1`     | Literata | 31 / 1.15 mobile, 39 / 1.15 lg  | 500     | foreground       |
| Lead paragraph    | Archivo  | 16 / 1.6 mobile, 17 / 1.6 lg    | 400     | **foreground**   |
| Panel names       | Archivo  | 13 / 1.4                        | 500     | muted-foreground |
| Note text         | Archivo  | 15 / 1.6, `whitespace-pre-line` | 400     | foreground       |
| Document title    | Literata | 20 / 1.2                        | 500     | foreground       |
| Document sub-line | Archivo  | 12 / 1.4                        | 400     | muted-foreground |
| Tab name          | Literata | 14 / 1.3                        | 500     | foreground       |
| Tab rows, totals  | Archivo  | 12 / 1.5, `numeric`             | 400/600 | foreground       |
| Tooth-group rows  | Archivo  | 12 / 1.5, `numeric`             | 400     | foreground       |
| Figure caption    | Archivo  | 12 / 1.5                        | 400     | muted-foreground |
| Footer            | Archivo  | 12 / 1.5                        | 400     | muted-foreground |

Rules: headline wraps with `text-balance`, never with `<br>`; measure of the
headline ≤ 26ch, of the lead ≤ 60ch; sentence case everywhere; no tracked-out
capitals, no middle dots, no em-dash labels, no arrows, no monospace, no single
accented word in the headline.

### Layout

Left-aligned throughout, on the same `max-w-5xl` container the admin topbar
uses, `px-5` on mobile and `px-6` from `sm`. The page is a `min-h-screen`
flex column: header, growing `main`, footer.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ DentiPlan                                                     [ Zaloguj się ] │  header, hairline below
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ Notatka z konsultacji staje się planem                                       │  h1, Literata 39, ≤26ch
│ leczenia i kosztorysem dla pacjenta.                                         │
│                                                                              │
│ DentiPlan to narzędzie gabinetu stomatologicznego. Dentystka wkleja          │  lead, Archivo 17, ≤60ch, ink
│ notatkę z rozpoznania, sprawdza wypełniony formularz i zatwierdza.           │
│ Pacjent otwiera link i widzi to samo leczenie policzone na dwa               │
│ sposoby: rozłożone na wizyty albo w jednej sesji w narkozie.                 │
│                                                                              │
│ Notatka z rozpoznania              Strona pacjenta                           │  panel names, 13 slate
│ ┌───────────────────────┐          ┌──────────────────────────────────────┐  │
│ │ Do leczenia: 17,16,15 │          │ Twój kosztorys leczenia              │  │  2fr : 3fr, gap 6
│ │ Kanałowe: 34,37,36,   │          │ Plan dla osoby dorosłej              │  │
│ │ (32?)                 │          │ ┌─────────────────┬─▌───────────────┐│  │  note: bg-secondary
│ │ Kamień do usunięcia   │          │ │ Leczenie w kilku│▌Leczenie w      ││  │  document: hairline
│ │                       │          │ │ wizytach        │▌narkozie (jedna ││  │    border on paper,
│ │                       │          │ │ Wizyta 1 1200 zł│▌sesja)          ││  │    tabs porcelain
│ │                       │          │ │ Wizyta 2  800 zł│▌rekomendowane   ││  │
│ │                       │          │ │ Wizyta 3  400 zł│▌Leczenie 2400 zł││  │
│ │                       │          │ │ ─────────────── │▌Narkoza   900 zł││  │
│ │                       │          │ │ Razem   2400 zł │▌─────────────── ││  │
│ │                       │          │ │                 │▌Razem   3300 zł ││  │
│ │                       │          │ └─────────────────┴─────────────────┘│  │
│ │                       │          │ Zakres leczenia                      │  │
│ │                       │          │ Górne prawe            17, 16, 15    │  │
│ │                       │          │ Dolne lewe             34, 36, 37    │  │
│ │                       │          │ Do potwierdzenia       32            │  │
│ └───────────────────────┘          └──────────────────────────────────────┘  │
│ Przykład z wymyślonymi kwotami. Tak wygląda strona, którą otwiera pacjent.   │  caption, 12 slate
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ Z DentiPlanu korzysta gabinet. Pacjent nie potrzebuje konta, wystarczy link. │  footer, 12 slate, hairline above
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Header.** `<header>` with the wordmark as a plain `<span>` (the page is
  itself the root, so the wordmark is not a link) and one `<a href="/auth/signin">`
  styled with `buttonVariants()` from `@/components/ui/button` (default variant
  and size, imported into the frontmatter and merged through `cn()`). Hairline
  bottom border. Not sticky; the page does not scroll on a laptop.
- **Hero.** Headline then lead, `mt-12 lg:mt-16` below the header. Left-aligned;
  the headline and lead share a left edge with the figure below them.
- **Figure.** `<figure>` `mt-12`. Two panels in `grid gap-6 lg:grid-cols-[2fr_3fr]`,
  aligned to the top. Panel names sit above each panel as `<p>` (they are the
  only labels on the page and they name two different things, which is the one
  job a label has). One shared `<figcaption>` below.
  - Note panel: `bg-secondary rounded-md p-6`, no border. The note is a `<p>`
    with `whitespace-pre-line`, three lines, verbatim including the trailing
    comma and the `(32?)`: that mess is the point.
  - Document panel: `border border-border rounded-md p-6` on the paper itself,
    no fill. Inside, the real patient page in miniature and in its real order:
    title, sub-line, the two variant tabs (`grid gap-4 sm:grid-cols-2`; same
    grip-edge device as `VariantComparison.astro`, `border-l-[3px]
border-l-border/80` for the standard tab, `border-l-[6px] border-l-primary`
    for the recommended one), then a short "Zakres leczenia" `<dl>` of three
    rows. Titles and tab names are `<p>`, never `<h2>`/`<h3>`.
- **Footer.** `<footer>` with a hairline top border and one sentence. `mt-auto`
  so it sits at the bottom on tall viewports and simply follows the content on
  short ones.

Responsive:

- `≥1024px`: as drawn. **Fits 1280×800 without a vertical scrollbar** when
  Supabase is configured (the local red banner adds ~40px and does not count).
  If it does not fit, reduce vertical rhythm first (`mt-12` to `mt-10`, panel
  `p-6` to `p-5`), then drop the "Zakres leczenia" block. Do not shrink type.
- `640–1023px`: panels stack, note first; tabs stay side by side.
- `<640px` (390×844 is the check): everything stacks; tabs stack too,
  recommended second, each with its own total. Header keeps wordmark left and
  button right on one row. No horizontal scroll at 320px.

### Copy

Polish, sentence case, plain verbs. Final wording; do not paraphrase.

- `<title>`: `DentiPlan — kosztorys leczenia dla pacjenta` (unchanged).
- `<meta name="description">`: `DentiPlan zamienia notatkę dentysty z konsultacji
w plan leczenia z dwoma kosztorysami: w kilku wizytach albo w jednej sesji w
narkozie. Pacjent otwiera go jednym linkiem, bez konta.`
- Wordmark: `DentiPlan`
- Button (the one action): `Zaloguj się`
- Headline: `Notatka z konsultacji staje się planem leczenia i kosztorysem dla
pacjenta.`
- Lead: `DentiPlan to narzędzie gabinetu stomatologicznego. Dentystka wkleja
notatkę z rozpoznania, sprawdza wypełniony formularz i zatwierdza. Pacjent
otwiera link i widzi to samo leczenie policzone na dwa sposoby: rozłożone na
wizyty albo w jednej sesji w narkozie.`
- Panel names: `Notatka z rozpoznania` and `Strona pacjenta`
- Note text (three lines, verbatim):
  ```
  Do leczenia: 17,16,15
  Kanałowe: 34,37,36, (32?)
  Kamień do usunięcia
  ```
- Document title: `Twój kosztorys leczenia` (the real page's `h1` text)
- Document sub-line: `Plan dla osoby dorosłej`
- Tab names: `Leczenie w kilku wizytach` and `Leczenie w narkozie (jedna sesja)`;
  under the second, `rekomendowane przez gabinet`
- Tab rows: `Wizyta 1` / `Wizyta 2` / `Wizyta 3` / `Razem`; `Leczenie` /
  `Narkoza` / `Razem`
- Zakres leczenia rows: `Górne prawe` → `17, 16, 15`; `Dolne lewe` →
  `34, 36, 37`; `Do potwierdzenia` → `32`
- Caption: `Przykład z wymyślonymi kwotami. Tak wygląda strona, którą otwiera
pacjent.`
- Footer: `Z DentiPlanu korzysta gabinet. Pacjent nie potrzebuje konta, wystarczy
link.`

Amounts stay the current invented set and are rendered through `formatAmount`
from `@/lib/quote/format`, never typed by hand (Polish does not group four-digit
numbers; the helper knows that, a human once did not):

| Key             | Value          |
| --------------- | -------------- |
| visits          | 1200, 800, 400 |
| standardTotal   | 2400           |
| anesthesiaFee   | 900            |
| anesthesiaTotal | 3300           |

Tooth numbers in "Zakres leczenia" are plain numerals, sorted ascending within a
group, comma-separated with a space. They are not linked to `toothName()`;
names would not fit and are not needed for the point being made.

### What was rejected, and why

Checked against the generic default a model produces for "modern minimal SaaS
landing" so the freedom the brief leaves is not spent on a template:

- **Copy left, mockup right in two columns.** The current page, and the default.
  Replaced by a full-width figure beneath a short text block, so the artifact
  gets the width it needs to be legible and the page reads top to bottom like a
  document.
- **Three feature cards or a 01/02/03 process strip.** The process is a
  sequence, so numbering would be legitimate, but the note-to-document figure
  already shows the process. A second device explaining the same thing is
  decoration.
- **A centred hero.** Nothing in this product is centred; centred copy is what a
  landing page does and this page is trying not to be one.
- **A big number with a small label.** There is no metric worth that weight.
- **A tooth illustration, a phone frame, a gradient, a shadow under the panels.**
  The brief bans dental clip art; the page has no depth model, so no shadows;
  the tabs are a printed document, not a device.
- **Motion.** The brief allows one orchestrated moment in the whole application
  and gives it to the patient page. Nothing on `/` moves by itself.
- **The button twice (header and hero).** One action, one place, where the
  dentist's eye goes first. A second copy weakens both.
- **The wordmark as a link.** It would be the page's second link, pointing at
  the page itself.

## Hazards to build around

1. **`Layout.astro` is shared with the anonymous patient page and carries two
   invariants.** Nothing per-request may enter it (`patient-link-probe.spec.ts`
   asserts byte-identical error pages), and the banner filter
   `Astro.locals.user ? missingConfigs : publicMissingConfigs` must stay. This
   change does not edit the layout at all. The `<meta name="description">` goes
   through the existing `<slot name="head" />`.
2. **No `quotes` or `draft` as substrings in any stylesheet.** `global.css` is
   not edited here. If a `<style>` block is needed in `index.astro` or
   `SampleQuote.astro`, it is page-scoped and never ships on `/p/`; still, prefer
   utilities and avoid those words in class names anywhere.
3. **The sign-in page is an E2E contract** (`Email`, `Password`, `Sign in`,
   `lang="en"`, no sign-up link). Not touched.
4. **No self-service sign-up, on any level.** No page, no endpoint, no link, no
   copy that implies one. `e2e/auth-no-signup.spec.ts` guards the sign-in page;
   the new spec guards `/`.
5. **The sample must be an illustration.** No `<h2>`/`<h3>` (heading names on
   this route belong to the patient page), no real patient data, nothing derived
   from a session, every amount through `formatAmount`.
6. **`buttonVariants` in Astro frontmatter** is a pure `cva` call and needs no
   island. Do not turn the header into a React component.
7. **Do not add Playwright waits by time.** The new spec is anonymous and
   server-rendered; `toBeVisible()` and response status are all it needs.
8. **Node version.** `nvm use` (22.14.0) before interpreting a tooling failure.

## Workflow

Branch `feat/home-page-redesign` off `main` (`9b56a73` or later). One commit per
phase, `feat(home-page-redesign): <what> (pN)`, SHA stamped into `## Progress`
below. Before the PR: full `npm run test:e2e` green, an implementation review,
`gh pr create`. After merge: archive this folder to
`context/archive/2026-MM-DD-home-page-redesign/`.

Per-edit gates: `npx eslint --fix <file>` after every `.astro`/`.ts` edit,
`npx prettier --write <file>` after every `.md`. Commit runs `astro check`.

## Phase 1: The page

### Changes required

1. **`src/components/home/SampleQuote.astro`** (new). The figure: two named
   panels, the note and the document, plus the shared caption. Props: none; the
   sample data object lives in this file with the same explanatory header
   comment style the repository uses (why the numbers are invented, why they go
   through `formatAmount`, why titles are `<p>`). Markup and classes per the
   Layout and Type sections above.
2. **`src/pages/index.astro`** (rewrite). Header, hero, `<SampleQuote />`,
   footer, in a `min-h-screen flex flex-col` body. `<meta name="description">`
   via `<Fragment slot="head">`. `<title>` unchanged. Keep the file's opening
   comment: anonymous route, nothing from a session, sample is invented.
3. Delete nothing else; `formatAmount` import moves with the sample.

### Success criteria

#### Automated

- `npm run lint` exits 0; `npx astro check` reports 0 errors; `npm test` passes
  unchanged; `npm run build` completes.
- `grep -rn "auth/signup\|signup" src/pages/index.astro src/components/home/`
  returns nothing.
- `curl -s localhost:4321/ | grep -c 'href="/auth/signin"'` prints `1`.

#### Manual

Take the three screenshots with the script below and read them before moving on.
Critique against the Design section, then remove one thing if anything feels
added. This is the design pass; do it on the real render, not in the head.

- 1280×800: fits without vertical scroll (measure
  `document.documentElement.scrollHeight <= 800` with Supabase configured, or
  subtract the banner's height locally). Headline wraps to two lines with no
  orphan. Note and document panels top-aligned; document panel is the visually
  heaviest element on the page.
- 1440×900: same, with the footer resting at the bottom.
- 390×844: everything stacks in the order header, headline, lead, note,
  document (tabs stacked, recommended second), caption, footer. No horizontal
  scroll. Button reachable without scrolling.
- Keyboard: `Tab` from the address bar lands on `Zaloguj się` first (it is the
  only focusable element); the focus ring is visible against enamel.
- Contrast: the lead is full ink; only panel names, sub-line, caption and footer
  are slate.

Screenshot script (Playwright is a dev dependency; run from the repo root with
the dev server on 4321):

```js
// scripts/tmp-shots.mjs — do not commit
import { chromium } from "@playwright/test";
const browser = await chromium.launch();
for (const [name, width, height] of [
  ["desktop", 1280, 800],
  ["laptop", 1440, 900],
  ["mobile", 390, 844],
]) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto("http://localhost:4321/", { waitUntil: "networkidle" });
  console.log(name, await page.evaluate(() => document.documentElement.scrollHeight));
  await page.screenshot({ path: `/tmp/home-${name}.png`, fullPage: true });
}
await browser.close();
```

## Phase 2: The single-door test and the paper trail

### Changes required

1. **`e2e/home.spec.ts`** (new). Anonymous (`storageState` empty), no fixtures,
   nothing to clean up. Modelled on `e2e/auth-no-signup.spec.ts`; name opens
   with the risk it protects, per `context/foundation/test-plan.md` §6.3:
   `risk #6: the front page offers exactly one door, and it is the sign-in`.
   Assertions:
   - `GET /` responds 200 and `getByRole("heading", { level: 1 })` is visible.
   - `getByRole("link", { name: "Zaloguj się" })` has count 1 and
     `href="/auth/signin"`.
   - `getByRole("link", { name: /sign up|zarejestruj|załóż konto/i })` has count 0.
   - The served bytes contain neither `/auth/signup` nor `/api/auth/signup`.
   - Following the link lands on `/auth/signin` with the `Sign in` button visible
     (`waitForURL`, never a timeout).
2. **`context/foundation/test-plan.md`**: one line under risk #6 noting the new
   spec, and a Freshness Ledger entry.
3. **`## Progress`** below: SHAs, the three screenshot measurements, anything
   that departed from the Design section and why.

### Success criteria

#### Automated

- `npm run test:e2e` passes in full (after `pkill -f "astro dev"; rm -rf
node_modules/.vite`; warm `/`, `/auth/signin`, `/admin` with `curl` once if
  `auth.setup.ts` fails cold; a third red run is a bug).
- `git diff main...HEAD -- e2e/*.spec.ts` shows only the added file.

#### Manual

- The new spec fails if the `Zaloguj się` link is removed or duplicated (break
  it once on purpose, watch it go red, restore).

## Progress

| Phase | Commit    | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| p1    | `f085866` | Content height (wrapper measured with `min-height` released, so the `min-h-screen` floor does not mask it) 783px at both 1280×800 and 1440×900 — fits, footer at the bottom, no vertical scroll. 390×844: 1225px, `scrollWidth` 390 (no horizontal overflow); 320×800: 1365px, `scrollWidth` 320. `h1` two lines at ≥1024px, three at 390px, one rect, no orphan. One focusable element on the page; first `Tab` lands on `Zaloguj się`, ring visible on enamel. 900×900: panels stacked (tops 331 / 493), tabs side by side (both tops 601) — the 640–1023px band behaves as drawn. |
| p2    | `TBD`     | `e2e/home.spec.ts` green; fails as intended when the sign-in link is duplicated (count 2) and when it is removed (count 0), restored after both. Full `npm run test:e2e`: see below.                                                                                                                                                                                                                                                                                                                                                                                                 |

Departures from the Design section, with reasons:

- **The "Zakres leczenia" `<dl>` is not in the document panel.** With it, the
  page measured 991px at 1280×800 against an 800px budget. The Responsive
  section's own ladder is rhythm first, then this block, and both were needed:
  trimming rhythm (header `py-4`→`py-3`, `h1` `lg:mt-16`→`lg:mt-12`, figure
  `mt-12`→`mt-8`, panels `p-6`→`p-5`, `mt-5`→`mt-4`, caption `mt-4`→`mt-3`,
  `pb-16`→`pb-8`, footer `py-5`→`py-4`) reached 907px, and dropping the block
  reached 783px. It was independently the weakest thing on the render — three
  12px rows whose labels and numerals sat at opposite ends of ~500px of dead
  space — so the design pass's "remove one thing" and the height ladder pointed
  at the same element. Cost: the note's `(32?)` no longer has a visible
  counterpart in the document panel.
- **Panel heights: top-aligned, as specified — but only after trying the
  alternative.** Growing the note panel to the document's height (as the ASCII
  drawing shows it) was built and reverted: matched heights made the filled
  `--secondary` block compete with the outlined document, and "the document panel
  is the visually heaviest element" is a success criterion. Recorded in a comment
  in `SampleQuote.astro` so it is not re-tried blind.
- **Type sizes off the Tailwind scale** are written as rem arbitraries
  (`text-[1.9375rem]` = 31px, `text-[2.4375rem]` = 39px, `text-[1.0625rem]` =
  17px, `text-[0.9375rem]` = 15px, `text-[0.8125rem]` = 13px). The Type table
  gives sizes the default scale does not carry.
