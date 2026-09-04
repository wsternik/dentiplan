import { test as setup, expect } from "@playwright/test";

// One real sign-in per run; every other spec starts already authenticated from
// the stored state (E2E rule: authenticate without going through the UI). The
// credentials belong to the dentystka's test account and live in `.env`, which
// is gitignored — CI never runs this suite, so no secret is needed there.
const authFile = "playwright/.auth/dentist.json";

setup("authenticate as the dentystka", async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  expect(email, "E2E_EMAIL must be set in .env").toBeTruthy();
  expect(password, "E2E_PASSWORD must be set in .env").toBeTruthy();

  await page.goto("/auth/signin");
  await page.getByRole("textbox", { name: "Email" }).fill(email ?? "");
  // `getByLabel("Password")` would also match the "Show password" toggle button.
  await page.getByRole("textbox", { name: "Password" }).fill(password ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();

  // Signing in lands on the quote list (`/api/auth/signin` redirects there);
  // waiting for that state, not for a duration, is what proves the session took.
  await page.waitForURL("**/admin");
  await expect(page.getByRole("heading", { name: "Kosztorysy" })).toBeVisible();

  await page.context().storageState({ path: authFile });
});
