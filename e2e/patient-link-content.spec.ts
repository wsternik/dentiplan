// Risk #3 (`context/foundation/test-plan.md`): "The patient page shows something
// the patient must never see — the e-mail the dentystka stored for her own
// reference, or the raw diagnosis text she pasted in."
//
// What would prove protection, per the risk map: for a given approved quote, the
// BYTES SERVED at `/p/<token>` carry no e-mail address and no raw diagnosis text,
// whatever the dentystka typed into the form. The named anti-pattern is asserting
// on the rendered component tree instead of the response the browser receives —
// so the leak assertions here run against `response.text()`, not the DOM.
//
// Why this is a browser test and not an integration one: the risk is about what
// survives the whole journey — a session, the editor island, the private
// diagnosis-note column, the approval freeze, and finally an anonymous token
// route. No endpoint-level test can reproduce that complete boundary.
//
// Isolation: approving freezes a row that FR-053 makes immutable, so this test
// cannot delete what it creates — no cleanup is possible through the app. Every
// run therefore tags its data with a unique stamp instead, and asserts only on
// its own quote.
//
// Modelled on `seed.spec.ts`.

import { test, expect } from "@playwright/test";

import { patientUrlFromQr, waitForIslands } from "./support/app";

test("risk #3: an approved quote's patient page serves the quote and neither the recipient e-mail nor the diagnosis note", async ({
  page,
  browser,
}) => {
  const stamp = Date.now();
  const patientEmail = `e2e-risk3-${stamp}@example.test`;
  // Two secrets the dentystka types in and the patient must never receive.
  const diagnosisNote = `ROZPOZNANIE-POUFNE-${stamp}: ognisko okołowierzchołkowe, pacjentka w trakcie leczenia onkologicznego`;

  // --- The dentystka builds a quote from her own notes ---
  await page.goto("/admin/quotes/new");
  await waitForIslands(page);
  await page.getByRole("button", { name: "Dostosuj formularz ręcznie" }).click();

  await page.getByLabel(/Tylko do Twojej referencji/).fill(patientEmail);
  await page.getByLabel(/Pole robocze/).fill(diagnosisNote);

  await page.getByRole("textbox", { name: "Numery FDI, np. 17,16,34" }).fill("16");
  await page.getByRole("button", { name: "Dodaj", exact: true }).click();
  await expect(page.getByText("16 — pierwszy trzonowiec prawy górny")).toBeVisible();

  // The option's visible label carries its price, which is pricelist data rather
  // than behaviour — match the option by name and select it by value.
  const toothPicker = page.getByRole("combobox", { name: "Dodaj pozycję z cennika…" });
  const treatmentValue = await toothPicker
    .getByRole("option", { name: /^Leczenie kanałowe trzonowca/ })
    .getAttribute("value");
  await toothPicker.selectOption(treatmentValue ?? "");
  await expect(page.getByText(/^Leczenie kanałowe trzonowca · /)).toBeVisible();

  // --- She approves it, which freezes the quote and mints the patient link ---
  await page.getByRole("button", { name: "Zatwierdź" }).click();
  await expect(page.getByRole("heading", { name: "Kosztorys zatwierdzony" })).toBeVisible();

  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Kopiuj link" })).toBeVisible();
  const patientUrl = await patientUrlFromQr(page);

  // The e-mail really was stored: without this, "it is absent from the patient
  // page" would also hold for a quote that never carried one, and the assertion
  // below would protect nothing.
  await page.goto("/admin");
  await waitForIslands(page);
  await expect(page.getByRole("row").filter({ hasText: patientEmail })).toHaveCount(1);

  // --- The patient opens the link in a browser that has never signed in ---
  const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  try {
    const anonymousPage = await anonymous.newPage();
    const response = await anonymousPage.goto(patientUrl);

    // "Without a session" is asserted, not assumed.
    expect(await anonymous.cookies()).toHaveLength(0);
    expect(response?.status()).toBe(200);

    // The risk, on the bytes the browser actually received.
    const body = (await response?.text()) ?? "";
    expect(body).not.toContain(patientEmail);
    expect(body).not.toContain(diagnosisNote);
    expect(body).not.toContain(`ROZPOZNANIE-POUFNE-${stamp}`);

    // And the page is genuinely the quote — otherwise the absence above would be
    // satisfied by an error page, which proves nothing (FR-064, FR-065).
    await expect(anonymousPage.getByRole("heading", { name: "Twój kosztorys leczenia" })).toBeVisible();
    await expect(anonymousPage.getByRole("heading", { name: "Leczenie w kilku wizytach" })).toBeVisible();
    await expect(anonymousPage.getByRole("heading", { name: "Leczenie w narkozie (jedna sesja)" })).toBeVisible();
    await expect(anonymousPage.getByRole("note", { name: "Zastrzeżenie" })).toContainText(
      "To jest kosztorys szacunkowy",
    );
  } finally {
    await anonymous.close();
  }
});
