// One per-tooth row in the editor (FR-023–FR-030). Renders the derived name +
// dentition (display-only), the treatment/urgency/status selects, a free-text
// note, the category-grouped pricelist picker with its added items, and — only
// for `in-plan` teeth — a visit-number dropdown (FR-030).

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dentitionForTooth } from "@/types";
import type { ToothEntry, ToothStatus, TreatmentType, Urgency, Visit } from "@/types";
import { DENTITION_LABELS, STATUS_LABELS, TREATMENT_LABELS, URGENCY_LABELS } from "@/lib/quote/labels";
import { toothName } from "@/lib/quote/tooth-name";
import { NativeSelect } from "./controls";
import { formatPriceValue } from "./format";
import { PricelistPicker } from "./PricelistPicker";
import type { PickerOption } from "./types";

interface Props {
  tooth: ToothEntry;
  visits: Visit[];
  options: PickerOption[];
  onPatch: (patch: Partial<ToothEntry>) => void;
  onAddItem: (option: PickerOption) => void;
  onRemoveItem: (index: number) => void;
  onRemove: () => void;
  /** Approved quotes are frozen (FR-053): render the values, never a way to change them. */
  readOnly?: boolean;
}

export function ToothRow({ tooth, visits, options, onPatch, onAddItem, onRemoveItem, onRemove, readOnly }: Props) {
  const dentition = dentitionForTooth(tooth.number);
  const isInPlan = tooth.status === "in-plan";
  const unpriced = isInPlan && tooth.pricelistItems.length === 0;

  return (
    <div className="border-border rounded-md border p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="text-foreground text-sm font-medium">{toothName(tooth.number)}</div>
          <Badge variant="secondary" className="mt-1">
            {DENTITION_LABELS[dentition]}
          </Badge>
        </div>
        {!readOnly && (
          <Button type="button" variant="ghost" size="icon" aria-label={`Usuń ząb ${tooth.number}`} onClick={onRemove}>
            <X />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <NativeSelect
          disabled={readOnly}
          aria-label="Rodzaj leczenia"
          value={tooth.treatmentType ?? ""}
          onChange={(e) => {
            onPatch({ treatmentType: (e.target.value || null) as TreatmentType | null });
          }}
        >
          <option value="">— rodzaj leczenia —</option>
          {(Object.keys(TREATMENT_LABELS) as TreatmentType[]).map((key) => (
            <option key={key} value={key}>
              {TREATMENT_LABELS[key]}
            </option>
          ))}
        </NativeSelect>

        <NativeSelect
          disabled={readOnly}
          aria-label="Pilność"
          value={tooth.urgency ?? ""}
          onChange={(e) => {
            onPatch({ urgency: (e.target.value || null) as Urgency | null });
          }}
        >
          <option value="">— pilność —</option>
          {(Object.keys(URGENCY_LABELS) as Urgency[]).map((key) => (
            <option key={key} value={key}>
              {URGENCY_LABELS[key]}
            </option>
          ))}
        </NativeSelect>

        <NativeSelect
          disabled={readOnly}
          aria-label="Status"
          value={tooth.status}
          onChange={(e) => {
            const status = e.target.value as ToothStatus;
            // Only in-plan teeth carry a visit link (FR-030); clear it otherwise.
            onPatch(status === "in-plan" ? { status } : { status, visitNumber: null });
          }}
        >
          {(Object.keys(STATUS_LABELS) as ToothStatus[]).map((key) => (
            <option key={key} value={key}>
              {STATUS_LABELS[key]}
            </option>
          ))}
        </NativeSelect>
      </div>

      <Input
        className="mt-2"
        readOnly={readOnly}
        placeholder="Notatka (opcjonalnie)"
        value={tooth.note}
        onChange={(e) => {
          onPatch({ note: e.target.value });
        }}
      />

      <div className="mt-2">
        {!readOnly && <PricelistPicker options={options} onAdd={onAddItem} />}
        {tooth.pricelistItems.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {tooth.pricelistItems.map((item, index) => (
              <li key={`${item.id}-${index}`}>
                <Badge variant="outline" className="gap-1">
                  {item.name} · {formatPriceValue(item.price)}
                  {!readOnly && (
                    <button
                      type="button"
                      aria-label={`Usuń pozycję ${item.name}`}
                      onClick={() => {
                        onRemoveItem(index);
                      }}
                      className="text-muted-foreground hover:text-foreground ml-0.5"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        {unpriced && !readOnly && (
          <p className="text-destructive mt-1 text-xs">Ząb w planie wymaga pozycji z cennika.</p>
        )}
      </div>

      {isInPlan && visits.length > 0 && (
        <NativeSelect
          className="mt-2"
          disabled={readOnly}
          aria-label="Wizyta"
          value={tooth.visitNumber ?? ""}
          onChange={(e) => {
            onPatch({ visitNumber: e.target.value ? Number(e.target.value) : null });
          }}
        >
          <option value="">— bez przypisania do wizyty —</option>
          {visits.map((visit) => (
            <option key={visit.number} value={visit.number}>
              Wizyta {visit.number}
              {visit.label ? ` — ${visit.label}` : ""}
            </option>
          ))}
        </NativeSelect>
      )}
    </div>
  );
}
