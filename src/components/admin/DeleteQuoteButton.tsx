// Draft deletion control for the admin list (S-03).
//
// The only interactive element on an otherwise server-rendered page, hence the
// only island there. Deletion is unrecoverable — the quote and, for an approved
// one, the patient's live link — so it arms on the first click and only fires on
// the second. The repo has no dialog primitive and this does not warrant adding
// one.
//
// Rendered for `draft` rows only; the endpoint refuses approved rows anyway
// (FR-053), so this is defence in depth rather than the guard itself.

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  /** The draft's row id. */
  id: string;
}

export function DeleteQuoteButton({ id }: Props) {
  const [armed, setArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/quotes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Nie udało się usunąć szkicu.");
        setArmed(false);
        return;
      }
      window.location.reload();
    } catch {
      setError("Błąd połączenia. Spróbuj ponownie.");
      setArmed(false);
    } finally {
      setDeleting(false);
    }
  }

  if (error) {
    return <span className="text-destructive inline-block max-w-48 text-left text-xs leading-relaxed">{error}</span>;
  }

  if (!armed) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive hover:bg-destructive/8 hover:text-destructive"
        onClick={() => {
          setArmed(true);
        }}
      >
        Usuń
      </Button>
    );
  }

  return (
    <span className="flex flex-wrap items-center justify-end gap-1">
      <Button type="button" variant="destructive" size="sm" disabled={deleting} onClick={() => void remove()}>
        {deleting ? "Usuwanie…" : "Na pewno?"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={deleting}
        onClick={() => {
          setArmed(false);
        }}
      >
        Anuluj
      </Button>
    </span>
  );
}
