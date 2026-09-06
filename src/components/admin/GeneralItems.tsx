// General (non-per-tooth) items (FR-029): higienizacja, pantomogram,
// konsultacja, etc. Each references a pricelist item via the picker and may be
// associated with a visit for that visit's partial cost (FR-032).

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GeneralItem, Visit } from "@/types";
import { NativeSelect } from "./controls";
import { formatPriceValue } from "./format";
import { PricelistPicker } from "./PricelistPicker";
import type { PickerOption } from "@/lib/pricing";

interface Props {
  items: GeneralItem[];
  options: PickerOption[];
  visits: Visit[];
  onAdd: (option: PickerOption) => void;
  onRemove: (id: string) => void;
  onVisitChange: (id: string, visitNumber: number | null) => void;
  /** Approved quotes are frozen (FR-053). */
  readOnly?: boolean;
}

export function GeneralItems({ items, options, visits, onAdd, onRemove, onVisitChange, readOnly }: Props) {
  return (
    <section className="space-y-2 border-t py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-lg font-semibold">Pozycje ogólne</h2>
        {!readOnly && <PricelistPicker options={options} onAdd={onAdd} placeholder="Dodaj pozycję ogólną…" />}
      </div>
      {items.map((general) => (
        <div key={general.id} className="flex flex-wrap items-center gap-3 border-t py-3">
          <p className="min-w-0 flex-1 basis-48 text-sm">
            {general.item.name} · {formatPriceValue(general.item.price)}
          </p>
          {readOnly ? (
            <p className="text-sm">{general.visitNumber ? `Wizyta ${general.visitNumber}` : "Bez wizyty"}</p>
          ) : (
            visits.length > 0 && (
              <label className="text-sm">
                Wizyta
                <NativeSelect
                  className="max-w-56"
                  aria-label={`Wizyta dla pozycji ogólnej ${general.item.name}`}
                  value={general.visitNumber ?? ""}
                  onChange={(e) => {
                    onVisitChange(general.id, e.target.value ? Number(e.target.value) : null);
                  }}
                >
                  <option value="">— bez wizyty —</option>
                  {visits.map((visit) => (
                    <option key={visit.number} value={visit.number}>
                      Wizyta {visit.number}
                    </option>
                  ))}
                </NativeSelect>
              </label>
            )
          )}
          {!readOnly && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Usuń pozycję ${general.item.name}`}
              onClick={() => {
                onRemove(general.id);
              }}
            >
              <X />
            </Button>
          )}
        </div>
      ))}
    </section>
  );
}
