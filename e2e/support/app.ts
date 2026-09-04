import { expect, type Page } from "@playwright/test";

/**
 * Wait until every Astro island on the page has hydrated.
 *
 * This app is server-rendered with React islands (`client:load`), so the markup
 * an interaction can see arrives in two stages: the server's HTML, then React
 * taking it over. Acting in between looks like it works — a `<select>` accepts
 * the value — and is then silently undone when hydration re-renders the
 * controlled component from its initial state, so the click never reaches the
 * app's `onChange`.
 *
 * Astro's `<astro-island>` element drops its `ssr` attribute the moment it
 * hydrates, which makes "no island is still server-only" a concrete application
 * state to wait for — never a `waitForTimeout`.
 */
export async function waitForIslands(page: Page): Promise<void> {
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0);
}
