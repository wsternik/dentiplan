// The wire contract for S-02: the only shape the model is allowed to answer in,
// and the shape the parse endpoint hands back to the editor.
//
// Two deliberate departures from the domain types in `src/types.ts`:
//
// 1. NO NULLABLES. `treatmentType` and `urgency` carry an explicit `"unknown"`
//    member and `visitNumber` uses `0` for "not assigned", rather than
//    `.nullable()`. Anthropic's structured output has already rejected one
//    JSON-Schema construct on this repo (`minimum`/`maximum` on a number — see
//    `scripts/review/agent.ts`), and a schema the provider refuses fails at
//    runtime, not in a test. Translating the sentinels back into the `null`s
//    `ToothEntry` stores happens in `mapParsedDiagnosis`, which is tested.
//
// 2. NO `note`. `ToothEntry.note` lives inside `content`, and `content` is
//    returned verbatim to anyone holding the patient link (see the INVARIANT in
//    `src/types.ts` and `docs/reference/contract-surfaces.md`). The model has
//    just read the dentystka's confidential diagnosis; it does not get a pen on
//    the patient's page. Context that would have gone into a note goes into
//    `warnings`, which only she sees.
//
// `number` is deliberately NOT range-constrained here: the provider rejects
// numeric bounds, so tooth 99 arrives schema-valid and only code can stop it.
// That is risk #7, and it is enforced in `parse-diagnosis.ts`.

import { z } from "zod";

import { ToothStatusSchema, TreatmentTypeSchema, UrgencySchema } from "@/types";
import type { PricelistItemRef, ToothEntry, Visit } from "@/types";

/** Sentinel the model uses when the note does not say. Mapped to `null`. */
export const UNKNOWN = "unknown";

const ParsedToothSchema = z.object({
  number: z.number().int().describe("FDI tooth number, 11-48 for permanent teeth or 51-85 for milk teeth"),
  treatmentType: z.enum([...TreatmentTypeSchema.options, UNKNOWN]).describe('Use "unknown" if the note does not say'),
  urgency: z.enum([...UrgencySchema.options, UNKNOWN]).describe('Use "unknown" if the note does not say'),
  status: ToothStatusSchema.describe('Use "uncertain" for a tooth the note marks with a question mark, e.g. "(32?)"'),
  pricelistItemIds: z.array(z.string()).describe("Ids from the per-tooth catalog only. Never invent an id."),
  visitNumber: z.number().int().describe("Number of a visit declared in `visits`, or 0 when not assigned"),
});

export const ParsedDiagnosisSchema = z.object({
  teeth: z.array(ParsedToothSchema),
  generalItemIds: z.array(z.string()).describe("Ids from the general catalog only, for whole-visit items"),
  visits: z.array(z.object({ number: z.number().int(), label: z.string() })),
  warnings: z.array(z.string()).describe("Phrases from the note you could not place. Never guess instead."),
});

export type ParsedDiagnosis = z.infer<typeof ParsedDiagnosisSchema>;

/**
 * What the endpoint returns. `generalItems` are resolved refs without ids —
 * the editor owns the `g-<n>` sequence and seeds it past whatever a reopened
 * draft already restored, so minting ids here would risk a collision.
 */
export interface PrefillResult {
  content: {
    teeth: ToothEntry[];
    visits: Visit[];
    generalItems: PricelistItemRef[];
  };
  warnings: string[];
}
