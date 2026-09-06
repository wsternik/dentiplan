// The chart's legend (S-06, FR-075).
//
// React rather than Astro. The editor page renders only `<QuoteEditor
// client:load />`, and a React island cannot import an `.astro` component, so an
// Astro legend would be unusable on one of the two surfaces this legend has to
// serve.
//
// Every entry pairs its colour with something that is not a colour. The three
// statuses are drawn with the treatments they actually get on the chart — solid,
// dashed, dashed-plus-hatch — so the legend survives the black-and-white printer
// the same way the chart does. The urgency entries pair their swatch with the
// word set in that hue's `-ink` value: the swatch is the match to the drawing,
// the word is what is left when the page is photocopied.
//
// It prints. That is the point of drawing it with the same primitives rather
// than describing it.

import { STATUS_LABELS, URGENCY_LABELS } from "@/lib/quote/labels";
import { STATUS_SHAPE, URGENCY_FILL } from "@/lib/quote/marks";
import { HATCH_OVERLAY_CLASSES, HATCH_PATTERN_ID } from "@/lib/tooth-chart/style";
import type { ToothStatus, Urgency } from "@/types";

const URGENCY_INK: Record<Urgency, string> = {
  urgent: "text-urgency-urgent-ink",
  moderate: "text-urgency-moderate-ink",
  mild: "text-urgency-mild-ink",
};

const URGENCIES: Urgency[] = ["urgent", "moderate", "mild"];

const STATUSES: ToothStatus[] = ["in-plan", "uncertain", "out-of-current-plan"];

/** The legend's own hatch id. The chart's `<pattern>` lives in the chart's own
    `<svg>`, and a `url(#…)` reference does not cross document fragments in every
    engine — so the legend defines its own rather than borrowing one. */
const LEGEND_HATCH_ID = `${HATCH_PATTERN_ID}-legend`;

/** A 24×24 stand-in tooth, so the legend's marks are the chart's marks. */
function Swatch({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
      {children}
    </svg>
  );
}

const SWATCH_SHAPE = "M12 2c5 0 8 3 8 8s-3 12-8 12-8-7-8-12 3-8 8-8Z";

export function ChartLegend() {
  return (
    <div className="border-border text-muted-foreground mt-4 border-t pt-4 font-sans text-xs">
      <h3 className="text-foreground font-medium">Jak czytać schemat</h3>

      {/* One definition for the whole legend — a `<defs>` inside the status loop
          would emit the same id three times. */}
      <svg width="0" height="0" aria-hidden="true" className="absolute">
        <defs>
          <pattern
            id={LEGEND_HATCH_ID}
            width="5"
            height="5"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="5" className="stroke-foreground" strokeWidth="0.9" />
          </pattern>
        </defs>
      </svg>

      <div className="mt-3 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        <div>
          <p className="font-medium">Kolor — pilność</p>
          <ul className="mt-1.5 space-y-1.5">
            {URGENCIES.map((urgency) => (
              <li key={urgency} className="flex items-center gap-2">
                <Swatch>
                  <path d={SWATCH_SHAPE} className={`${URGENCY_FILL[urgency]} stroke-foreground [stroke-width:1.5]`} />
                </Swatch>
                <span className={URGENCY_INK[urgency]}>{URGENCY_LABELS[urgency]}</span>
              </li>
            ))}
            <li className="flex items-center gap-2">
              <Swatch>
                <path d={SWATCH_SHAPE} className={`${URGENCY_FILL.unknown} stroke-foreground [stroke-width:1.5]`} />
              </Swatch>
              <span>pilność nieokreślona</span>
            </li>
          </ul>
        </div>

        <div>
          <p className="font-medium">Obrys — status</p>
          <ul className="mt-1.5 space-y-1.5">
            {STATUSES.map((status) => (
              <li key={status} className="flex items-center gap-2">
                <Swatch>
                  <path d={SWATCH_SHAPE} className={`fill-urgency-unknown ${STATUS_SHAPE[status]}`} />
                  {status === "out-of-current-plan" && (
                    <path d={SWATCH_SHAPE} fill={`url(#${LEGEND_HATCH_ID})`} className={HATCH_OVERLAY_CLASSES} />
                  )}
                </Swatch>
                <span>{STATUS_LABELS[status]}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* The mixed-dentition approximation, named as one. The vendored geometry
          carries absolute coordinates — a shape is also its place on the arch —
          so there is no separate milk-tooth geometry to draw. A milk tooth is
          therefore drawn as its permanent successor's shape at 85%, which means
          a milk molar reads as a small premolar. It marks the right tooth in the
          right place; it is not an anatomical drawing, and saying so here is
          cheaper than a patient wondering why their child's molar looks wrong. */}
      <p className="mt-4">
        Zęby mleczne rysujemy mniejsze, w miejscu zęba stałego, który je zastąpi — schemat pokazuje położenie zęba, nie
        jego dokładny kształt.
      </p>
    </div>
  );
}
