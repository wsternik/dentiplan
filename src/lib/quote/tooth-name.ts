// FDI tooth-number → Polish name helper (S-01, FR-021).
//
// Pure, no UI/IO. Reused by the admin editor (live row labels) and the patient
// page (grouped tooth list). The FDI two-digit code encodes a quadrant (first
// digit) and a position (second digit); we map each to its Polish anatomical
// name and the quadrant's side + jaw, e.g.
//   74 → "74 — pierwszy trzonowiec mleczny lewy dolny".
//
// Out-of-range numbers are NOT silently coerced: `toothName` returns
// `INVALID_TOOTH_NAME` and `isValidToothNumber` returns false, so callers can
// surface a warning (FR-012) rather than render a bogus label.

import { dentitionForTooth } from "@/types";

/** Sentinel returned for any number that is not a valid FDI tooth code. */
export const INVALID_TOOTH_NAME = "nieprawidłowy numer zęba";

/** Permanent position names (FDI second digit 1–8), index 0 unused. */
const PERMANENT_POSITIONS = [
  "",
  "siekacz przyśrodkowy",
  "siekacz boczny",
  "kieł",
  "pierwszy przedtrzonowiec",
  "drugi przedtrzonowiec",
  "pierwszy trzonowiec",
  "drugi trzonowiec",
  "trzeci trzonowiec",
] as const;

/** Milk position names (FDI second digit 1–5), index 0 unused. */
const MILK_POSITIONS = [
  "",
  "siekacz przyśrodkowy mleczny",
  "siekacz boczny mleczny",
  "kieł mleczny",
  "pierwszy trzonowiec mleczny",
  "drugi trzonowiec mleczny",
] as const;

/** Side + jaw label per FDI quadrant (first digit 1–8). */
const QUADRANT_LABEL: Record<number, string> = {
  1: "prawy górny",
  2: "lewy górny",
  3: "lewy dolny",
  4: "prawy dolny",
  5: "prawy górny",
  6: "lewy górny",
  7: "lewy dolny",
  8: "prawy dolny",
};

/** Split an FDI code into its quadrant and position digits. */
function fdiParts(n: number): { quadrant: number; position: number } {
  return { quadrant: Math.floor(n / 10), position: n % 10 };
}

/**
 * True iff `n` is a valid FDI tooth code: permanent 11–18/21–28/31–38/41–48 or
 * milk 51–55/61–65/71–75/81–85. Used by the editor to flag out-of-range input.
 */
export function isValidToothNumber(n: number): boolean {
  if (!Number.isInteger(n)) return false;
  const { quadrant, position } = fdiParts(n);
  if (quadrant >= 1 && quadrant <= 4) return position >= 1 && position <= 8; // permanent
  if (quadrant >= 5 && quadrant <= 8) return position >= 1 && position <= 5; // milk
  return false;
}

/**
 * Polish name for an FDI tooth number (FR-021), e.g.
 * `"74 — pierwszy trzonowiec mleczny lewy dolny"`. Returns a sentinel string
 * (`<n> — nieprawidłowy numer zęba`) for out-of-range input so callers can flag
 * it instead of rendering a bogus label.
 */
export function toothName(n: number): string {
  if (!isValidToothNumber(n)) return `${n} — ${INVALID_TOOTH_NAME}`;
  const { quadrant, position } = fdiParts(n);
  const positionName = dentitionForTooth(n) === "milk" ? MILK_POSITIONS[position] : PERMANENT_POSITIONS[position];
  return `${n} — ${positionName} ${QUADRANT_LABEL[quadrant]}`;
}
