// FR-012's warnings from a note prefill.
//
// These are not errors — the prefill succeeded. The list carries two kinds of
// entry, and the heading has to admit both. What the note did not yield: a
// phrase the model could not place, a tooth number outside FDI, a pricelist id
// that is not in the seed, an item offered in the wrong context. And, since the
// model started proposing a schedule (FR-014/FR-015), what it supplied on its
// own: an urgency it inferred, its reasoning for grouping these teeth together.
//
// The second kind are decisions waiting for her, not failures. Under a heading
// that announces failures they read as defects and get skimmed — which is
// exactly how a confident, wrong split gets approved unread. Showing them is the
// requirement (FR-012 says such cases are "surfaced as warnings on the form
// rather than auto-dropped or auto-accepted"); making them readable is what
// makes the requirement worth anything.
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
      className="border-urgency-moderate/50 bg-urgency-moderate/8 mt-4 min-w-0 rounded-xl border border-l-[3px] p-3 sm:p-4"
      role="group"
      aria-label="Do przejrzenia po wypełnieniu z notatki"
    >
      <p className="text-urgency-moderate-ink text-xs font-medium">
        Do przejrzenia — czego nie odczytano z notatki i co model zaproponował sam:
      </p>
      <ul className="text-muted-foreground mt-2 space-y-1 text-xs leading-relaxed break-words">
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
