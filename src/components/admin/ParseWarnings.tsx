// FR-012's warnings from a note prefill.
//
// These are not errors — the prefill succeeded. They are the list of things the
// model read but could not place, and the things it produced that the server
// refused: a tooth number outside FDI, a pricelist id that is not in the seed,
// an item offered in the wrong context. Showing them is the requirement (FR-012
// says such cases are "surfaced as warnings on the form rather than auto-dropped
// or auto-accepted"), and it is also the only place the dentystka learns what
// the note contained that the form does not.
//
// Same markup as the tooth-entry warnings a few sections up, with its own
// heading so the two lists are distinguishable to a screen reader as well as by
// position.

interface Props {
  warnings: string[];
}

export function ParseWarnings({ warnings }: Props) {
  if (warnings.length === 0) return null;

  return (
    <div
      className="border-urgency-moderate/50 mt-3 border-l-2 pl-3"
      role="group"
      aria-label="Ostrzeżenia z wypełniania notatki"
    >
      <p className="text-urgency-moderate-ink text-xs font-medium">Z notatki nie udało się odczytać wszystkiego:</p>
      <ul className="text-muted-foreground mt-1 space-y-0.5 text-xs">
        {/* Keyed by position, not by the message: two items can legitimately
            produce identical wording, and the model's own warnings are free text
            it may well repeat. The list is read-only and never reordered. */}
        {warnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    </div>
  );
}
