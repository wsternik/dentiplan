import { toothCenter } from "./geometry";
import type { ChartTooth } from "./model";

export interface ChartLabel {
  text: string;
  x: number;
  y: number;
}

/**
 * An opaque enamel plate isolates the small FDI number from every urgency fill.
 * The paired background/foreground tokens carry normal-text contrast in both
 * screen and print themes; the clinical fill is therefore never the text's
 * immediate background.
 */
export const CHART_LABEL_PLATE = { width: 22, height: 16, radius: 4 } as const;
export const CHART_LABEL_PLATE_CLASS = "fill-background stroke-border";
export const CHART_LABEL_TEXT_CLASS = "fill-foreground";

/** The subdued FDI number drawn at the centre of a planned tooth. */
export function chartLabel(tooth: ChartTooth): ChartLabel | null {
  if (!tooth.inQuote) return null;
  const [x, y] = toothCenter(tooth);
  return { text: String(tooth.number), x, y };
}
