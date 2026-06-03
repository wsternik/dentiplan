/* eslint-disable no-console -- this is a CLI gate; logging IS its output */
// Fail-fast validation gate for the bundled pricelist seed (F-02).
//
// There is no test runner yet (Module 3 introduces testing), so this script IS
// the automated gate: importing the seed forces its load-time Zod parse and the
// annotation completeness guard to run. Any schema or referential failure throws
// during import; we catch it, print it, and exit non-zero. Run via
// `npm run validate:pricing` (tsx resolves the `@/` alias + JSON imports).

import { PRICELIST, ANESTHESIA_FEE_SCHEDULE } from "@/lib/pricing/seed";

try {
  const categoryCount = PRICELIST.categories.length;
  const itemCount = PRICELIST.categories.reduce((sum, c) => sum + c.items.length, 0);

  console.log(`✓ pricelist seed valid: ${categoryCount} categories, ${itemCount} items`);
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
