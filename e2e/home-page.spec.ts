// The home page is a public, server-rendered composition. This contract protects
// the routes and landmarks that make it useful without turning decorative
// geometry into a snapshot API. The narrow case also guards the failure most
// likely to hide in the overlapping sample-plan illustration: document overflow.

import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 375, height: 812 },
] as const;

const PRACTICE_CTA_NAMES = ["Panel gabinetu", "Przejdź do gabinetu", "Otwórz panel gabinetu"] as const;

for (const viewport of VIEWPORTS) {
  test(
    "the public home keeps its navigation contract at " + String(viewport.width) + "px (" + viewport.name + ")",
    async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/");

      const title = page.getByRole("heading", { level: 1 });
      await expect(title).toHaveCount(1);
      await expect(title).toBeVisible();

      const howSection = page.getByRole("region", { name: "Ty znasz diagnozę. My pomagamy ją uporządkować." });
      const patientSection = page.getByRole("region", { name: "Dla pacjenta" });
      await expect(howSection).toHaveAttribute("id", "jak-to-dziala");
      await expect(patientSection).toHaveAttribute("id", "dla-pacjenta");

      await expect(page.getByRole("link", { name: "Jak to działa", exact: true, includeHidden: true })).toHaveAttribute(
        "href",
        "#jak-to-dziala",
      );
      await expect(page.getByRole("link", { name: "Dla pacjenta", exact: true, includeHidden: true })).toHaveAttribute(
        "href",
        "#dla-pacjenta",
      );
      await expect(page.getByRole("link", { name: "Zobacz przykładowy plan" })).toHaveAttribute(
        "href",
        "#dla-pacjenta",
      );

      for (const name of PRACTICE_CTA_NAMES) {
        await expect(page.getByRole("link", { name, exact: true })).toHaveAttribute("href", "/auth/signin");
      }

      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
        "the " + String(viewport.width) + "px layout must not overflow horizontally",
      ).toBe(true);
    },
  );
}
