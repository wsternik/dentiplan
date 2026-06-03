// Small shared form controls for the admin editor — a styled native <select>
// (lighter than a Radix popover for a dense data form) matching the shadcn
// Input look, plus a section wrapper.

import type { ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const selectBase =
  "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50";

/** Native select styled to match the shadcn Input. */
export function NativeSelect({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(selectBase, className)} {...props}>
      {children}
    </select>
  );
}

/** A titled card section grouping a part of the editor. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-border bg-card rounded-lg border p-4 shadow-xs">
      <h2 className="text-foreground mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}
