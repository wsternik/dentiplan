// Risk #6 (`context/foundation/test-plan.md`): "An unauthenticated request
// reaches the admin panel, or the dentist — the single operator — is locked out
// of it."
//
// This spec guards the half of that risk this change closed. The panel is
// protected by `middleware.ts` asking whether a session exists, not whose it is,
// which is the right check under the single-operator model the RLS migration
// writes down ("exactly one dentystka, no per-user ownership column") — and the
// wrong one the moment a stranger can mint a session for himself. Until
// 2026-09-06 he could: the sign-in page linked to `/auth/signup`, and behind it
// sat `POST /api/auth/signup`.
//
// So what is asserted here is an absence, on three levels, because removing only
// the link would leave the endpoint answering: no page, no endpoint, and nothing
// on the sign-in page pointing at either. The named anti-pattern for this risk is
// "checking only that a redirect happens, without confirming the protected
// handler did not run" — the equivalent here is checking only the link, so the
// endpoint is probed directly, the way anyone bypassing the UI would.
//
// Not asserted: that the hosted Supabase project also refuses `auth/v1/signup`.
// It does, and that is the half that actually closes the hole — but proving it
// means a live call to a third-party API from the suite, which §7 of the test
// plan rules out. It is verified out-of-band instead, in this change's
// `verification.md`.
//
// Modelled on `patient-link-probe.spec.ts`. Anonymous, no fixtures, no data
// created, nothing to clean up.

import { test, expect } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("risk #6: there is no self-service way in — no sign-up page, no sign-up endpoint, no link to one", async ({
  page,
  context,
  request,
}) => {
  expect(await context.cookies()).toHaveLength(0);

  for (const path of ["/auth/signup", "/auth/confirm-email"]) {
    const response = await page.goto(path);
    expect(response?.status(), `${path} is still served`).toBe(404);
  }

  // Bypassing the UI is the whole point of the check: a removed link with a live
  // handler behind it is not a removed feature.
  const posted = await request.post("/api/auth/signup", {
    failOnStatusCode: false,
    data: { email: `e2e-signup-probe-${Date.now()}@example.test`, password: "Nie-ma-takiej-drogi-1" },
  });
  expect(posted.status(), "POST /api/auth/signup is still handled").toBe(404);

  const signin = await page.goto("/auth/signin");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("link", { name: /sign up/i })).toHaveCount(0);
  // Server-rendered bytes, not the tree: a link can also arrive as an island prop.
  expect((await signin?.text()) ?? "").not.toContain("/auth/signup");
});
