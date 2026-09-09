// The note-first route hides the manual form behind a disclosure, and the whole
// answer of "Wypełnij z notatki" lands inside it. So a prefill that leaves the
// disclosure closed finishes with nothing on screen having moved — the dentystka
// has no way to tell the model answered from the model failing silently.
//
// The parse endpoint is stubbed rather than called. What is under test is the
// editor's reaction to an answer, not the model's answer: routing it here keeps
// the spec off the provider (an LLM call per run, ~17 s of it) and lets the
// failure branch be exercised at all, which a live endpoint would only reach by
// breaking configuration on purpose. The stub is typed as `PrefillResult`, so
// the wire shape drifting away from it is a type error rather than a spec that
// keeps passing against a contract that no longer exists.

import { expect, test } from "@playwright/test";

import type { PrefillResult } from "@/lib/llm/schema";

import { waitForIslands } from "./support/app";

const PREFILL: PrefillResult = {
  content: {
    teeth: [
      {
        number: 16,
        treatmentType: "root-canal",
        urgency: "urgent",
        status: "in-plan",
        note: "",
        pricelistItems: [],
        visitNumber: 1,
      },
      {
        number: 34,
        treatmentType: "filling",
        urgency: "mild",
        status: "in-plan",
        note: "",
        pricelistItems: [],
        visitNumber: 1,
      },
    ],
    visits: [{ number: 1, label: "" }],
    generalItems: [],
  },
  warnings: ["Nie odczytano: „kamień do usunięcia”."],
};

const NOTE = "Do leczenia: 16. Kanałowe: 16. Ubytek: 34. Kamień do usunięcia.";

test("a successful prefill opens the form it filled", async ({ page }) => {
  await page.route("**/api/admin/quotes/parse", async (route) => {
    await route.fulfill({ json: PREFILL });
  });

  await page.goto("/admin/quotes/new");
  await waitForIslands(page);

  const disclosure = page.getByRole("button", { name: "Dostosuj formularz ręcznie" });
  await expect(disclosure).toHaveAttribute("aria-expanded", "false");

  await page.getByLabel(/Zapisywana razem z kosztorysem/).fill(NOTE);
  await page.getByRole("button", { name: "Wypełnij z notatki" }).click();

  // The disclosure is the same control, now naming the way back.
  await expect(page.getByRole("button", { name: "Ukryj formularz ręczny" })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("group", { name: /^16 — / })).toBeVisible();
  await expect(page.getByRole("group", { name: /^34 — / })).toBeVisible();
  await expect(page.getByRole("group", { name: "Do przejrzenia po wypełnieniu z notatki" })).toBeVisible();
});

test("a failed prefill leaves the form as it was", async ({ page }) => {
  await page.route("**/api/admin/quotes/parse", async (route) => {
    await route.fulfill({ status: 502, json: { error: "Model nie odpowiedział — wypełnij formularz ręcznie." } });
  });

  await page.goto("/admin/quotes/new");
  await waitForIslands(page);

  await page.getByLabel(/Zapisywana razem z kosztorysem/).fill(NOTE);
  await page.getByRole("button", { name: "Wypełnij z notatki" }).click();

  // FR-013: the prefill is never a gate. It says so and changes nothing —
  // including the disclosure, which has no result to reveal.
  await expect(page.getByText("Model nie odpowiedział — wypełnij formularz ręcznie.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Dostosuj formularz ręcznie" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});
