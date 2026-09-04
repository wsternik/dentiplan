// Post-approval confirmation view (S-01, Phase 3 / FR-052).
//
// Shown immediately after a successful approve: announces the freeze, presents
// the immutable patient link, and offers a way to start a fresh quote. The link
// control itself lives in `CopyLink` — the read-only view of an approved quote
// reopened from the list (S-03) shares that, but not this view's wording or its
// reset action.

import { Button } from "@/components/ui/button";
import { CopyLink } from "./CopyLink";

interface Props {
  /** The `/p/<token>` path returned by the approval endpoint. */
  path: string;
  /** Reset the editor to a blank quote. */
  onReset: () => void;
}

export function ApprovalConfirmation({ path, onReset }: Props) {
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-2xl font-bold">Kosztorys zatwierdzony</h1>
      <p className="text-muted-foreground text-sm">
        Skopiuj poniższy link i przekaż go pacjentowi. Link jest aktywny od razu; zatwierdzonego kosztorysu nie można
        już edytować.
      </p>

      <CopyLink path={path} />

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onReset}>
          Nowy kosztorys
        </Button>
        <a
          href="/admin"
          className="border-input hover:bg-accent inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium"
        >
          Lista kosztorysów
        </a>
      </div>
    </div>
  );
}
