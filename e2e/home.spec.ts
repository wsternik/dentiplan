// Risk #6 (`context/foundation/test-plan.md`): "An unauthenticated request
// reaches the admin panel, or the dentist — the single operator — is locked out
// of it."
//
// `auth-no-signup.spec.ts` guards the sign-in page's half of that risk. This
// spec guards the front page's half, and it exists because `/` is the surface
// where a door would be re-added by accident rather than on purpose: it is the
// only page in the product whose job is to explain itself to a stranger, so it
// is the page where "…and a link for new practices to sign up" reads like an
// improvement. It is not one. RLS grants every `authenticated` role full CRUD on
// `public.quotes`, so a second account is a second dentist.
//
// What is asserted is therefore a shape, not a screenshot: exactly one link, and
// exactly which one. Counting the sign-in link is what makes this fail when a
// second door is added; asserting only that a sign-in link exists would stay
// green next to a sign-up button.
//
// Nothing about the layout, the copy or the sample figure is asserted. Those are
// design decisions and this change expects to revisit them; a test that pins
// them would be a test that gets edited whenever the page is edited, which is
// how a contract stops meaning anything.
//
// Modelled on `auth-no-signup.spec.ts`. Anonymous, no fixtures, no data created,
// nothing to clean up.

import { test, expect } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("risk #6: the front page offers exactly one door, and it is the sign-in", async ({ page, context }) => {
  // A stranger who trimmed a `/p/<token>` link to its root carries no session.
  expect(await context.cookies()).toHaveLength(0);

  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const signIn = page.getByRole("link", { name: "Zaloguj się" });
  await expect(signIn).toHaveCount(1);
  await expect(signIn).toHaveAttribute("href", "/auth/signin");

  await expect(page.getByRole("link", { name: /sign up|zarejestruj|załóż konto/i })).toHaveCount(0);

  // Server-rendered bytes, not the tree: a route can also arrive as an island
  // prop or a form action, neither of which is a link the locator above sees.
  const body = (await response?.text()) ?? "";
  expect(body).not.toContain("/auth/signup");
  expect(body).not.toContain("/api/auth/signup");

  // The one action has to lead where it says it does — a page with a single door
  // is only a single door if that door opens.
  await signIn.click();
  await page.waitForURL("**/auth/signin");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});
