import { toothCenter } from "./geometry";
import type { ChartTooth } from "./model";

export interface ChartLabel {
  text: string;
  x: number;
  y: number;
}

/** The subdued FDI number drawn at the centre of a planned tooth. */
export function chartLabel(tooth: ChartTooth): ChartLabel | null {
  if (!tooth.inQuote) return null;
  const [x, y] = toothCenter(tooth);
  return { text: String(tooth.number), x, y };
}
