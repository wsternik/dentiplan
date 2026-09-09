// FR-013: the note prefill is never a gate. When it fails it says so and changes
// nothing — including the disclosure, which now opens on success and therefore
// has to stay closed here. There is no result to reveal, and an empty form
// opening under an error message would read as if something had been filled.
//
// The endpoint is stubbed through page.route for the same reason as in
// `quote-prefill-reveal.spec.ts`, plus one this branch owns: a live endpoint
// reaches its 502 only by breaking configuration on purpose. The body is the
// endpoint's own message (src/pages/api/admin/quotes/parse.ts), so a drift in
// that copy shows up here rather than passing against a fabricated string.

import { expect, test } from "@playwright/test";

import { waitForIslands } from "./support/app";

const NOTE = "Do leczenia: 16. Kanałowe: 16. Ubytek: 34. Kamień do usunięcia.";

test("a failed prefill leaves the form as it was", async ({ page }) => {
  await page.route("**/api/admin/quotes/parse", async (route) => {
    await route.fulfill({
      status: 502,
      json: { error: "Nie udało się przetworzyć notatki — wypełnij formularz ręcznie." },
    });
  });

  await page.goto("/admin/quotes/new");
  await waitForIslands(page);

  await page.getByLabel(/Zapisywana razem z kosztorysem/).fill(NOTE);
  await page.getByRole("button", { name: "Wypełnij z notatki" }).click();

  await expect(page.getByText("Nie udało się przetworzyć notatki — wypełnij formularz ręcznie.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Dostosuj formularz ręcznie" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  // The focus restore is one effect shared by both branches, and this is the
  // branch where losing it hurts more: nothing appeared, so a keyboard user
  // dropped on `<body>` has no landmark telling her where the attempt went.
  await expect(page.getByRole("button", { name: "Wypełnij z notatki" })).toBeFocused();
});
