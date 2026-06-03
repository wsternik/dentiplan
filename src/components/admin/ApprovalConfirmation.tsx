// Post-approval confirmation view (S-01, Phase 3 / FR-052).
//
// Shown after a successful approve: presents the immutable patient link in a
// copy-friendly form and a way to start a fresh quote. No list navigation — S-01
// has no browsable quote list (that's S-03).

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  /** The `/p/<token>` path returned by the approval endpoint. */
  path: string;
  /** Reset the editor to a blank quote. */
  onReset: () => void;
}

export function ApprovalConfirmation({ path, onReset }: Props) {
  const [copied, setCopied] = useState(false);
  // Absolute URL for the dentystka to share; origin is only known client-side.
  const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-2xl font-bold">Kosztorys zatwierdzony</h1>
      <p className="text-muted-foreground text-sm">
        Skopiuj poniższy link i przekaż go pacjentowi. Link jest aktywny od razu; zatwierdzonego kosztorysu nie można
        już edytować.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          readOnly
          value={url}
          className="border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 font-mono text-sm shadow-xs outline-none"
          onFocus={(e) => {
            e.currentTarget.select();
          }}
        />
        <Button type="button" onClick={copy}>
          {copied ? "Skopiowano ✓" : "Kopiuj link"}
        </Button>
      </div>

      <Button type="button" variant="outline" onClick={onReset}>
        Nowy kosztorys
      </Button>
    </div>
  );
}
