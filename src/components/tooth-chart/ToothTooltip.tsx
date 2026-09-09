// The chart's tooltip (S-06).
//
// Ours, on S8 tokens, for one reason: a Radix tooltip answers hover and focus
// and not tap, and the patient reading this page is on a phone. Here focus is
// the mechanism — every tooth is a focusable element, and a tap focuses it — so
// the same code path serves mouse, keyboard and touch, and there is no
// touch-specific branch that can rot.
//
// Positioning is a `left`/`top` in the chart container's own coordinate space,
// handed in by the chart, which measures the focused tooth against the
// container. No positioner is copied and none is installed: the only placement
// rule is one flip — a tooth near the top of the arch has no room above it, so
// its tooltip goes underneath instead of over the section heading.
//
// `no-print`: the tooltip is a screen affordance. On paper the same facts are
// in the grouped list below, in full sentences.

import { formatRangeHeadline } from "@/lib/quote/format";
import { cn } from "@/lib/utils";
import type { ChartTooth } from "@/lib/tooth-chart/model";

interface Props {
  tooth: ChartTooth;
  /** The tooth's box, in pixels relative to the chart container. */
  at: { x: number; top: number; bottom: number };
}

/**
 * Below this many pixels of headroom the tooltip flips under the tooth instead
 * of over it. The teeth this saves are the incisors at the top of the arch —
 * the ones nearest the reader's eye, and the first thing a patient hovers.
 */
const HEADROOM = 64;

export function ToothTooltip({ tooth, at }: Props) {
  const lines = [tooth.treatmentLabel, tooth.statusLabel].filter((line) => line !== null);
  const below = at.top < HEADROOM;

  return (
    <div
      role="tooltip"
      aria-hidden="true"
      className={cn(
        "no-print bg-popover text-popover-foreground border-border pointer-events-none absolute z-10 max-w-[15rem] min-w-[9rem] -translate-x-1/2 rounded-lg border px-3 py-2.5 font-sans text-xs shadow-[0_14px_30px_-20px_color-mix(in_oklch,var(--foreground)_55%,transparent)]",
        !below && "-translate-y-full",
      )}
      style={{ left: at.x, top: below ? at.bottom + 8 : at.top - 8 }}
    >
      <p className="font-medium">{tooth.name}</p>
      {lines.length > 0 && <p className="text-muted-foreground mt-0.5">{lines.join(", ")}</p>}
      {tooth.cost !== null && (
        // Named as the standard plan's amount, never as "the cost of this
        // tooth": the anesthesia variant's fee is a property of the whole set
        // and is not attributable to one tooth. A tooltip whose arithmetic
        // disagrees with the total printed underneath it is the worst defect
        // available on this page.
        <p className="mt-1">
          <span className="text-muted-foreground">W planie podstawowym: </span>
          {formatRangeHeadline(tooth.cost)}
        </p>
      )}
    </div>
  );
}
