// The tooth chart (S-06, FR-074/FR-076).
//
// Controlled and stateless about the plan: everything it draws arrives as
// `teeth`, so it cannot drift from the `content` tree that the text picker and
// the note prefill also write to. The only state it owns is which tooth is
// currently hovered or focused, which is a property of the pointer, not of the
// quote.
//
// Three behaviours out of two modes. The patient's chart is `read-only`: inert,
// but hoverable, tappable and keyboard-reachable, because the tooltip is the
// point. The editor's is `interactive`: a click acts. An approved quote's
// editor is `read-only` again — FR-053 freezes the quote, it does not freeze the
// tooltip. That last distinction is why we did not install `react-odontogram`,
// whose `readOnly` removes `pointer-events` and takes the tooltip with it.
//
// A tooth is a `<g>` with `role="button"` (or `role="img"` when nothing will
// happen) rather than a real `<button>`: an HTML button inside an `<svg>` is not
// valid content and needs a `<foreignObject>` wrapper that breaks the drawing's
// coordinate space. `tabIndex` + `role` + `aria-label` + a keydown handler is
// the accessible-SVG form of the same thing, and it is what the semantics in the
// plan's contract ask for.

import { useRef, useState, type KeyboardEvent } from "react";

import { formatRangeHeadline } from "@/lib/quote/format";
import { CHART_VIEWBOX_PADDED, toothTransform } from "@/lib/tooth-chart/geometry";
import type { ChartTooth } from "@/lib/tooth-chart/model";
import { TOOTH_SHAPES, SLOT_TRANSFORMS } from "@/lib/tooth-chart/paths";
import { HATCH_OVERLAY_CLASSES, HATCH_PATTERN_ID, needsHatch, toothClasses } from "@/lib/tooth-chart/style";
import { chartLabel } from "@/lib/tooth-chart/label";
import { cn } from "@/lib/utils";

import { ToothTooltip } from "./ToothTooltip";

interface Props {
  teeth: ChartTooth[];
  mode: "read-only" | "interactive";
  onToothClick?: (number: number) => void;
}

interface Active {
  tooth: ChartTooth;
  /** The tooth's box in the chart container's own coordinate space, in pixels. */
  at: { x: number; top: number; bottom: number };
}

/**
 * What a screen reader says. Polish tooth name, treatment, status and the
 * standard-plan amount — never "Tooth 11", and never the FDI number alone,
 * which is the notation the patient does not read.
 */
function labelFor(tooth: ChartTooth): string {
  if (!tooth.inQuote) return `${tooth.name} — nieobjęty planem`;
  return [
    tooth.name,
    tooth.treatmentLabel,
    tooth.statusLabel,
    tooth.cost !== null ? `koszt w planie podstawowym: ${formatRangeHeadline(tooth.cost)}` : null,
  ]
    .filter((part) => part !== null)
    .join(", ");
}

export function ToothChart({ teeth, mode, onToothClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<Active | null>(null);

  const interactive = mode === "interactive";

  // Teeth the quote holds are drawn last, so they sit above the plain outlines
  // and win hit-testing. It matters wherever two teeth share a slot: a milk
  // tooth and the unplanned permanent outline underneath it occupy the same
  // coordinates, and drawing in list order would put the outline on top of the
  // tooth that is actually in the plan.
  const ordered = [...teeth].sort((a, b) => Number(a.inQuote) - Number(b.inQuote));

  function show(tooth: ChartTooth, element: SVGGElement) {
    const container = containerRef.current;
    if (container === null) return;
    const box = element.getBoundingClientRect();
    const frame = container.getBoundingClientRect();
    setActive({
      tooth,
      at: {
        x: box.left + box.width / 2 - frame.left,
        top: box.top - frame.top,
        bottom: box.bottom - frame.top,
      },
    });
  }

  function activate(tooth: ChartTooth) {
    if (interactive) onToothClick?.(tooth.number);
  }

  function onKeyDown(event: KeyboardEvent<SVGGElement>, tooth: ChartTooth) {
    // WCAG 1.4.13: content that appears on hover or focus must be dismissible
    // without moving the pointer or the focus. The tooltip covers the teeth
    // around the one it describes, so a reader who cannot see it needs a way to
    // put it away while staying where she is.
    if (event.key === "Escape") {
      setActive(null);
      return;
    }
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    activate(tooth);
  }

  return (
    <div
      ref={containerRef}
      className="tooth-chart bg-muted/50 relative mx-auto w-full max-w-[260px] rounded-lg p-3 sm:max-w-[420px]"
    >
      <svg
        viewBox={CHART_VIEWBOX_PADDED}
        className="h-auto w-full"
        role="group"
        aria-label="Schemat uzębienia z zaznaczonym zakresem leczenia"
        onMouseLeave={() => {
          // Only the pointer's tooltip is the pointer's to close. A tooth
          // reached with the keyboard keeps its tooltip until it loses focus or
          // the reader presses Escape — otherwise a mouse drifting off the
          // drawing silently takes away what the keyboard reader is reading.
          setActive((current) => {
            if (current === null) return null;
            const focused = containerRef.current?.contains(document.activeElement) ?? false;
            return focused ? current : null;
          });
        }}
      >
        <defs>
          {/* The `out-of-current-plan` hatch. An SVG pattern rather than a CSS
              gradient: this drawing is printed, and print drops background
              images unless the reader opts in. */}
          <pattern
            id={HATCH_PATTERN_ID}
            width="5"
            height="5"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="5" className="stroke-foreground" strokeWidth="0.9" />
          </pattern>
        </defs>

        {ordered.map((tooth) => {
          const shape = TOOTH_SHAPES[tooth.shapeIndex];
          const focusable = interactive || tooth.inQuote;
          return (
            <g
              key={tooth.number}
              transform={SLOT_TRANSFORMS[tooth.slot]}
              // The slot transform mirrors the whole coordinate space, so the
              // per-tooth transform has to be applied inside it — an outward
              // displacement stays outward in every quadrant that way.
              className={cn(interactive && "cursor-pointer")}
            >
              <g
                transform={toothTransform(tooth)}
                role={interactive ? "button" : "img"}
                aria-label={labelFor(tooth)}
                tabIndex={focusable ? 0 : -1}
                className={cn(
                  "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2",
                  !focusable && "pointer-events-none",
                )}
                onMouseEnter={(event) => {
                  show(tooth, event.currentTarget);
                }}
                onFocus={(event) => {
                  show(tooth, event.currentTarget);
                }}
                onBlur={() => {
                  setActive(null);
                }}
                onClick={() => {
                  activate(tooth);
                }}
                onKeyDown={(event) => {
                  onKeyDown(event, tooth);
                }}
              >
                <path d={shape.outlinePath} className={toothClasses(tooth)} />
                {needsHatch(tooth) && (
                  <path d={shape.outlinePath} fill={`url(#${HATCH_PATTERN_ID})`} className={HATCH_OVERLAY_CLASSES} />
                )}
              </g>
            </g>
          );
        })}

        {/* Labels are a separate, unmirrored layer. Putting text inside the
            mirrored quadrant groups would reverse the FDI numbers. */}
        {ordered.map((tooth) => {
          const label = chartLabel(tooth);
          return label === null ? null : (
            <text
              key={`label-${tooth.number}`}
              x={label.x}
              y={label.y}
              textAnchor="middle"
              dominantBaseline="central"
              aria-hidden="true"
              className="fill-muted-foreground pointer-events-none font-sans text-[12px] font-medium"
            >
              {label.text}
            </text>
          );
        })}
      </svg>

      {active !== null && <ToothTooltip tooth={active.tooth} at={active.at} />}
    </div>
  );
}
