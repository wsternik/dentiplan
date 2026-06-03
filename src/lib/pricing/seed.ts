// Canonical bundled pricelist seed (F-02 foundation).
//
// Builds the single source of truth the S-01 quote flow reads from: it imports
// the byte-faithful clinic exports under `./data/`, attaches the DentiPlan
// annotations the exports lack (`localAnesthesia` / `validForTooth` /
// `validForGeneral` + a stable `id`), derives the anesthesia fee schedule from
// `pricing-narkoza.json`, and validates the whole structure with the Phase 1
// schema AT MODULE LOAD — so any import (the page bundle, the `validate:pricing`
// script) triggers the parse and the completeness guard.
//
// Authoring the annotation map below is the one place clinical judgment enters.
// The price NUMBERS stay in the raw JSON (diffable against future re-exports);
// only the behavioral flags are authored here, keyed by stable id.
//
// EXCLUSION: the `leczenie-w-narkozie` category is filtered OUT of `PRICELIST`.
// Its three rows ARE the anesthesia fee (1400 / 2000 base, +100 per extra
// tooth) — represented by `ANESTHESIA_FEE_SCHEDULE` and computed by S-01's
// formula, never picked as a per-tooth or general item. A future re-import must
// not silently re-add it (it would force a meaningless context annotation and
// could leak the fee into `listGeneralItems()`).

import { z } from "zod";
import pricingRaw from "./data/pricing.json";
import narkozaRaw from "./data/pricing-narkoza.json";
import { PricelistSchema, AnesthesiaFeeScheduleSchema, type Pricelist, type AnesthesiaFeeSchedule } from "./schema";

/** Category whose rows are the anesthesia fee, not pickable items (see header). */
const EXCLUDED_CATEGORY_SLUG = "leczenie-w-narkozie";

/** The authored annotation for a single item, merged onto its raw JSON fields. */
interface Annotation {
  localAnesthesia?: boolean;
  validForTooth: boolean;
  validForGeneral: boolean;
}

/**
 * Stable id derived from category + item name. NFKD folds most Polish diacritics
 * (ą/ę/ó/ś/ć/ń/ź/ż → ascii via their combining marks), but `ł` (U+0142) does NOT
 * decompose under NFKD, so it needs an explicit pre-map. Every run of non-
 * `[a-z0-9]` (spaces, em/en-dashes, `/`, `+`, curly quotes, parens, commas)
 * collapses to a single `-`, trimmed at the ends.
 */
function slugify(name: string): string {
  return name
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Annotation lookup keyed by stable id (`<category-slug>:<slug(name)>`) for
 * every NON-excluded item. The completeness guard below throws if any included
 * item is missing here, or if any key here references a non-existent / excluded
 * item — so a future re-export can neither drop a flag nor leave a stale entry
 * unnoticed.
 *
 * Context rationale: profilaktyka, consultation, RTG, adaptation visit, dentures
 * (arch-level), and whole-mouth whitening are GENERAL items; per-tooth
 * treatments (fillings, root canals, crowns, extractions, dressings, sealing,
 * and the +500/+100 surcharges they attach to) are per-TOOTH. Borderline rows
 * (`nacięcie ropnia`, local `znieczulenie`) are tooth-scoped here and easy for
 * the dentystka to flip. `znieczulenie` additionally carries the FR-041 flag.
 */
const ANNOTATIONS = new Map<string, Annotation>(
  Object.entries({
    // Profilaktyka — hygiene / varnish / panoramic X-ray: general.
    "profilaktyka:higienizacja": { validForTooth: false, validForGeneral: true },
    "profilaktyka:higienizacja-piaskowanie": { validForTooth: false, validForGeneral: true },
    "profilaktyka:lakierowanie": { validForTooth: false, validForGeneral: true },
    "profilaktyka:rtg-pantomogram": { validForTooth: false, validForGeneral: true },

    // Leczenie zachowawcze — consultation general; local anesthesia flagged; rest per-tooth.
    "leczenie-zachowawcze:konsultacja-badanie-jamy-ustnej": { validForTooth: false, validForGeneral: true },
    "leczenie-zachowawcze:znieczulenie": { localAnesthesia: true, validForTooth: true, validForGeneral: false },
    "leczenie-zachowawcze:wypelnienie-male-duze": { validForTooth: true, validForGeneral: false },
    "leczenie-zachowawcze:odbudowa-po-leczeniu-kanalowym": { validForTooth: true, validForGeneral: false },
    "leczenie-zachowawcze:licowka-kompozytowa": { validForTooth: true, validForGeneral: false },
    "leczenie-zachowawcze:opatrunek-leczniczy": { validForTooth: true, validForGeneral: false },

    // Leczenie kanałowe — all per-tooth (the re-treatment +500 is a per-tooth surcharge).
    "leczenie-kanalowe:leczenie-kanalowe-siekacza-kla": { validForTooth: true, validForGeneral: false },
    "leczenie-kanalowe:leczenie-kanalowe-przedtrzonowca": { validForTooth: true, validForGeneral: false },
    "leczenie-kanalowe:leczenie-kanalowe-trzonowca": { validForTooth: true, validForGeneral: false },
    "leczenie-kanalowe:ponowne-leczenie-kanalowe-kwota-doliczana-do-zabiegu": {
      validForTooth: true,
      validForGeneral: false,
    },
    "leczenie-kanalowe:odbudowa-po-leczeniu-kanalowym": { validForTooth: true, validForGeneral: false },
    "leczenie-kanalowe:odbudowa-ze-wzmocnieniem": { validForTooth: true, validForGeneral: false },

    // Protetyka — crowns per-tooth; dentures (arch-level) + repair general.
    "protetyka:korona-metalowo-porcelanowa": { validForTooth: true, validForGeneral: false },
    "protetyka:korona-pelnoceramiczna-bez-podbudowy-metalowej": { validForTooth: true, validForGeneral: false },
    "protetyka:proteza-akrylowa": { validForTooth: false, validForGeneral: true },
    "protetyka:proteza-szkieletowa": { validForTooth: false, validForGeneral: true },
    "protetyka:proteza-kombinowana-zawierajaca-elementy-roznych-protez": {
      validForTooth: false,
      validForGeneral: true,
    },
    "protetyka:naprawa-protezy": { validForTooth: false, validForGeneral: true },

    // Wybielanie zębów — whole-mouth: general.
    "wybielanie-zebow:nakladkowe": { validForTooth: false, validForGeneral: true },
    "wybielanie-zebow:gabinetowe": { validForTooth: false, validForGeneral: true },

    // Stomatologia dziecięca — adaptation visit general; rest per-tooth.
    "stomatologia-dziecieca:wizyta-adaptacyjna": { validForTooth: false, validForGeneral: true },
    "stomatologia-dziecieca:wypelnienie-w-zebie-mlecznym": { validForTooth: true, validForGeneral: false },
    "stomatologia-dziecieca:opatrunek": { validForTooth: true, validForGeneral: false },
    "stomatologia-dziecieca:ekstrakcja-zeba-mlecznego": { validForTooth: true, validForGeneral: false },
    "stomatologia-dziecieca:leczenie-amputacyjne-i-wizyta": { validForTooth: true, validForGeneral: false },
    "stomatologia-dziecieca:leczenie-amputacyjne-ii-wizyta": { validForTooth: true, validForGeneral: false },
    "stomatologia-dziecieca:poszerzone-lakowanie": { validForTooth: true, validForGeneral: false },
    "stomatologia-dziecieca:impregnacja-i-wizyta": { validForTooth: true, validForGeneral: false },
    "stomatologia-dziecieca:impregnacja-ii-wizyta": { validForTooth: true, validForGeneral: false },
    "stomatologia-dziecieca:impregnacja-iii-wizyta": { validForTooth: true, validForGeneral: false },

    // Chirurgia stomatologiczna — tooth-scoped surgery; the +100 suture is a per-tooth surcharge.
    "chirurgia-stomatologiczna:ekstrakcja-zeba": { validForTooth: true, validForGeneral: false },
    "chirurgia-stomatologiczna:naciecie-ropnia": { validForTooth: true, validForGeneral: false },
    "chirurgia-stomatologiczna:szycie": { validForTooth: true, validForGeneral: false },
  }),
);

/**
 * Build + validate the pricelist: filter the excluded category, attach id +
 * annotation to every remaining item (throwing on a missing annotation or a
 * duplicate id), then Zod-parse the result. Runs at module load.
 */
function buildPricelist(): Pricelist {
  const usedIds = new Set<string>();
  const referencedAnnotations = new Set<string>();

  const categories = pricingRaw.categories
    .filter((category) => category.slug !== EXCLUDED_CATEGORY_SLUG)
    .map((category) => ({
      name: category.name,
      slug: category.slug,
      items: category.items.map((item) => {
        const id = `${category.slug}:${slugify(item.name)}`;
        if (usedIds.has(id)) {
          throw new Error(`Duplicate pricelist id "${id}" — two item names slug to the same key.`);
        }
        usedIds.add(id);

        const annotation = ANNOTATIONS.get(id);
        if (!annotation) {
          throw new Error(`Pricelist item "${id}" (${item.name}) has no annotation entry — add one to ANNOTATIONS.`);
        }
        referencedAnnotations.add(id);

        return {
          id,
          name: item.name,
          price_type: item.price_type,
          price_min: item.price_min,
          price_max: item.price_max,
          note: item.note,
          display: item.display,
          localAnesthesia: annotation.localAnesthesia ?? false,
          validForTooth: annotation.validForTooth,
          validForGeneral: annotation.validForGeneral,
        };
      }),
    }));

  // Reverse guard: every annotation key must map to a real, included item.
  for (const key of ANNOTATIONS.keys()) {
    if (!referencedAnnotations.has(key)) {
      throw new Error(`Annotation "${key}" references a non-existent or excluded item — remove the stale entry.`);
    }
  }

  return PricelistSchema.parse({
    currency: pricingRaw.currency,
    isIndicative: pricingRaw.isIndicative,
    nfz: pricingRaw.nfz,
    paymentMethods: pricingRaw.paymentMethods,
    installments: pricingRaw.installments,
    categories,
  });
}

/**
 * Lens over the bits of `pricing-narkoza.json` the fee schedule needs. Parsing
 * through Zod (rather than trusting the JSON-import inferred union) both narrows
 * the `pricing` shape cleanly and fails loudly if a re-export drops a field.
 */
const NarkozaFeeSourceSchema = z.object({
  model: z.object({
    components: z.array(
      z.object({
        order: z.number(),
        pricing: z.object({
          base: z.array(z.object({ key: z.string(), price: z.number() })).optional(),
          modifier: z.object({ amount: z.number() }).optional(),
        }),
      }),
    ),
  }),
});

/**
 * Derive the anesthesia fee schedule from `pricing-narkoza.json`. `baseMilk` /
 * `basePermanent` / `perExtraTooth` are clean numeric fields read straight from
 * the JSON; `includedTeeth` has NO numeric field (it lives only in the prose
 * `scope: "do 5 zębów…"` and the `formula` string), so it is an authored
 * constant — do not regex-parse the prose.
 */
function buildFeeSchedule(): AnesthesiaFeeSchedule {
  const { model } = NarkozaFeeSourceSchema.parse(narkozaRaw);
  // Select the anesthesia component by the structural fact that it carries the
  // base-price array (the dental-treatment component does not), rather than its
  // `order` — robust to a re-export reordering or dropping `order`.
  const anesthesia = model.components.find((c) => c.pricing.base !== undefined);
  const base = anesthesia?.pricing.base;
  const perExtraTooth = anesthesia?.pricing.modifier?.amount;
  const baseMilk = base?.find((b) => b.key === "dzieci")?.price;
  const basePermanent = base?.find((b) => b.key === "dorosli")?.price;
  if (baseMilk === undefined || basePermanent === undefined || perExtraTooth === undefined) {
    throw new Error("pricing-narkoza.json: missing anesthesia base (`dzieci`/`dorosli`) or per-extra-tooth modifier.");
  }

  return AnesthesiaFeeScheduleSchema.parse({
    baseMilk, // 1400 — dzieci (same zęby mleczne)
    basePermanent, // 2000 — dorośli oraz dzieci z zębami stałymi
    perExtraTooth, // 100 — każdy dodatkowy ząb powyżej 5
    includedTeeth: 5, // authored: only in prose `scope: "do 5 zębów…"` + `formula`, no numeric field
  });
}

/** The validated, annotated pricelist S-01 reads from (narkoza category excluded). */
export const PRICELIST: Pricelist = buildPricelist();

/** The validated anesthesia fee constants (FR-042/FR-043); S-01 owns the formula. */
export const ANESTHESIA_FEE_SCHEDULE: AnesthesiaFeeSchedule = buildFeeSchedule();
