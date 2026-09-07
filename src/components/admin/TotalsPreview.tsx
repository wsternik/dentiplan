// Live two-variant totals (FR-032/FR-064), recomputed on every change via the
// pure Phase-1 cost engine. The anesthesia variant is labeled recommended.

import { Badge } from "@/components/ui/badge";
import type { QuoteTotals } from "@/types";
import { formatPln, formatRange } from "./format";

export function TotalsPreview({ totals }: { totals: QuoteTotals }) {
  const standard = totals.standard;
  const anesthesia = totals.anesthesia;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="border-border border-l-border/80 rounded-md border border-l-[3px] p-3">
        <h3 className="mb-2 text-sm font-semibold tracking-tight">Wariant standardowy (wiele wizyt)</h3>
        {standard && standard.perVisit.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {standard.perVisit.map((entry) => (
              <li key={entry.visitNumber} className="flex justify-between gap-4">
                <span className="text-muted-foreground">Wizyta {entry.visitNumber}</span>
                <span className="numeric">{formatRange(entry.cost)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">Brak pozycji przypisanych do wizyt.</p>
        )}
        <div className="border-border mt-2 flex justify-between gap-4 border-t pt-2 text-sm font-semibold">
          <span>Razem</span>
          <span className="numeric">{standard?.grandTotal ? formatRange(standard.grandTotal) : formatPln(0)}</span>
        </div>
      </div>

      <div className="border-border border-l-primary rounded-md border border-l-[6px] p-3">
        <h3 className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold tracking-tight">
          Wariant w narkozie (jedna sesja)
          <Badge>rekomendowane</Badge>
        </h3>
        {anesthesia ? (
          <div className="space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Opłata za narkozę</span>
              <span className="numeric">{formatPln(anesthesia.fee)}</span>
            </div>
            <div className="border-border mt-2 flex justify-between gap-4 border-t pt-2 font-semibold">
              <span>Razem</span>
              <span className="numeric">{formatRange(anesthesia.total)}</span>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">—</p>
        )}
      </div>
    </div>
  );
}
