// The patient-link copy action (S-03), lifted out of ApprovalConfirmation.
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
    <Button type="button" onClick={() => void copy()}>
      {copied ? "Skopiowano ✓" : "Kopiuj link"}
    </Button>
  );
}
