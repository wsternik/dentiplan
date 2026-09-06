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
import { MAX_PROPOSED_VISITS, orderVisits } from "./visits";

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

  // The label is no longer read from the model — `orderVisits` names every visit
  // from the closed dictionary at the end of this function. What the model wrote
  // about the grouping is held aside and becomes a warning once we know which
  // number each visit ended up as.
  const visits: Visit[] = [];
  const declaredVisits = new Set<number>();
  const rationales = new Map<number, string>();
  for (const visit of parsed.visits) {
    if (declaredVisits.has(visit.number)) {
      // Two visits sharing a number are two `VisitList` rows sharing a React key.
      // First declaration wins, as it does for a tooth listed twice.
      warnings.push(`Wizyta ${visit.number} została zaproponowana dwukrotnie — wzięto pierwszą propozycję.`);
      continue;
    }
    declaredVisits.add(visit.number);
    visits.push({ number: visit.number, label: "" });
    if (visit.rationale.trim() !== "") rationales.set(visit.number, visit.rationale.trim());
  }
  if (visits.length > MAX_PROPOSED_VISITS) {
    // Warn and keep. Dropping the excess would push their teeth through the
    // declared-visit check below into `visitNumber: null` — the button would cost
    // her the work it was supposed to save. The ceiling is a prompt instruction;
    // the code's job is to notice it was ignored, not to enforce it destructively.
    warnings.push(
      `Model zaproponował ${visits.length} wizyt — więcej niż ${MAX_PROPOSED_VISITS}. Zostawiono wszystkie; scal je, jeśli to za dużo.`,
    );
  }

  const teeth: ToothEntry[] = [];
  /** Teeth whose urgency the model supplied without support in the note. */
  const inferredUrgency: number[] = [];
  // A note can mention the same tooth under two headings, and the model dutifully
  // returns it twice. The editor keys tooth rows by number, so a duplicate is two
  // rows sharing a React key and one tooth billed twice. First reading wins:
  // merging two contradictory readings would invent a third one neither says.
  const seenTeeth = new Set<number>();
  for (const tooth of parsed.teeth) {
    if (!isValidToothNumber(tooth.number)) {
      warnings.push(`Pominięto ząb ${tooth.number} — numer spoza zakresu FDI.`);
      continue;
    }
    if (seenTeeth.has(tooth.number)) {
      warnings.push(`Ząb ${tooth.number} pojawił się w notatce dwukrotnie — wzięto pierwsze odczytanie.`);
      continue;
    }
    seenTeeth.add(tooth.number);

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

    const urgency = orNull<Urgency>(tooth.urgency);
    // FR-015: an urgency the model proposed rather than read is a decision waiting
    // for her, and it has to be named as one. Collected after the tooth has passed
    // every check, so a tooth we dropped is never named in the warning.
    if (urgency !== null && !tooth.urgencyFromNote) inferredUrgency.push(tooth.number);

    // Field by field, deliberately: spreading `tooth` would carry
    // `urgencyFromNote` — a fact about the model's reasoning — straight into
    // `content`, which is served verbatim to the patient.
    teeth.push({
      number: tooth.number,
      treatmentType: orNull<TreatmentType>(tooth.treatmentType),
      urgency,
      status,
      // Never model-written: `note` is served verbatim to the patient. See schema.ts.
      note: "",
      pricelistItems,
      visitNumber,
    });
  }

  if (inferredUrgency.length > 0) {
    // One warning for all of them: a per-tooth marker in the row would be read as
    // a defect on that tooth, and she reads this list once.
    warnings.push(`Pilność dla zębów ${inferredUrgency.join(", ")} zaproponował model — nie ma jej wprost w notatce.`);
  }

  // FR-032: a general item carries the visit it belongs to, so a visit's partial
  // cost covers the whole visit. Deduplication stays keyed on the item id alone —
  // the same item proposed for two visits collapses to the first. Hygiene at
  // visit 1 and visit 4 is a real case, but it is one dropdown for her and a
  // dedup-key redesign for us.
  const generalItems: { item: PricelistItemRef; visitNumber: number | null }[] = [];
  const seenGeneral = new Set<string>();
  for (const general of parsed.generalItems) {
    if (seenGeneral.has(general.id)) {
      warnings.push(`Pozycja ogólna „${general.id}” pojawiła się dwukrotnie — dodano raz.`);
      continue;
    }
    const resolved = resolveIn(general.id, "general", "Pozycje ogólne");
    if (!("ref" in resolved)) {
      warnings.push(resolved.warning);
      continue;
    }
    seenGeneral.add(general.id);

    // The same check a tooth's visit gets, and for the same reason: a reference
    // to a visit that was never declared would arrive schema-valid and point at
    // nothing.
    let visitNumber: number | null = general.visitNumber === 0 ? null : general.visitNumber;
    if (visitNumber !== null && !declaredVisits.has(visitNumber)) {
      warnings.push(`„${resolved.ref.name}”: wizyta ${visitNumber} nie została zaproponowana — pozycja bez wizyty.`);
      visitNumber = null;
    }
    generalItems.push({ item: resolved.ref, visitNumber });
  }

  // Ordering runs last, and the rationale warnings are composed from its result.
  // A rationale is addressed to a visit ("wizyta 2 to strona lewa") and this is
  // the step that decides which visit is number 2 — compose them from the
  // unordered list and they name the wrong one, in prose that reads perfectly.
  const ordered = orderVisits(visits, teeth);

  const attributed = [...rationales.entries()]
    .map(([declared, rationale]) => ({ number: ordered.renumbered.get(declared) ?? declared, rationale }))
    .sort((a, b) => a.number - b.number);
  for (const { number, rationale } of attributed) {
    warnings.push(`Wizyta ${number} — propozycja modelu: ${rationale}`);
  }

  // General items follow the same renumbering the teeth just did — their visit
  // was validated against the model's numbering, and the ordering above replaced
  // it. The fallback is unreachable while every declared visit is in the map; it
  // is here so a future change to that cannot silently point at a stale number.
  const orderedGeneralItems = generalItems.map((general) =>
    general.visitNumber === null
      ? general
      : { ...general, visitNumber: ordered.renumbered.get(general.visitNumber) ?? null },
  );

  return { content: { teeth: ordered.teeth, visits: ordered.visits, generalItems: orderedGeneralItems }, warnings };
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
