// Risk #4 (`context/foundation/test-plan.md`): "Someone probing `/p/<token>`
// learns more than they should: the response distinguishes 'no such quote' from
// 'quote exists but is not yours', or tokens turn out to be guessable at scale."
//
// What would prove protection, per the risk map: an unknown token and a
// well-formed but non-existent token produce THE SAME generic page, with no
// field and no status code that separates the two. So this test probes with both
// shapes and asserts the two responses are byte-identical — any difference at
// all, echoed token included, is the leak.
//
// The named anti-pattern is "testing only the happy path with a valid token".
// The happy path is not repeated here: `patient-link-content.spec.ts` already
// proves a valid token renders the quote, so the generic page below is known not
// to be simply what this route always returns.
//
// Not asserted: the timing channel the risk also mentions. A browser test cannot
// measure it without flaking, and the test plan's first principle is the cheapest
// test that gives a real signal — timing belongs to a load-level check, not here.
//
// Modelled on `seed.spec.ts`. No fixtures, no data created, so nothing to clean
// up; the run is anonymous because a prober would have no session either.

import { test, expect } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("risk #4: a well-formed unknown token and a malformed one are answered identically, disclosing nothing", async ({
  page,
  context,
}) => {
  const stamp = Date.now();
  // Same shape as a real token (22 base64url chars), so the server cannot excuse
  // a different answer by the input being obviously invalid.
  const wellFormedUnknown = `Zt${stamp.toString(36)}Aq7Kd3Xr9Bn1Cw`.slice(0, 22);
  const malformed = `nie-ma-takiego-tokenu-${stamp}`;

  // A prober carries no session.
  expect(await context.cookies()).toHaveLength(0);

  const wellFormed = await page.goto(`/p/${wellFormedUnknown}`);
  const wellFormedStatus = wellFormed?.status();
  const wellFormedBody = (await wellFormed?.text()) ?? "";
  await expect(page.getByRole("heading", { name: "Link nieaktywny lub nieprawidłowy" })).toBeVisible();

  const garbage = await page.goto(`/p/${malformed}`);
  const garbageStatus = garbage?.status();
  const garbageBody = (await garbage?.text()) ?? "";
  await expect(page.getByRole("heading", { name: "Link nieaktywny lub nieprawidłowy" })).toBeVisible();

  // The two probes must be indistinguishable — same status, same bytes.
  expect(wellFormedStatus).toBe(404);
  expect(garbageStatus).toBe(wellFormedStatus);
  expect(garbageBody).toBe(wellFormedBody);

  // And neither answer may echo the probe back or name what went wrong.
  expect(wellFormedBody).not.toContain(wellFormedUnknown);
  expect(garbageBody).not.toContain(malformed);
  for (const body of [wellFormedBody, garbageBody]) {
    expect(body).not.toContain("patient_email");
    expect(body).not.toContain("quotes");
    expect(body).not.toContain("draft");
  }
});
