// Visit management (FR-031): add/remove visits with sequential renumbering
// (handled by the parent so tooth/general references stay consistent). Each
// visit's partial cost is shown in TotalsPreview, not here.

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRange } from "./format";
import type { ToothEntry, QuoteTotals, Visit } from "@/types";

interface Props {
  visits: Visit[];
  teeth: ToothEntry[];
  totals: QuoteTotals;
  onAdd: () => void;
  onRemove: (number: number) => void;
  onLabelChange: (number: number, label: string) => void;
  /** Approved quotes are frozen (FR-053). */
  readOnly?: boolean;
}

export function VisitList({ visits, teeth, totals, onAdd, onRemove, onLabelChange, readOnly }: Props) {
  return (
    <div className="space-y-2">
      {visits.length === 0 && (
        <p className="text-muted-foreground text-sm">
          {readOnly ? "Brak wizyt." : "Brak wizyt. Dodaj pierwszą wizytę."}
        </p>
      )}
      {visits.map((visit) => {
        const cost = totals.standard?.perVisit.find((v) => v.visitNumber === visit.number)?.cost;
        return (
          <div key={visit.number} className="flex flex-wrap items-center gap-3 rounded border p-3">
            <span className="text-foreground w-20 shrink-0 text-sm font-medium">Wizyta {visit.number}</span>
            <label className="min-w-0 flex-1 basis-40 text-sm">
              Opis wizyty {visit.number}
              {readOnly ? (
                <p>{visit.label || "Bez opisu"}</p>
              ) : (
                <Input
                  aria-label={`Opis wizyty ${visit.number}`}
                  placeholder="Opis wizyty (opcjonalnie)"
                  value={visit.label}
                  onChange={(e) => {
                    onLabelChange(visit.number, e.target.value);
                  }}
                />
              )}
            </label>
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
            <div className="flex basis-full flex-wrap justify-between gap-2 text-sm">
              <span>
                Zęby:{" "}
                {teeth
                  .filter((t) => t.status === "in-plan" && t.visitNumber === visit.number)
                  .map((t) => t.number)
                  .join(", ") || "—"}
              </span>
              <span>{cost ? formatRange(cost) : "Brak przypisanych pozycji"}</span>
            </div>
          </div>
        );
      })}
      {!readOnly && visits.length > 0 && (
        <p className="text-muted-foreground text-sm">
          Usunięcie wizyty odpina jej pozycje i przenumerowuje kolejne wizyty.
        </p>
      )}

      {!readOnly && (
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus /> Dodaj wizytę
        </Button>
      )}
    </div>
  );
}
