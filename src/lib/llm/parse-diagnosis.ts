// S-02: turn a model's reading of the diagnosis note into the tree the editor
// holds — and refuse everything in it that is not real.
//
// This is where risk #7 is stopped. The model's answer arrives schema-valid by
// construction (`schema.ts` cannot bound a tooth number, because the provider
// rejects numeric bounds), so "valid against the schema" says nothing about
// whether tooth 99 exists or `leczenie-kanalowe:mikroskop-endodontyczny` is in
// the seed. Every value that names something in the domain is checked against
// the domain here, and anything that fails is DROPPED and NAMED — never
// silently accepted, never silently discarded (FR-012).
//
// Prices are read from the seed, never from the model, for the same reason
// `quote-payload.ts` re-resolves what the browser sends: the client of this
// function is not a trust boundary, and neither is a language model.
//
// Pure by design: no I/O, no provider, no `astro:env`. `client.ts` holds the
// network call and is injected by the endpoint, so this module — and its tests —
// never reach the framework.

import { findItemById, resolvePricelistItem } from "@/lib/pricing";
import { isValidToothNumber } from "@/lib/quote/tooth-name";
import type { PricelistItemRef, ToothEntry, TreatmentType, Urgency, Visit } from "@/types";

// Type-only, so it is erased at build time and `client.ts` — with its
// `astro:env` import — never enters this module's runtime graph. Keep it that way.
import type { DiagnosisModel } from "./client";
import { UNKNOWN, type ParsedDiagnosis, type PrefillResult } from "./schema";

/** `"unknown"` is the model's "the note does not say"; the form stores `null`. */
function orNull<T extends string>(value: T | typeof UNKNOWN): T | null {
  return value === UNKNOWN ? null : value;
}

/**
 * Resolve one id against the seed, in the context it was offered for. Returns
 * `null` plus a warning when the id is not in the catalog, or is in it but not
 * valid here — a membership check alone would let a general item onto a tooth.
 */
function resolveIn(
  id: string,
  context: "tooth" | "general",
  where: string,
): { ref: PricelistItemRef } | { warning: string } {
  const item = findItemById(id);
  if (!item) {
    return { warning: `${where}: pominięto nieznaną pozycję cennika „${id}”.` };
  }
  const valid = context === "tooth" ? item.validForTooth : item.validForGeneral;
  if (!valid) {
    const kind = context === "tooth" ? "pozycją przypisywaną do zęba" : "pozycją ogólną";
    return { warning: `${where}: „${item.name}” (${id}) nie jest ${kind} — pominięto.` };
  }
  return { ref: resolvePricelistItem(id) };
}

export function mapParsedDiagnosis(parsed: ParsedDiagnosis): PrefillResult {
  // The model's own unrecognised phrases come first: they are about the note
  // the dentystka wrote, which is more interesting to her than our bookkeeping.
  const warnings: string[] = [...parsed.warnings];

  const visits: Visit[] = parsed.visits.map((v) => ({ number: v.number, label: v.label }));
  const declaredVisits = new Set(visits.map((v) => v.number));

  const teeth: ToothEntry[] = [];
  for (const tooth of parsed.teeth) {
    if (!isValidToothNumber(tooth.number)) {
      warnings.push(`Pominięto ząb ${tooth.number} — numer spoza zakresu FDI.`);
      continue;
    }

    const pricelistItems: PricelistItemRef[] = [];
    for (const id of tooth.pricelistItemIds) {
      const resolved = resolveIn(id, "tooth", `Ząb ${tooth.number}`);
      if ("ref" in resolved) pricelistItems.push(resolved.ref);
      else warnings.push(resolved.warning);
    }

    const status = tooth.status;
    // FR-030: only an in-plan tooth belongs to a visit. An uncertain tooth the
    // model assigned anyway is corrected quietly — that is the rule working,
    // not a problem she needs to hear about.
    let visitNumber: number | null = status === "in-plan" && tooth.visitNumber !== 0 ? tooth.visitNumber : null;
    if (visitNumber !== null && !declaredVisits.has(visitNumber)) {
      warnings.push(`Ząb ${tooth.number}: wizyta ${visitNumber} nie została zaproponowana — ząb bez wizyty.`);
      visitNumber = null;
    }

    teeth.push({
      number: tooth.number,
      treatmentType: orNull<TreatmentType>(tooth.treatmentType),
      urgency: orNull<Urgency>(tooth.urgency),
      status,
      // Never model-written: `note` is served verbatim to the patient. See schema.ts.
      note: "",
      pricelistItems,
      visitNumber,
    });
  }

  const generalItems: PricelistItemRef[] = [];
  for (const id of parsed.generalItemIds) {
    const resolved = resolveIn(id, "general", "Pozycje ogólne");
    if ("ref" in resolved) generalItems.push(resolved.ref);
    else warnings.push(resolved.warning);
  }

  return { content: { teeth, visits, generalItems }, warnings };
}

/**
 * Read a diagnosis note into a prefillable quote tree.
 *
 * `text` is a `string` and there is no second content parameter, which is how
 * FR-011/FR-072 ("the only data sent is the diagnosis text itself") is enforced
 * structurally rather than by review — `patient_email` has no path in here.
 *
 * `model` is REQUIRED, not defaulted: a default would mean importing
 * `client.ts`, which reads `astro:env/server`, into this module's graph — and
 * the tests could then not import it at all.
 */
export async function parseDiagnosis(text: string, model: DiagnosisModel): Promise<PrefillResult> {
  return mapParsedDiagnosis(await model.read(text));
}
