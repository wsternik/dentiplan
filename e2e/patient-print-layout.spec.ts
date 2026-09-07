// Risk #12 (`context/foundation/test-plan.md`): "The printed estimate loses the
// comparison — the patient prints the page to show whoever is paying, and the
// two variants come out stacked instead of side by side, or the deferred teeth
// come out looking exactly like the ones in the plan."
//
// Why this test exists rather than a note in a document: it already happened.
// The redesign shipped `md:grid-cols-2` (768px) while A4 at default margins is
// about 717px of printable width, so on paper the two variants stacked — and
// the check that was supposed to prove otherwise was a screenshot taken with
// print media emulated at a 1280px viewport, where the breakpoint still
// applied. Emulating the medium changes which CSS applies; it does not change
// the width the breakpoint is measured against. This test measures at the
// width a printer actually has, which is the only way the bug is visible.
//
// The named anti-pattern for this row is asserting on the print stylesheet
// instead of on the laid-out page: a test that checks the CSS rule exists would
// have passed both before and after the fix, because the rule that was missing
// was the one nobody had written.
//
// Isolation: approving freezes a row FR-053 makes immutable, so this test
// cannot delete what it creates — same constraint as the other patient specs.
// Every run tags its data with a unique stamp and asserts only on its own quote.
//
// Modelled on `seed.spec.ts` and `patient-link-content.spec.ts`.

import { test, expect } from "@playwright/test";

import { patientUrlFromQr, waitForIslands } from "./support/app";

/**
 * A4 at a browser's default margins, in CSS pixels. Letter is slightly wider
 * (~739px), so proving it at A4 proves it for both.
 */
const A4_PRINTABLE_WIDTH = 717;

test("risk #12: the printed estimate keeps the two treatment variants side by side at paper width", async ({
  page,
  browser,
}) => {
  const stamp = Date.now();

  // --- The dentystka produces a quote with both variants priced ---
  await page.goto("/admin/quotes/new");
  await waitForIslands(page);

  await page.getByLabel(/Tylko do Twojej referencji/).fill(`e2e-risk12-${stamp}@example.test`);
  await page.getByRole("textbox", { name: "Numery FDI, np. 17,16,34" }).fill("16");
  await page.getByRole("button", { name: "Dodaj", exact: true }).click();
  await expect(page.getByText("16 — pierwszy trzonowiec prawy górny")).toBeVisible();

  const picker = page.getByRole("combobox", { name: "Dodaj pozycję z cennika…" });
  const treatment = await picker.getByRole("option", { name: /^Leczenie kanałowe trzonowca/ }).getAttribute("value");
  // Fail here, not two assertions later: without this, a renamed pricelist entry
  // selects the empty option and the test dies on a print-geometry assertion
  // that has nothing to do with the actual problem.
  expect(treatment, "the pricelist must still offer a molar root canal").toBeTruthy();
  await picker.selectOption(treatment ?? "");
  await expect(page.getByText(/^Leczenie kanałowe trzonowca · /)).toBeVisible();

  await page.getByRole("button", { name: "Zatwierdź" }).click();
  await expect(page.getByRole("heading", { name: "Kosztorys zatwierdzony" })).toBeVisible();
  const patientUrl = await patientUrlFromQr(page);

  // --- The patient prints it ---
  const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  try {
    const printed = await anonymous.newPage();
    // Both halves matter. Print media alone still lays out at the screen's
    // width; the paper's width alone still applies the screen stylesheet.
    await printed.emulateMedia({ media: "print" });
    await printed.setViewportSize({ width: A4_PRINTABLE_WIDTH, height: 1000 });
    await printed.goto(patientUrl);

    const standard = printed.getByRole("heading", { name: "Leczenie w kilku wizytach" });
    const anesthesia = printed.getByRole("heading", { name: "Leczenie w narkozie (jedna sesja)" });
    await expect(standard).toBeVisible();
    await expect(anesthesia).toBeVisible();

    // Side by side means the two variants start on the same line. Stacked means
    // the second one begins below the first — which is exactly what shipped.
    const standardBox = await standard.boundingBox();
    const anesthesiaBox = await anesthesia.boundingBox();
    expect(standardBox, "the standard variant must be laid out on the printed page").not.toBeNull();
    expect(anesthesiaBox, "the anaesthesia variant must be laid out on the printed page").not.toBeNull();
    expect(
      Math.abs((standardBox?.y ?? 0) - (anesthesiaBox?.y ?? 0)),
      "the two variants must share a top edge on paper, not stack",
    ).toBeLessThan(5);

    // And they must genuinely be beside each other rather than sharing a line
    // because one of them collapsed to nothing.
    expect((anesthesiaBox?.x ?? 0) - (standardBox?.x ?? 0)).toBeGreaterThan(100);
  } finally {
    await anonymous.close();
  }
});
