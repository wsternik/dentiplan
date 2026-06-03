// Source pricelist + anesthesia-fee-schedule Zod schema (F-02 foundation).
//
// This is the *source* shape the bundled seed (`seed.ts`, Phase 2) validates
// against at module load — richer than the F-01 snapshot ref in `src/types.ts`:
// grouped by category, carrying the raw `price_type`/`price_min`/`price_max`
// from the clinic export PLUS the DentiPlan-authored annotation flags
// (`localAnesthesia`/`validForTooth`/`validForGeneral`) and a stable `id`.
// Types are derived via `z.infer` so the runtime validator and the compile-time
// type can never drift, matching the Zod-first pattern in `src/types.ts`.
//
// The snapshot resolver (Phase 3) maps a SourcePricelistItem down to the F-01
// `PricelistItemRef` / `PriceValue` that freezes into a quote's `content`.

import { z } from "zod";

/**
 * The price kinds the real exports carry, matching each item's `price_type`:
 * `fixed` (single `price_min`), `range` (`price_min`–`price_max`), `modifier`
 * (additive surcharge, +`price_min`), `from` (starting "od `price_min`" price —
 * documented in `pricing.json`'s `$comment` but unused by any item today).
 */
export const PriceTypeSchema = z.enum(["fixed", "range", "modifier", "from"]);
export type PriceType = z.infer<typeof PriceTypeSchema>;

/**
 * One source pricelist item: the fields straight from the clinic JSON export
 * plus the DentiPlan-authored annotation fields the export lacks. The
 * cross-field refinement encodes the `price_max` contract — only `range` items
 * carry a max; `fixed`/`modifier`/`from` must leave it null.
 *
 * - `id` — stable key (`<category-slug>:<slugified-name>`) S-01 references and
 *   freezes into snapshots (FR-050); authored in `seed.ts`, not in the export.
 * - `localAnesthesia` — FR-041 auto-skip flag for the narkoza plan; authored.
 * - `validForTooth` / `validForGeneral` — context gates for where the item may
 *   be picked (per-tooth vs general item, FR-025/FR-029); authored.
 */
export const SourcePricelistItemSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    price_type: PriceTypeSchema,
    price_min: z.number().nonnegative(),
    price_max: z.number().nonnegative().nullable(),
    note: z.string().nullable(),
    display: z.string(),
    localAnesthesia: z.boolean().default(false),
    validForTooth: z.boolean(),
    validForGeneral: z.boolean(),
  })
  .refine((item) => (item.price_type === "range" ? item.price_max !== null : item.price_max === null), {
    message: "`range` items require a non-null price_max; `fixed`/`modifier`/`from` items require a null price_max",
    path: ["price_max"],
  })
  // Guard against an inverted range from a future re-export typo (e.g. min 600 / max 400)
  // — it would silently mis-total in S-01's sum logic if it slipped through.
  .refine((item) => item.price_type !== "range" || item.price_max === null || item.price_max >= item.price_min, {
    message: "`range` items require price_max >= price_min",
    path: ["price_max"],
  })
  // Every item must be pickable somewhere; a both-false typo would make it silently
  // absent from BOTH listToothItems() and listGeneralItems().
  .refine((item) => item.validForTooth || item.validForGeneral, {
    message: "item must be valid for at least one context (validForTooth and/or validForGeneral)",
    path: ["validForTooth"],
  });
export type SourcePricelistItem = z.infer<typeof SourcePricelistItemSchema>;

/** A pricelist category grouping its items (from the export's `categories[]`). */
export const PricelistCategorySchema = z.object({
  name: z.string(),
  slug: z.string(),
  items: z.array(SourcePricelistItemSchema),
});
export type PricelistCategory = z.infer<typeof PricelistCategorySchema>;

/**
 * The top-level source pricelist: export metadata plus the annotated categories.
 * `$comment` and the export's `modifiers[]` are intentionally not modeled — the
 * `modifier` items live inline in their categories; Zod strips the rest.
 */
export const PricelistSchema = z.object({
  currency: z.string(),
  isIndicative: z.boolean(),
  nfz: z.boolean(),
  paymentMethods: z.array(z.string()),
  installments: z.boolean(),
  categories: z.array(PricelistCategorySchema),
});
export type Pricelist = z.infer<typeof PricelistSchema>;

/**
 * The anesthesia fee model (FR-042/FR-043), derived in `seed.ts` from
 * `pricing-narkoza.json`: a base by dentition (`baseMilk` for milk-only
 * children, `basePermanent` for adults/permanent teeth), a `perExtraTooth`
 * surcharge, and the `includedTeeth` threshold above which the surcharge
 * applies. S-01 owns the formula `base + max(0, teeth - includedTeeth) *
 * perExtraTooth`; F-02 only supplies these constants.
 */
export const AnesthesiaFeeScheduleSchema = z.object({
  baseMilk: z.number(),
  basePermanent: z.number(),
  perExtraTooth: z.number(),
  includedTeeth: z.number(),
});
export type AnesthesiaFeeSchedule = z.infer<typeof AnesthesiaFeeScheduleSchema>;
