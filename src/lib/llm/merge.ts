// Merging a prefill into the tree the dentystka already has in front of her.
//
// Pulled out of `QuoteEditor` because the component is the wrong place to argue
// about it: this logic has produced two defects already (a tooth proposed twice
// sharing a React key, and a merge computed against a stale snapshot), and both
// were found by looking rather than by a test. Here it is a pure function of
// (tree, prefill) and the interesting cases are cheap to state.
//
// The rule throughout is that the prefill is ADDITIVE. Whatever she typed
// before pressing the button survives untouched; anything the note duplicates is
// skipped and named. A button that saves her time must never cost her work.

import type { GeneralItem, ToothEntry, Visit } from "@/types";

import type { PrefillResult } from "./schema";

export interface WorkingTree {
  teeth: ToothEntry[];
  visits: Visit[];
  generalItems: GeneralItem[];
}

export interface MergedTree extends WorkingTree {
  /** FR-012 notices for the dentystka: what was skipped, and why. */
  warnings: string[];
  /** The general-item counter, advanced past whatever ids this merge minted. */
  generalIdSeed: number;
}

/**
 * @param tree          the tree as it is RIGHT NOW — not as it was when the
 *                      request was sent. The round trip is long enough for her
 *                      to have added a tooth in the meantime.
 * @param generalIdSeed the highest `g-<n>` index already in use.
 */
export function mergePrefill(tree: WorkingTree, prefill: PrefillResult, generalIdSeed: number): MergedTree {
  const warnings: string[] = [...prefill.warnings];

  const existing = new Set(tree.teeth.map((t) => t.number));
  const additions = prefill.content.teeth.filter((t) => {
    if (existing.has(t.number)) {
      warnings.push(`Ząb ${t.number} był już w formularzu — pominięto propozycję z notatki.`);
      return false;
    }
    existing.add(t.number);
    return true;
  });

  // Prefilled visits land after the existing ones and are renumbered to continue
  // the sequence, so a prefilled tooth's visitNumber has to follow its visit to
  // wherever it ended up. Remapping is by the visit's OWN number through an
  // explicit map, not by arithmetic on a positional offset: nothing in the schema
  // or the prompt makes the model number its visits 1, 2, 3 in order, and an
  // offset is right for exactly that case and silently wrong for every other —
  // a tooth pointing at a visit that does not exist, with no warning.
  const renumbered = new Map<number, number>();
  const visits: Visit[] = [...tree.visits];
  for (const visit of prefill.content.visits) {
    const number = visits.length + 1;
    renumbered.set(visit.number, number);
    visits.push({ number, label: visit.label });
  }

  // Teeth and general items both follow their visit, and both can point at one
  // this prefill never declared — `absent` is what to say when they do. Nothing
  // is ever dropped over it: the row lands without a visit and she is told.
  const remapVisit = (visitNumber: number | null, absent: string): number | null => {
    if (visitNumber === null) return null;
    const mapped = renumbered.get(visitNumber);
    if (mapped !== undefined) return mapped;
    warnings.push(absent);
    return null;
  };

  const teeth = [
    ...tree.teeth,
    ...additions.map((t) => ({
      ...t,
      visitNumber: remapVisit(
        t.visitNumber,
        `Ząb ${t.number}: proponowana wizyta nie istnieje — ząb bez przypisanej wizyty.`,
      ),
    })),
  ].sort((a, b) => a.number - b.number);

  // Deduplication is keyed on the pricelist item's id, not on (id, visit): the
  // same item proposed for two visits is one row, the first one. She can add the
  // second by hand.
  const present = new Set(tree.generalItems.map((g) => g.item.id));
  const generalItems = [...tree.generalItems];
  let seed = generalIdSeed;
  for (const { item, visitNumber } of prefill.content.generalItems) {
    if (present.has(item.id)) {
      warnings.push(`„${item.name}” była już w pozycjach ogólnych — pominięto propozycję z notatki.`);
      continue;
    }
    present.add(item.id);
    seed += 1;
    // FR-032: the item's visit follows its visit through the same renumbering the
    // teeth went through above — the prefill's visit 1 is not the merged tree's
    // visit 1 whenever she had already planned one herself.
    generalItems.push({
      id: `g-${seed}`,
      item,
      visitNumber: remapVisit(visitNumber, `„${item.name}”: proponowana wizyta nie istnieje — pozycja bez wizyty.`),
    });
  }

  return { teeth, visits, generalItems, warnings, generalIdSeed: seed };
}
