// General (non-per-tooth) items (FR-029): higienizacja, pantomogram,
// konsultacja, etc. Each references a pricelist item via the picker and may be
// associated with a visit for that visit's partial cost (FR-032).

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
    <div className="space-y-2">
      {!readOnly && <PricelistPicker options={options} onAdd={onAdd} placeholder="Dodaj pozycję ogólną…" />}
      {items.length === 0 && <p className="text-muted-foreground text-sm">Brak pozycji ogólnych.</p>}
      {items.map((general) => (
        <div key={general.id} className="flex items-center gap-2">
          <Badge variant="outline" className="shrink-0">
            {general.item.name} · {formatPriceValue(general.item.price)}
          </Badge>
          {visits.length > 0 && (
            <NativeSelect
              className="max-w-56"
              disabled={readOnly}
              aria-label="Wizyta dla pozycji ogólnej"
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
    </div>
  );
}
