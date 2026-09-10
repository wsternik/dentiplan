// Post-approval confirmation view (S-01, Phase 3 / FR-052).
//
// Shown immediately after a successful approve: announces the freeze, presents
// the immutable patient link, and offers a way to start a fresh quote. The link
// control itself lives in `CopyLink` — the read-only view of an approved quote
// reopened from the list (S-03) shares that, but not this view's wording or its
// reset action.

import { Button } from "@/components/ui/button";
import { CopyLink } from "./CopyLink";
import { QrCode } from "./QrCode";

interface Props {
  /** The `/p/<token>` path returned by the approval endpoint. */
  path: string;
  /** Reset the editor to a blank quote. */
  onReset: () => void;
}

export function ApprovalConfirmation({ path, onReset }: Props) {
  return (
    <div className="shell-workspace py-8 sm:py-12">
      <section className="border-border bg-card mx-auto max-w-2xl rounded-2xl border p-6 sm:p-9">
        <span className="bg-brand mb-4 block h-1 w-10 rounded-full" aria-hidden="true" />
        <h1 className="font-editorial text-3xl font-medium tracking-[-0.035em]">Kosztorys zatwierdzony</h1>
        <p className="text-muted-foreground mt-3 max-w-prose text-sm leading-relaxed">
          Skopiuj poniższy link i przekaż go pacjentowi. Link jest aktywny od razu; zatwierdzonego kosztorysu nie można
          już edytować.
        </p>

        <div className="bg-secondary/45 mt-7 space-y-4 rounded-xl p-4 sm:p-5">
          <CopyLink path={path} />
          <QrCode path={path} />
        </div>

        <div className="border-border mt-7 flex flex-wrap gap-2 border-t pt-5">
          <Button type="button" variant="outline" shape="pill" onClick={onReset}>
            Nowy kosztorys
          </Button>
          <a
            href="/admin"
            className="border-border bg-card hover:bg-accent focus-visible:ring-ring inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium tracking-tight transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Lista kosztorysów
          </a>
        </div>
      </section>
    </div>
  );
}
