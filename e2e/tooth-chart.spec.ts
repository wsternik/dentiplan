// Risk #8 (`context/foundation/test-plan.md`): "The drawing and the written list
// on the patient page describe two different mouths — a tooth marked on the chart
// that no list names, or one the chart colours as urgent while the list prints
// 'łagodne'."
//
// What would prove protection, per the risk map: every tooth the chart marks is
// named by one of the page's lists under the status the chart draws for it, and
// every tooth those lists name is marked on the chart — nothing in one and not
// the other — with the urgency hue matching the one the list prints beside the
// same tooth. The named anti-pattern is asserting that the chart draws 32 teeth:
// a count passes whether or not a single mark agrees with the list.
//
// Why this is a browser test and not a unit one: `toChartTeeth` and the patient
// page's three section filters are each pure and each already unit-tested. What
// no unit test can hold is that the two mappings, run side by side on one frozen
// quote, come out saying the same thing — and half of what the chart says (the
// urgency hue) exists only once a browser has resolved the stylesheet.
//
// Isolation: approving freezes a row that FR-053 makes immutable, so this test
// cannot delete what it creates — no cleanup is possible through the app. It
// follows the precedent of `patient-link-content.spec.ts`: tag the run with a
// unique stamp and assert only on its own quote.
//
// Modelled on `seed.spec.ts`.

import { test, expect, type Locator, type Page } from "@playwright/test";

import { waitForIslands } from "./support/app";

/**
 * The patient page's heading for each tooth list, and the status the chart must
 * be drawing for every tooth listed under it. This mapping is the agreement
 * under test: it is the one place where "which section" and "which status" meet,
 * and it is stated here rather than read from the app so the app cannot define
 * its own correctness.
 */
const SECTION_STATUS = new Map([
  ["Zakres leczenia", "w planie"],
  ["Odroczone", "poza bieżącym planem"],
  ["Scenariusze, które mogą zmienić koszt", "niepewne"],
]);

const STATUS_LABELS = [...SECTION_STATUS.values()];

/**
 * The mouth this run puts into the quote: four teeth, one per quadrant, spanning
 * all three statuses and two different urgencies. One status or one urgency would
 * make a drawing that mirrors the list by accident rather than by agreement.
 */
const PLANNED = [
  {
    number: "16",
    name: "16 — pierwszy trzonowiec prawy górny",
    treatment: "leczenie kanałowe",
    urgency: "pilne",
    status: "w planie",
    item: /^Leczenie kanałowe trzonowca/,
  },
  {
    number: "24",
    name: "24 — pierwszy przedtrzonowiec lewy górny",
    treatment: "ekstrakcja",
    urgency: "umiarkowane",
    status: "poza bieżącym planem",
    item: null,
  },
  {
    number: "36",
    name: "36 — pierwszy trzonowiec lewy dolny",
    treatment: "wypełnienie",
    urgency: "łagodne",
    status: "w planie",
    item: /^Wypełnienie małe\/duże/,
  },
  {
    number: "47",
    name: "47 — drugi trzonowiec prawy dolny",
    treatment: "usunięcie próchnicy",
    urgency: "umiarkowane",
    status: "niepewne",
    item: null,
  },
];

/** `<FDI> · <status>` for every tooth of the mouth above — what both surfaces must say. */
const EXPECTED = PLANNED.map((tooth) => `${tooth.number} · ${tooth.status}`).sort();

function chart(page: Page): Locator {
  return page.getByRole("group", { name: "Schemat uzębienia z zaznaczonym zakresem leczenia" });
}

/**
 * Every tooth of the drawing, whichever surface it is on. The same tooth is a
 * `button` in the editor, where a click acts on it, and an `img` on the patient
 * page, where nothing will happen — one drawing, two roles, and the agreement
 * this test is about is a property of the drawing rather than of either mode.
 */
function teethOnChart(page: Page): Locator {
  return chart(page).getByRole("img").or(chart(page).getByRole("button"));
}

/**
 * What the drawing says, as `<FDI> · <status>` for every tooth it marks.
 *
 * A tooth the quote does not hold is labelled "… — nieobjęty planem" and carries
 * no status, so it drops out here: the chart draws the whole mouth, and only the
 * marked part of it is what the lists can be compared against.
 */
async function markedOnChart(page: Page): Promise<string[]> {
  const labels = await teethOnChart(page).evaluateAll((teeth) =>
    teeth.map((tooth) => tooth.getAttribute("aria-label") ?? ""),
  );

  return labels
    .map((label) => {
      const number = /^(\d{2}) /.exec(label)?.[1];
      const status = label.split(", ").find((part) => STATUS_LABELS.includes(part));
      return number !== undefined && status !== undefined ? `${number} · ${status}` : null;
    })
    .filter((entry) => entry !== null)
    .sort();
}

/**
 * What the lists say, in the same shape.
 *
 * The three tooth sections carry no accessible name — they are plain `<section>`
 * elements — so the `<h2>` above a list item is the only thing that says WHICH
 * list the tooth is in, and which list a tooth is in is precisely the half of the
 * risk the drawing has to agree with. Items that do not begin with an FDI number
 * (the range-upside sentence under "Scenariusze…", every list elsewhere on the
 * page) name no tooth and drop out.
 */
async function namedInLists(page: Page): Promise<string[]> {
  const items = await page.getByRole("listitem").evaluateAll((elements) =>
    elements.map((element) => ({
      section: element.closest("section")?.querySelector("h2")?.textContent.trim() ?? "",
      text: (element as HTMLElement).innerText,
    })),
  );

  return items
    .map(({ section, text }) => {
      const status = SECTION_STATUS.get(section);
      const number = /^(\d{2}) /.exec(text)?.[1];
      return status !== undefined && number !== undefined ? `${number} · ${status}` : null;
    })
    .filter((entry) => entry !== null)
    .sort();
}

/**
 * The colour the browser actually paints, for a hue that exists in no text.
 *
 * Urgency is the one thing the chart says without saying it: the drawing fills a
 * tooth from one table and the list paints its dot from another, and neither
 * exposes the hue as an accessible name, so the resolved colour is the only place
 * the two can be compared. Both are read as the computed value of a colour
 * property, so they serialise the same way and compare as strings.
 *
 * The painted element is reached by a query inside the page rather than by a
 * locator: the tooth's `<path>` and the list's dot are `aria-hidden` decoration
 * with no role and no name of their own — there is nothing accessible to point a
 * locator at. The element they hang off of is located by role, as everywhere else.
 */
function paintedColour(target: Locator, selector: string, property: "fill" | "backgroundColor"): Promise<string> {
  return target.evaluate(
    (element, options) => {
      const painted = element.querySelector(options.selector);
      if (painted === null) throw new Error(`nothing matching "${options.selector}" to read a colour from`);
      return globalThis.getComputedStyle(painted)[options.property];
    },
    { selector, property },
  );
}

test("risk #8: an approved quote's chart and its written lists describe the same mouth", async ({ page }) => {
  const stamp = Date.now();
  const patientEmail = `e2e-risk8-${stamp}@example.test`;

  // --- The dentystka builds a quote spanning all three statuses ---
  await page.goto("/admin/quotes/new");
  await waitForIslands(page);

  await page.getByLabel(/Tylko do Twojej referencji/).fill(patientEmail);

  await page
    .getByRole("textbox", { name: "Numery FDI, np. 17,16,34" })
    .fill(PLANNED.map((tooth) => tooth.number).join(","));
  await page.getByRole("button", { name: "Dodaj", exact: true }).click();
  await expect(page.getByText(PLANNED[PLANNED.length - 1].name)).toBeVisible();

  // A tooth row has no accessible container of its own, so its three selects are
  // reached by position. `QuoteEditor` keeps `teeth` in ascending FDI order
  // (`planAdditions`), and `PLANNED` is written in that order, so index i is
  // tooth i — an assumption the chart assertion at the end of this block turns
  // from a hope into a checked fact.
  for (const [index, tooth] of PLANNED.entries()) {
    await page.getByRole("combobox", { name: "Status" }).nth(index).selectOption({ label: tooth.status });
    await page.getByRole("combobox", { name: "Rodzaj leczenia" }).nth(index).selectOption({ label: tooth.treatment });
    await page.getByRole("combobox", { name: "Pilność" }).nth(index).selectOption({ label: tooth.urgency });

    if (tooth.item === null) continue;
    // The option's visible label carries its price, which is pricelist data
    // rather than behaviour — match the option by name and select it by value.
    const picker = page.getByRole("combobox", { name: "Dodaj pozycję z cennika…" }).nth(index);
    const itemValue = await picker.getByRole("option", { name: tooth.item }).getAttribute("value");
    await picker.selectOption(itemValue ?? "");
  }

  // The setup landed on the teeth it meant to: the editor's own chart is read
  // back before anything is frozen, so a mis-assigned status fails here, where it
  // is a setup bug, rather than downstream where it would look like agreement.
  await expect.poll(() => markedOnChart(page)).toEqual(EXPECTED);

  // --- She approves it, which freezes the quote and mints the patient link ---
  await page.getByRole("button", { name: "Zatwierdź" }).click();
  await expect(page.getByRole("heading", { name: "Kosztorys zatwierdzony" })).toBeVisible();

  const patientUrl = await page.getByRole("textbox").inputValue();
  expect(patientUrl).toContain("/p/");

  // --- The patient opens the link and sees one mouth, drawn and written ---
  await page.goto(patientUrl);
  await waitForIslands(page);
  await expect(page.getByRole("heading", { name: "Twoje zęby na schemacie" })).toBeVisible();

  // Both sides against the mouth that was actually entered, rather than against
  // each other: two surfaces that agree on the wrong thing would satisfy
  // `chart === lists` and would still be showing the patient someone else's
  // teeth. The diff names the tooth that disagrees, and on which side.
  expect(await markedOnChart(page)).toEqual(EXPECTED);
  expect(await namedInLists(page)).toEqual(EXPECTED);

  // Urgency is carried as a word in the list and as a hue in the drawing, and
  // only in-plan teeth are listed with theirs. Both must be the same urgency.
  for (const tooth of PLANNED.filter((entry) => entry.status === "w planie")) {
    const row = page.getByRole("listitem").filter({ hasText: tooth.name });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(tooth.treatment);
    await expect(row).toContainText(tooth.urgency);

    const drawn = await paintedColour(
      chart(page).getByRole("img", { name: new RegExp(`^${tooth.number} `) }),
      "path",
      "fill",
    );
    const printed = await paintedColour(row, "[aria-hidden='true']", "backgroundColor");
    expect(drawn, `ząb ${tooth.number}: kolor na schemacie ma odpowiadać pilności "${tooth.urgency}" z listy`).toBe(
      printed,
    );
  }
});
