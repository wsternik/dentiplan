// Small shared form controls for the admin editor — a styled native <select>
// (lighter than a Radix popover for a dense data form) matching the shadcn
// Input look, plus a section wrapper.

import type { ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const selectBase =
  "h-9 w-full min-w-0 rounded-md border border-input bg-card px-3 py-1 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50";

/** Native select styled to match the shadcn Input. */
export function NativeSelect({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(selectBase, className)} {...props}>
      {children}
    </select>
  );
}

/** Editor sections can carry a compact toolbar without repeating surfaces. */
export function Section({
  title,
  children,
  actions,
  compact = false,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
}) {
  return (
    <section className="border-border bg-card rounded-md border p-4">
      <div className={cn("mb-3 flex flex-wrap items-center justify-between gap-2", compact && "sr-only")}>
        <h2 className="text-foreground text-lg font-semibold tracking-tight">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}
