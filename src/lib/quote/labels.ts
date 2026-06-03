// Polish display labels for the content-level enums (FR-023/FR-024/FR-027).
// Pure; shared by the admin editor (Phase 2) and the patient page (Phase 4).

import type { Dentition, ToothStatus, TreatmentType, Urgency } from "@/types";

export const TREATMENT_LABELS: Record<TreatmentType, string> = {
  extraction: "ekstrakcja",
  "root-canal": "leczenie kanałowe",
  "caries-removal": "usunięcie próchnicy",
  filling: "wypełnienie",
  other: "inne",
};

export const URGENCY_LABELS: Record<Urgency, string> = {
  urgent: "pilne",
  moderate: "umiarkowane",
  mild: "łagodne",
};

export const STATUS_LABELS: Record<ToothStatus, string> = {
  "in-plan": "w planie",
  uncertain: "niepewne",
  "out-of-current-plan": "poza bieżącym planem",
};

export const DENTITION_LABELS: Record<Dentition, string> = {
  milk: "mleczny",
  permanent: "stały",
};
