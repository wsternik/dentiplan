/* eslint-disable no-console -- this is a CLI gate; logging IS its output */
// Fail-fast validation gate for the bundled pricelist seed (F-02).
//
// There is no test runner yet (Module 3 introduces testing), so this script IS
// the automated gate: importing the seed (via the barrel) forces its load-time
// Zod parse and the annotation completeness guard to run, then it round-trips
// representative items through the resolver. Any schema, referential, or
// round-trip failure exits non-zero. Run via `npm run validate:pricing` (tsx
// resolves the `@/` alias + JSON imports).

import { PRICELIST, ANESTHESIA_FEE_SCHEDULE, resolvePricelistItem } from "@/lib/pricing";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

try {
  const categoryCount = PRICELIST.categories.length;
  const itemCount = PRICELIST.categories.reduce((sum, c) => sum + c.items.length, 0);

  // Resolver round-trip: one fixed, one range, one modifier → correct PriceValue shape.
  const fixed = resolvePricelistItem("profilaktyka:higienizacja-piaskowanie");
  assert(fixed.price.kind === "fixed" && fixed.price.amount === 500, "fixed round-trip failed");

  const range = resolvePricelistItem("profilaktyka:higienizacja");
  assert(range.price.kind === "range" && range.price.min === 400 && range.price.max === 450, "range round-trip failed");

  const modifier = resolvePricelistItem("leczenie-kanalowe:ponowne-leczenie-kanalowe-kwota-doliczana-do-zabiegu");
  assert(modifier.price.kind === "modifier" && modifier.price.amount === 500, "modifier round-trip failed");

  // FR-041: the local-anesthesia item carries the flag through the snapshot.
  const anesthesia = resolvePricelistItem("leczenie-zachowawcze:znieczulenie");
  assert(anesthesia.localAnesthesia, "localAnesthesia flag lost in round-trip");

  console.log(`✓ pricelist seed valid: ${categoryCount} categories, ${itemCount} items`);
  console.log("✓ resolver round-trip ok: fixed, range, modifier, localAnesthesia");
  console.log(
    `✓ anesthesia fee schedule: milk=${ANESTHESIA_FEE_SCHEDULE.baseMilk}, ` +
      `permanent=${ANESTHESIA_FEE_SCHEDULE.basePermanent}, ` +
      `+${ANESTHESIA_FEE_SCHEDULE.perExtraTooth}/tooth over ${ANESTHESIA_FEE_SCHEDULE.includedTeeth}`,
  );
  process.exit(0);
} catch (err) {
  console.error("✗ pricelist validation failed:");
  console.error(err);
  process.exit(1);
}
