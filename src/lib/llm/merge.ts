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

  const teeth = [
    ...tree.teeth,
    ...additions.map((t) => {
      if (t.visitNumber === null) return { ...t, visitNumber: null };
      const mapped = renumbered.get(t.visitNumber);
      if (mapped === undefined) {
        warnings.push(`Ząb ${t.number}: proponowana wizyta nie istnieje — ząb bez przypisanej wizyty.`);
        return { ...t, visitNumber: null };
      }
      return { ...t, visitNumber: mapped };
    }),
  ].sort((a, b) => a.number - b.number);

  const present = new Set(tree.generalItems.map((g) => g.item.id));
  const generalItems = [...tree.generalItems];
  let seed = generalIdSeed;
  for (const item of prefill.content.generalItems) {
    if (present.has(item.id)) {
      warnings.push(`„${item.name}” była już w pozycjach ogólnych — pominięto propozycję z notatki.`);
      continue;
    }
    present.add(item.id);
    seed += 1;
    generalItems.push({ id: `g-${seed}`, item, visitNumber: null });
  }

  return { teeth, visits, generalItems, warnings, generalIdSeed: seed };
}
