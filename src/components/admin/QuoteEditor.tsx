// The new-quote editor island (S-01, Phase 2). Owns the entire working
// `QuoteContent` tree in client state, renders every section, and derives both
// cost variants live via the pure Phase-1 engine. No persistence here — the
// Approve action is wired to the server endpoint in Phase 3.
//
// PATIENT-SAFE INVARIANT: `rawText` is a transient scratch field held in island
// state only. It is never part of the approval payload and never persisted —
// `content` returned to anon callers must never carry the raw diagnosis.

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { computeQuoteTotals } from "@/lib/quote/cost";
import { isValidToothNumber } from "@/lib/quote/tooth-name";
import type { GeneralItem, PatientType, PricelistItemRef, ToothEntry, Visit } from "@/types";
import { Section } from "./controls";
import { GeneralItems } from "./GeneralItems";
import { ToothRow } from "./ToothRow";
import { TotalsPreview } from "./TotalsPreview";
import { VisitList } from "./VisitList";
import type { PickerOption, QuoteEditorProps } from "./types";

/** Drop the picker-only `category` field down to the stored snapshot ref. */
function toRef(option: PickerOption): PricelistItemRef {
  return { id: option.id, name: option.name, price: option.price, localAnesthesia: option.localAnesthesia };
}

export default function QuoteEditor({ toothOptions, generalOptions }: QuoteEditorProps) {
  const [patientType, setPatientType] = useState<PatientType>("adult");
  const [teeth, setTeeth] = useState<ToothEntry[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [generalItems, setGeneralItems] = useState<GeneralItem[]>([]);
  const [rawText, setRawText] = useState("");
  const [toothInput, setToothInput] = useState("");
  const [toothWarnings, setToothWarnings] = useState<string[]>([]);
  const generalCounter = useRef(0);

  const totals = useMemo(() => computeQuoteTotals({ teeth, visits, generalItems }), [teeth, visits, generalItems]);

  // --- Tooth entry (FR-021/FR-012) ---
  function addTeeth() {
    const tokens = toothInput.split(/[\s,]+/).filter(Boolean);
    const warnings: string[] = [];
    const seen = new Set(teeth.map((t) => t.number));
    const additions: ToothEntry[] = [];

    for (const token of tokens) {
      const n = Number(token);
      if (!Number.isInteger(n) || !isValidToothNumber(n)) {
        warnings.push(`Nieprawidłowy numer zęba: ${token}`);
        continue;
      }
      if (seen.has(n)) {
        warnings.push(`Ząb ${n} jest już dodany`);
        continue;
      }
      seen.add(n);
      additions.push({
        number: n,
        treatmentType: null,
        urgency: null,
        status: "in-plan",
        note: "",
        pricelistItems: [],
        visitNumber: null,
      });
    }

    if (additions.length > 0) setTeeth((prev) => [...prev, ...additions].sort((a, b) => a.number - b.number));
    setToothWarnings(warnings);
    setToothInput("");
  }

  function patchTooth(number: number, patch: Partial<ToothEntry>) {
    setTeeth((prev) => prev.map((t) => (t.number === number ? { ...t, ...patch } : t)));
  }
  function removeTooth(number: number) {
    setTeeth((prev) => prev.filter((t) => t.number !== number));
  }
  function addToothItem(number: number, option: PickerOption) {
    setTeeth((prev) =>
      prev.map((t) => (t.number === number ? { ...t, pricelistItems: [...t.pricelistItems, toRef(option)] } : t)),
    );
  }
  function removeToothItem(number: number, index: number) {
    setTeeth((prev) =>
      prev.map((t) =>
        t.number === number ? { ...t, pricelistItems: t.pricelistItems.filter((_, i) => i !== index) } : t,
      ),
    );
  }

  // --- Visits (FR-031): sequential numbers; removal renumbers + remaps refs ---
  function addVisit() {
    setVisits((prev) => [...prev, { number: prev.length + 1, label: "" }]);
  }
  function setVisitLabel(number: number, label: string) {
    setVisits((prev) => prev.map((v) => (v.number === number ? { ...v, label } : v)));
  }
  function removeVisit(number: number) {
    setVisits((prev) => {
      const remaining = prev.filter((v) => v.number !== number).sort((a, b) => a.number - b.number);
      const remap = new Map<number, number>();
      remaining.forEach((v, i) => remap.set(v.number, i + 1));
      const renumber = (vn: number | null) => (vn === null ? null : (remap.get(vn) ?? null));
      setTeeth((ts) => ts.map((t) => ({ ...t, visitNumber: renumber(t.visitNumber) })));
      setGeneralItems((gs) => gs.map((g) => ({ ...g, visitNumber: renumber(g.visitNumber) })));
      return remaining.map((v, i) => ({ ...v, number: i + 1 }));
    });
  }

  // --- General items (FR-029) ---
  function addGeneral(option: PickerOption) {
    generalCounter.current += 1;
    setGeneralItems((prev) => [...prev, { id: `g-${generalCounter.current}`, item: toRef(option), visitNumber: null }]);
  }
  function removeGeneral(id: string) {
    setGeneralItems((prev) => prev.filter((g) => g.id !== id));
  }
  function setGeneralVisit(id: string, visitNumber: number | null) {
    setGeneralItems((prev) => prev.map((g) => (g.id === id ? { ...g, visitNumber } : g)));
  }

  // --- Approve gating (essential guards; server re-checks in Phase 3) ---
  const isEmpty = teeth.length === 0 && generalItems.length === 0;
  const hasUnpriced = teeth.some((t) => t.status === "in-plan" && t.pricelistItems.length === 0);
  const approveDisabled = isEmpty || hasUnpriced;
  const approveReason = isEmpty
    ? "Dodaj co najmniej jeden ząb lub pozycję ogólną."
    : hasUnpriced
      ? "Każdy ząb w planie musi mieć pozycję z cennika."
      : null;

  function handleApprove() {
    // Wired to POST /api/admin/quotes/approve in Phase 3.
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <h1 className="text-2xl font-bold">Nowy kosztorys</h1>

      <Section title="Notatka z diagnozy (roboczo)">
        <Label htmlFor="rawText" className="text-muted-foreground mb-1">
          Pole robocze — nie jest zapisywane ani widoczne dla pacjenta.
        </Label>
        <Textarea
          id="rawText"
          rows={4}
          placeholder="Wklej opis diagnozy do pomocy przy wypełnianiu…"
          value={rawText}
          onChange={(e) => {
            setRawText(e.target.value);
          }}
        />
      </Section>

      <Section title="Typ pacjenta">
        <div className="flex gap-2">
          <Button
            type="button"
            variant={patientType === "child" ? "default" : "outline"}
            onClick={() => {
              setPatientType("child");
            }}
          >
            Dziecko
          </Button>
          <Button
            type="button"
            variant={patientType === "adult" ? "default" : "outline"}
            onClick={() => {
              setPatientType("adult");
            }}
          >
            Dorosły
          </Button>
        </div>
      </Section>

      <Section title="Zęby">
        <div className="flex gap-2">
          <input
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
            placeholder="Numery FDI, np. 17,16,34"
            value={toothInput}
            onChange={(e) => {
              setToothInput(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTeeth();
              }
            }}
          />
          <Button type="button" onClick={addTeeth}>
            Dodaj
          </Button>
        </div>
        {toothWarnings.length > 0 && (
          <ul className="text-destructive mt-2 space-y-0.5 text-xs">
            {toothWarnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
        <div className="mt-3 space-y-3">
          {teeth.length === 0 && <p className="text-muted-foreground text-sm">Brak zębów. Dodaj numery powyżej.</p>}
          {teeth.map((tooth) => (
            <ToothRow
              key={tooth.number}
              tooth={tooth}
              visits={visits}
              options={toothOptions}
              onPatch={(patch) => {
                patchTooth(tooth.number, patch);
              }}
              onAddItem={(option) => {
                addToothItem(tooth.number, option);
              }}
              onRemoveItem={(index) => {
                removeToothItem(tooth.number, index);
              }}
              onRemove={() => {
                removeTooth(tooth.number);
              }}
            />
          ))}
        </div>
      </Section>

      <Section title="Wizyty">
        <VisitList visits={visits} onAdd={addVisit} onRemove={removeVisit} onLabelChange={setVisitLabel} />
      </Section>

      <Section title="Pozycje ogólne">
        <GeneralItems
          items={generalItems}
          options={generalOptions}
          visits={visits}
          onAdd={addGeneral}
          onRemove={removeGeneral}
          onVisitChange={setGeneralVisit}
        />
      </Section>

      <Section title="Podgląd kosztów">
        <TotalsPreview totals={totals} />
      </Section>

      <div className="flex flex-col items-start gap-2">
        <Button type="button" size="lg" disabled={approveDisabled} onClick={handleApprove}>
          Zatwierdź
        </Button>
        {approveReason && <p className="text-muted-foreground text-sm">{approveReason}</p>}
      </div>
    </div>
  );
}
