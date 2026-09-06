# Third-party notices

This repository contains code copied from third-party projects. Each entry below
names what was copied, from where, and under which licence.

Nothing here is an npm dependency; dependencies carry their own licences in
`node_modules` and are not restated in this file.

---

## react-odontogram

- **Package:** `react-odontogram`
- **Version:** 0.5.6
- **Commit:** `81b48eb` (`chore(release): v0.5.6`, 30 April 2026)
- **Author:** Pratik Sharma ([biomathcode](https://github.com/biomathcode))
- **Repository:** https://github.com/biomathcode/react-odontogram
- **Licence:** MIT

### What was copied, and into which file

Everything copied lives in a single file, `src/lib/tooth-chart/paths.ts`, which
contains no logic:

- the eight `outlinePath` strings and their `type` names from `teethPaths` in
  `src/data.ts` (the arch set; `NewTeethPaths` was not copied);
- the four transform strings from `oldquadrants` in `src/utils.ts`;
- the viewBox `"0 0 409 694"` returned by `getViewBox("circle", "full")` in
  `src/Odontogram.tsx`.

Not copied: the React components, the stylesheet, the theme and its CSS custom
properties, the Storybook stories, the `label` field on each tooth, and the
`shadowPath` / `lineHighlightPath` geometry. The FDI numbering, the drawing
logic, the accessibility semantics and the styling in this repository are our
own work and are not derived from the upstream source.

### A note on the licence text below

**The upstream repository ships no `LICENSE` file.** MIT is declared in its
`package.json` (`"license": "MIT"`, line 6) and in `README.md` line 323
("MIT © biomathcode"), and nowhere else. The text reproduced below is therefore
the canonical MIT template with the upstream copyright holder filled in — it is
not a verbatim quotation of a file that exists upstream. It is included so that
the notice MIT requires travels with the copied code.

### MIT License

Copyright (c) biomathcode (Pratik Sharma)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
