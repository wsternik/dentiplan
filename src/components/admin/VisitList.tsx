// Visit management (FR-031): add/remove visits with sequential renumbering
// (handled by the parent so tooth/general references stay consistent). Each
// visit's partial cost is shown in TotalsPreview, not here.

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Visit } from "@/types";

interface Props {
  visits: Visit[];
  onAdd: () => void;
  onRemove: (number: number) => void;
  onLabelChange: (number: number, label: string) => void;
  /** Approved quotes are frozen (FR-053). */
  readOnly?: boolean;
}

export function VisitList({ visits, onAdd, onRemove, onLabelChange, readOnly }: Props) {
  return (
    <div className="space-y-2">
      {visits.length === 0 && <p className="text-muted-foreground text-sm">Brak wizyt. Dodaj pierwszą wizytę.</p>}
      {visits.map((visit) => (
        <div key={visit.number} className="flex items-center gap-2">
          <span className="text-foreground w-20 shrink-0 text-sm font-medium">Wizyta {visit.number}</span>
          <Input
            readOnly={readOnly}
            placeholder="Opis wizyty (opcjonalnie)"
            value={visit.label}
            onChange={(e) => {
              onLabelChange(visit.number, e.target.value);
            }}
          />
          {!readOnly && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Usuń wizytę ${visit.number}`}
              onClick={() => {
                onRemove(visit.number);
              }}
            >
              <X />
            </Button>
          )}
        </div>
      ))}
      {!readOnly && (
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus /> Dodaj wizytę
        </Button>
      )}
    </div>
  );
}
