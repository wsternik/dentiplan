// The new-quote route is note-first: manual fields stay out of the way until
// the dentystka asks for them. Reopening a saved draft is the opposite — its
// existing data must be visible immediately rather than hidden behind the
// creation-only disclosure.

import { expect, test } from "@playwright/test";

import { waitForIslands } from "./support/app";

test("new quotes disclose manual fields on request while saved drafts reopen expanded", async ({ page }) => {
  const patientEmail = `e2e-disclosure-${Date.now()}@example.test`;

  await page.goto("/admin/quotes/new");
  await waitForIslands(page);

  const disclosure = page.getByRole("button", { name: "Dostosuj formularz ręcznie" });
  const patientTypeHeading = page.getByRole("heading", { name: "Typ pacjenta", includeHidden: true });

  await expect(disclosure).toHaveAttribute("aria-expanded", "false");
  await expect(patientTypeHeading).toHaveCount(1);
  await expect(patientTypeHeading).toBeHidden();

  await disclosure.click();
  await expect(page.getByRole("button", { name: "Ukryj formularz ręczny" })).toHaveAttribute("aria-expanded", "true");
  await expect(patientTypeHeading).toBeVisible();

  await page.getByLabel(/Tylko do Twojej referencji/).fill(patientEmail);
  await page.getByRole("button", { name: "Zapisz szkic" }).click();
  await expect(page.getByText(/^Zapisano /)).toBeVisible();

  await page.goto("/admin");
  await waitForIslands(page);
  const draftRow = page.getByRole("row").filter({ hasText: patientEmail });
  await expect(draftRow).toHaveCount(1);
  await draftRow.getByRole("link").click();
  await waitForIslands(page);

  await expect(page.getByRole("heading", { name: "Kosztorys (szkic)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Dostosuj formularz ręcznie" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Typ pacjenta" })).toBeVisible();

  await page.goto("/admin");
  await waitForIslands(page);
  const cleanupRow = page.getByRole("row").filter({ hasText: patientEmail });
  await cleanupRow.getByRole("button", { name: "Usuń" }).click();
  await cleanupRow.getByRole("button", { name: "Na pewno?" }).click();
  await expect(page.getByRole("row").filter({ hasText: patientEmail })).toHaveCount(0);
});
