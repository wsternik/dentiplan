// Every rule about the order visits come back in and the words they are named
// with, in one pure module.
//
// Both used to belong to the model: it numbered the visits and it wrote their
// `label`, and that label went into `content`, which is served verbatim to
// anyone holding the patient link (see the INVARIANT in `src/types.ts`). The
// model states facts now — which teeth go together, and why — and the code
// writes the sentences. This is the same excision S-02 made for `note`, one
// field later.
//
// Kept out of `parse-diagnosis.ts` so the rules are testable on constructed
// input, without a fixture and without a provider, and so the prompt (phase 2)
// can import the ceiling rather than repeat the numeral.

import type { ToothEntry, Urgency, Visit } from "@/types";

/**
 * How many visits we ask the model for at most. Exported because the prompt
 * states this ceiling and the mapper warns when it is exceeded — one number, so
 * the instruction and the check cannot drift apart.
 */
export const MAX_PROPOSED_VISITS = 5;

/**
 * The closed vocabulary a proposed visit may be named from. She can rename any
 * visit afterwards (FR-031); what she cannot get is a name the model invented.
 */
export const VISIT_LABELS = [
  "Leczenie pilne",
  "Leczenie zachowawcze",
  "Leczenie kanałowe",
  "Ekstrakcje",
  "Higienizacja",
] as const;

/** Strongest first. `ToothEntry.urgency` is nullable, hence the fourth rank. */
const URGENCY_RANK: Record<Urgency, number> = { urgent: 0, moderate: 1, mild: 2 };
const NO_URGENCY = 3;

function toothRank(tooth: ToothEntry): number {
  return tooth.urgency === null ? NO_URGENCY : URGENCY_RANK[tooth.urgency];
}

/**
 * Name a visit from the teeth assigned to it. First matching rule wins.
 *
 * Urgency outranks treatment type on purpose: what makes her schedule a visit
 * first is that it hurts, not what is being done at it. With urgent teeth
 * grouped into the first visit, at most one visit normally claims that label.
 *
 * A visit with no teeth is left unnamed rather than guessed at — `VisitList`
 * renders its own placeholder for that.
 */
export function visitLabel(teeth: ToothEntry[]): string {
  if (teeth.some((t) => t.urgency === "urgent")) return "Leczenie pilne";

  const treated = teeth.filter((t) => t.treatmentType !== null);
  if (treated.length > 0 && treated.every((t) => t.treatmentType === "root-canal")) return "Leczenie kanałowe";
  if (teeth.some((t) => t.treatmentType === "extraction")) return "Ekstrakcje";
  if (teeth.length > 0) return "Leczenie zachowawcze";

  return "";
}

/**
 * Order the proposed visits by how urgent their teeth are, renumber them 1..n,
 * name them, and carry every tooth over to its visit's new number.
 *
 * A tie keeps the model's array order: `Array.prototype.sort` is stable in V8
 * and workerd, and the model grouped those visits deliberately — we have nothing
 * better to say about which of two equally urgent visits comes first.
 *
 * Returns the old→new map as well as the ordered tree: general items follow the
 * same renumbering (FR-032), and callers other than the tooth loop need it.
 *
 * The caller owns deduplication: `visits` must not contain two entries with the
 * same `number`. The old→new map is keyed on that number, so a duplicate would
 * resolve to the last entry and quietly send the first one's teeth to the wrong
 * slot. `parseDiagnosis` drops duplicates — first wins — before calling here.
 */
export function orderVisits(
  visits: Visit[],
  teeth: ToothEntry[],
): { visits: Visit[]; teeth: ToothEntry[]; renumbered: Map<number, number> } {
  const teethOf = (number: number) => teeth.filter((t) => t.visitNumber === number);

  const rankOf = (visit: Visit) =>
    teethOf(visit.number).reduce((strongest, tooth) => Math.min(strongest, toothRank(tooth)), NO_URGENCY);

  const ordered = [...visits].sort((a, b) => rankOf(a) - rankOf(b));

  const renumbered = new Map<number, number>();
  const renumberedVisits = ordered.map((visit, index) => {
    renumbered.set(visit.number, index + 1);
    return { number: index + 1, label: visitLabel(teethOf(visit.number)) };
  });

  const renumberedTeeth = teeth.map((tooth) =>
    tooth.visitNumber === null ? tooth : { ...tooth, visitNumber: renumbered.get(tooth.visitNumber) ?? null },
  );

  return { visits: renumberedVisits, teeth: renumberedTeeth, renumbered };
}
