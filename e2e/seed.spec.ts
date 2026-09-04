// Seed test — the exemplar every generated E2E test in this project is modelled
// on. It is deliberately the smallest full cycle that still demonstrates all
// four conventions this suite is governed by:
//
//   1. role-based locators (`getByRole` / `getByLabel`), never CSS or XPath
//   2. one self-contained test: setup, action, assertion, cleanup
//   3. waiting for application state, never for a duration
//   4. a name that binds the test to a risk in `context/foundation/test-plan.md`
//
// Risk: #6 — "an unauthenticated request reaches the admin panel, or the
// dentystka — the single operator — is locked out of it". This covers the
// second half: with a valid session she can create a quote, see it in her list,
// and remove it again. The first half (no session → no admin) is integration
// work in rollout phase 4, not a browser test.

import { test, expect } from "@playwright/test";

import { waitForIslands } from "./support/app";

test("risk #6: the dentystka is not locked out — a draft round-trips through her quote list", async ({ page }) => {
  // Unique per run, so parallel workers and repeated runs never collide and the
  // row this test asserts on is unambiguously its own.
  const patientEmail = `e2e-seed-${Date.now()}@example.test`;

  await page.goto("/admin");
  await page.getByRole("link", { name: "Nowy kosztorys" }).click();
  await page.waitForURL("**/admin/quotes/new");
  // The editor is a React island; typing into it before it hydrates is silently
  // thrown away when React takes over.
  await waitForIslands(page);

  await page.getByLabel(/Tylko do Twojej referencji/).fill(patientEmail);

  // The option's visible label carries its price ("Lakierowanie (200 zł)"),
  // which is pricelist data rather than behaviour — find the option by name and
  // select it by value, so a price change never breaks this test.
  const generalPicker = page.getByRole("combobox", { name: "Dodaj pozycję ogólną…" });
  const varnishValue = await generalPicker.getByRole("option", { name: /^Lakierowanie/ }).getAttribute("value");
  await generalPicker.selectOption(varnishValue ?? "");
  await expect(page.getByText(/^Lakierowanie · /)).toBeVisible();

  await page.getByRole("button", { name: "Zapisz szkic" }).click();

  // The save is confirmed by the editor's own state, not by a timeout.
  await expect(page.getByText(/^Zapisano /)).toBeVisible();

  await page.goto("/admin");
  await waitForIslands(page);
  const row = page.getByRole("row").filter({ hasText: patientEmail });
  await expect(row).toHaveCount(1);
  await expect(row.getByText("Szkic")).toBeVisible();

  // Cleanup — the delete control arms on the first click and fires on the
  // second, and the page reloads itself once the row is gone.
  await row.getByRole("button", { name: "Usuń" }).click();
  await row.getByRole("button", { name: "Na pewno?" }).click();
  await expect(page.getByRole("row").filter({ hasText: patientEmail })).toHaveCount(0);
});
