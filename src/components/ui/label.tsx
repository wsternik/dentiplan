import * as React from "react";
import { Label as LabelPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

// `leading-snug`, not shadcn's `leading-none`. That default assumes a one-word
// label sitting beside a checkbox; this editor uses Label for two full
// sentences that wrap ("Tylko do Twojej referencji…", "Pole robocze…"), and
// solid leading on wrapped label text is unreadable.

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-snug font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
