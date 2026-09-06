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
    <details open className="border-urgency-moderate/50 mt-3 rounded border p-3 text-sm">
      <summary className="cursor-pointer font-medium">Do przejrzenia ({warnings.length})</summary>
      <p className="mt-2">Czego nie odczytano z notatki i co model zaproponował sam:</p>
      <ul className="mt-2 list-disc space-y-2 pl-5">
        {warnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    </details>
  );
}
