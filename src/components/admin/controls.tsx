// Small shared form controls for the admin editor — a styled native <select>
// (lighter than a Radix popover for a dense data form) matching the shadcn
// Input look, plus a section wrapper.

import type { ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const selectBase =
  "h-9 w-full min-w-0 rounded-lg border border-input bg-card px-3 py-1 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50";

/** Native select styled to match the shadcn Input. */
export function NativeSelect({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(selectBase, className)} {...props}>
      {children}
    </select>
  );
}

/**
 * A titled block grouping a part of the editor. A hairline rule under the title
 * rather than a drop shadow around the box: in this palette structure is drawn
 * with rules, and depth is not a thing the form has.
 */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-border bg-card rounded-xl border p-4 sm:p-5">
      <h2 className="text-muted-foreground border-border mb-4 border-b pb-2 text-xs font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}
