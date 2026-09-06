import { test, expect } from "@playwright/test";
import { waitForIslands } from "./support/app";

test("collapsed teeth retain edits and approval issues open and focus the right field", async ({ page }) => {
  await page.goto("/admin/quotes/new");
  await waitForIslands(page);
  await page.getByLabel("Dodaj zęby — numery FDI").fill("16, 15");
  await page.getByLabel("Dodaj zęby — numery FDI").press("Enter");
  await page.getByRole("combobox", { name: "Rodzaj leczenia — ząb 16" }).selectOption({ index: 1 });
  const treatment = await page.getByRole("combobox", { name: "Rodzaj leczenia — ząb 16" }).inputValue();
  await page.getByRole("button", { name: "Dodaj notatkę — ząb 16" }).click();
  await page.getByLabel("Notatka — ząb 16", { exact: true }).fill("Testowa notatka kontrolna");
  await page.getByRole("button", { name: "Zwiń wszystkie", exact: true }).click();
  await expect(page.getByLabel("Notatka — ząb 16", { exact: true })).toBeHidden();
  await page.getByRole("button", { name: "Ząb 16: dodaj pozycję z cennika." }).click();
  await expect(page.getByRole("button", { name: "Dodaj zabieg — ząb 16" })).toBeFocused();
  await expect(page.getByLabel("Notatka — ząb 16", { exact: true })).toHaveValue("Testowa notatka kontrolna");
  await expect(page.getByRole("combobox", { name: "Rodzaj leczenia — ząb 16" })).toHaveValue(treatment);
  await page.getByRole("button", { name: "Usuń ząb 16", exact: true }).click();
  await expect(page.getByRole("article", { name: "Ząb 15", exact: true }).getByRole("button").first()).toBeFocused();
});

test("saving an earlier snapshot does not mark subsequent edits as saved", async ({ page }) => {
  let releaseSave: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  const payloads: Record<string, unknown>[] = [];
  await page.route("**/api/admin/quotes", async (route) => {
    payloads.push(route.request().postDataJSON() as Record<string, unknown>);
    await gate;
    await route.fulfill({ json: { id: "test-snapshot" } });
  });
  await page.route("**/api/admin/quotes/test-snapshot", async (route) => {
    payloads.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({ json: { id: "test-snapshot" } });
  });
  await page.goto("/admin/quotes/new");
  await waitForIslands(page);
  await page.getByLabel("E-mail odbiorcy", { exact: true }).fill("first@example.test");
  await page.getByLabel("Notatka z diagnozy", { exact: true }).fill("Transient private test note");
  await page.getByRole("button", { name: "Zapisz szkic" }).click();
  await expect(page.getByRole("status")).toHaveText("Zapisywanie…");
  await page.getByLabel("E-mail odbiorcy", { exact: true }).fill("later@example.test");
  releaseSave?.();
  await expect(page.getByRole("status")).toHaveText("Zmiany niezapisane");
  expect(payloads[0].patient_email).toBe("first@example.test");
  expect(JSON.stringify(payloads[0])).not.toContain("Transient private test note");
  await page.getByRole("button", { name: "Zapisz szkic" }).click();
  await expect(page.getByRole("status")).toHaveText(/^Zapisano o /);
  expect(payloads[1].patient_email).toBe("later@example.test");
  await page.getByLabel("Notatka z diagnozy", { exact: true }).fill("Changed transient note");
  await expect(page.getByRole("status")).toHaveText(/^Zapisano o /);
});
