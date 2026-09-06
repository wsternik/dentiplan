import { Badge } from "@/components/ui/badge";
import type { QuoteTotals } from "@/types";
import { formatPln, formatRange } from "./format";

export function TotalsPreview({ totals }: { totals: QuoteTotals }) {
  const { standard, anesthesia } = totals;
  return (
    <section aria-label="Podgląd kosztów" className="totals-grid grid gap-3 sm:grid-cols-2">
      <div className="bg-card rounded border p-4">
        <h2 className="font-medium">
          Wariant standardowy <span className="text-muted-foreground block text-sm">Wiele wizyt</span>
        </h2>
        <p className="numeric my-3 text-3xl font-semibold tracking-tight">
          {standard?.grandTotal ? formatRange(standard.grandTotal) : formatPln(0)}
        </p>
        <details className="border-t pt-3 text-sm">
          <summary className="cursor-pointer">Szczegóły kosztów</summary>
          <ul className="mt-3 space-y-2">
            {standard?.perVisit.map((entry) => (
              <li key={entry.visitNumber} className="flex flex-wrap justify-between gap-2">
                <span>Wizyta {entry.visitNumber}</span>
                <span>{formatRange(entry.cost)}</span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground mt-2">
            Suma obejmuje także pozycje bez przypisania do wizyty. Zęby poza planem i niepewne nie są wliczane.
          </p>
        </details>
      </div>
      <div className="border-l-primary bg-card rounded border border-l-4 p-4">
        <h2 className="font-medium">
          Wariant w znieczuleniu <span className="text-muted-foreground block text-sm">Jedna sesja</span>
        </h2>
        <Badge className="mt-2">rekomendowane</Badge>
        <p className="numeric my-3 text-3xl font-semibold tracking-tight">
          {anesthesia ? formatRange(anesthesia.total) : "—"}
        </p>
        <details className="border-t pt-3 text-sm">
          <summary className="cursor-pointer">Szczegóły kosztów</summary>
          <p className="mt-3">Opłata za znieczulenie: {anesthesia ? formatPln(anesthesia.fee) : "—"}</p>
          <p className="text-muted-foreground mt-2">
            Wariant nie uwzględnia osobnych pozycji znieczulenia miejscowego.
          </p>
        </details>
      </div>
    </section>
  );
}
