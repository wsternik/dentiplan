// The copyable patient link control (S-03), lifted out of ApprovalConfirmation.
//
// Two surfaces need it now — the post-approval confirmation and the read-only
// view of an approved quote reopened from the list — but they need nothing else
// from each other: the confirmation announces "Kosztorys zatwierdzony" and offers
// a reset, which would be wrong wording and a wrong action on an old quote. So
// the shared part is exactly this control, not the whole view.

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  /** The `/p/<token>` path to share. */
  path: string;
}

export function CopyLink({ path }: Props) {
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
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        readOnly
        value={url}
        className="border-input focus-visible:border-ring focus-visible:ring-ring/50 bg-card h-9 w-full min-w-0 rounded-md border px-3 py-1 font-mono text-sm outline-none focus-visible:ring-[3px]"
        onFocus={(e) => {
          e.currentTarget.select();
        }}
      />
      <Button type="button" onClick={() => void copy()}>
        {copied ? "Skopiowano ✓" : "Kopiuj link"}
      </Button>
    </div>
  );
}
