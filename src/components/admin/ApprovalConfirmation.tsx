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
    <div className="bg-card mx-auto my-8 max-w-2xl space-y-5 rounded border px-6 py-8">
      <h1 className="font-serif text-3xl font-medium tracking-tight">Kosztorys zatwierdzony</h1>
      <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
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
          className="border-border bg-card hover:bg-accent inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-medium tracking-tight transition-colors"
        >
          Lista kosztorysów
        </a>
      </div>
    </div>
  );
}
