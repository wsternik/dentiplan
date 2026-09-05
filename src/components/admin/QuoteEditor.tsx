// The new-quote editor island (S-01, Phase 2). Owns the entire working
// `QuoteContent` tree in client state, renders every section, and derives both
// cost variants live via the pure Phase-1 engine. No persistence here — the
// Approve action is wired to the server endpoint in Phase 3.
//
// PATIENT-SAFE INVARIANT: `rawText` is a transient scratch field held in island
// state only. It is never part of the approval payload and never persisted —
// `content` returned to anon callers must never carry the raw diagnosis.

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { computeQuoteTotals } from "@/lib/quote/cost";
import { isValidToothNumber } from "@/lib/quote/tooth-name";
import type { GeneralItem, PatientType, PricelistItemRef, ToothEntry, Visit } from "@/types";
import { ApprovalConfirmation } from "./ApprovalConfirmation";
import { ParseWarnings } from "./ParseWarnings";
import { Section } from "./controls";
import { CopyLink } from "./CopyLink";
import { GeneralItems } from "./GeneralItems";
import { ToothRow } from "./ToothRow";
import { TotalsPreview } from "./TotalsPreview";
import { VisitList } from "./VisitList";
import type { PickerOption } from "@/lib/pricing";
import { mergePrefill } from "@/lib/llm/merge";
import type { PrefillResult } from "@/lib/llm/schema";
import type { QuoteEditorProps } from "./types";

/** Drop the picker-only `category` field down to the stored snapshot ref. */
function toRef(option: PickerOption): PricelistItemRef {
  return { id: option.id, name: option.name, price: option.price, localAnesthesia: option.localAnesthesia };
}

/**
 * Loose client-side e-mail check, for gating the Approve button only. The server
 * is authoritative (`PatientEmailSchema` in the payload service); duplicating Zod
 * here would drag the pricing seed into the browser bundle for nothing.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Seed the general-item counter past the highest stored `g-<n>` id, so items
 * added after rehydrating a draft cannot collide with restored ones.
 */
function highestGeneralIndex(items: GeneralItem[]): number {
  return items.reduce((max, item) => {
    const n = Number(/^g-(\d+)$/.exec(item.id)?.[1]);
    return Number.isInteger(n) && n > max ? n : max;
  }, 0);
}

export default function QuoteEditor({
  toothOptions,
  generalOptions,
  quoteId,
  initialContent,
  initialPatientType,
  initialPatientEmail,
  readOnly = false,
  patientToken,
}: QuoteEditorProps) {
  const [patientType, setPatientType] = useState<PatientType>(initialPatientType ?? "adult");
  // Teeth are sorted on hydration for the same reason `addTeeth` sorts on insert:
  // rows are keyed by number and the editor's invariant is ascending order.
  const [teeth, setTeeth] = useState<ToothEntry[]>(() =>
    [...(initialContent?.teeth ?? [])].sort((a, b) => a.number - b.number),
  );
  const [visits, setVisits] = useState<Visit[]>(initialContent?.visits ?? []);
  const [generalItems, setGeneralItems] = useState<GeneralItem[]>(initialContent?.generalItems ?? []);
  const [patientEmail, setPatientEmail] = useState(initialPatientEmail ?? "");
  const [rawText, setRawText] = useState("");
  const [toothInput, setToothInput] = useState("");
  const [toothWarnings, setToothWarnings] = useState<string[]>([]);

  // --- Note prefill (S-02, FR-011/FR-012) ---
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const generalCounter = useRef(highestGeneralIndex(initialContent?.generalItems ?? []));
  // Write lock for the two server-writing actions. A ref, because the `saving` /
  // `submitting` state flags are read through a closure: a second click in the
  // same tick sees the pre-update value and gets through. On the approval path
  // that would mint two immutable `approved` rows with two live patient links —
  // and an approved row can be neither edited nor deleted (FR-053), so the
  // duplicate would be permanent.
  const inFlight = useRef(false);

  // Latest-value mirrors of the working tree, for `applyPrefill`.
  //
  // The prefill's round trip can take up to 30s, and nothing stops the dentystka
  // from adding a tooth or a visit by hand while she waits. `applyPrefill` runs
  // after the `await`, so reading `teeth`/`visits`/`generalItems` from its
  // closure would see the tree as it was when she pressed the button: a tooth
  // she typed in the meantime would not be recognised as a duplicate (two rows,
  // one React key), and a visit she added would shift the numbering the
  // prefilled teeth are remapped onto.
  const treeRef = useRef({ teeth, visits, generalItems });
  useEffect(() => {
    treeRef.current = { teeth, visits, generalItems };
  }, [teeth, visits, generalItems]);

  // --- Approval (Phase 3) ---
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [approvedPath, setApprovedPath] = useState<string | null>(null);

  // --- Draft persistence (S-03) ---
  // `savedId` starts as the row this editor was opened from and is adopted after
  // the first save, so a second "Zapisz szkic" updates rather than duplicating.
  const [savedId, setSavedId] = useState<string | null>(quoteId ?? null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

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

  // --- The quote tree as every write endpoint accepts it: items BY ID only ---
  function treePayload() {
    return {
      patient_type: patientType,
      teeth: teeth.map((t) => ({
        number: t.number,
        treatmentType: t.treatmentType,
        urgency: t.urgency,
        status: t.status,
        note: t.note,
        pricelistItemIds: t.pricelistItems.map((i) => i.id),
        visitNumber: t.visitNumber,
      })),
      visits,
      generalItems: generalItems.map((g) => ({ id: g.id, itemId: g.item.id, visitNumber: g.visitNumber })),
    };
  }

  // --- Save as draft (S-03) ---
  // Explicit, never autosaved: an autosave would write a row for every abandoned
  // page-open, and the editor's other actions are deliberate too. The e-mail is
  // optional here — "start now, add the address after the consultation".
  async function handleSaveDraft() {
    // Ref, not the `saving` state: a second click landing in the same tick reads
    // the state through a stale closure and slips past. Two POSTs before
    // `savedId` is adopted would create two draft rows for one quote.
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setSaveError(null);
    const body = { ...treePayload(), patient_email: patientEmail.trim() || null };
    try {
      const res = savedId
        ? await fetch(`/api/admin/quotes/${savedId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/admin/quotes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setSaveError(data?.error ?? "Nie udało się zapisać szkicu.");
        return;
      }
      if (!savedId) {
        // Adopt the new row's id so the next save updates it instead of
        // creating a second draft.
        const data = (await res.json().catch(() => null)) as { id?: string } | null;
        if (data?.id) setSavedId(data.id);
      }
      setSavedAt(new Date().toLocaleTimeString("pl-PL"));
    } catch {
      setSaveError("Błąd połączenia. Spróbuj ponownie.");
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  // --- Note prefill (S-02) ---
  //
  // The merge itself is a pure function in `@/lib/llm/merge` with its own tests:
  // it has produced two defects already (a tooth proposed twice sharing a React
  // key, a merge computed against a stale snapshot) and a component is the wrong
  // place to argue about that. All this does is hand it the CURRENT tree — the
  // round trip is long enough for her to have added a tooth while she waited —
  // and put the answer back.
  //
  // `rawText` is the only thing sent, and it still never enters `treePayload()`.
  function applyPrefill(result: PrefillResult): string[] {
    const merged = mergePrefill(treeRef.current, result, generalCounter.current);
    generalCounter.current = merged.generalIdSeed;
    setTeeth(merged.teeth);
    setVisits(merged.visits);
    setGeneralItems(merged.generalItems);
    return merged.warnings;
  }

  async function handlePrefill() {
    if (inFlight.current) return;
    inFlight.current = true;
    setParsing(true);
    setParseError(null);
    try {
      const res = await fetch("/api/admin/quotes/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText }),
      });
      if (!res.ok) {
        // FR-013: the prefill is never a gate. Say so plainly and change nothing.
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setParseError(data?.error ?? "Nie udało się przetworzyć notatki — wypełnij formularz ręcznie.");
        return;
      }
      const result = (await res.json()) as PrefillResult;
      setParseWarnings(applyPrefill(result));
    } catch {
      setParseError("Nie udało się przetworzyć notatki — wypełnij formularz ręcznie.");
    } finally {
      inFlight.current = false;
      setParsing(false);
    }
  }

  // --- Approve gating (essential guards; server re-checks in Phase 3) ---
  const isEmpty = teeth.length === 0 && generalItems.length === 0;
  const hasUnpriced = teeth.some((t) => t.status === "in-plan" && t.pricelistItems.length === 0);
  // The e-mail is required to approve but not to save a draft (FR-070: an
  // approved quote has been sent to someone, so the list must name them — and an
  // approved row is immutable, so it could never be filled in afterwards).
  const emailMissing = !EMAIL_PATTERN.test(patientEmail.trim());
  const approveDisabled = isEmpty || hasUnpriced || emailMissing;
  const approveReason = isEmpty
    ? "Dodaj co najmniej jeden ząb lub pozycję ogólną."
    : hasUnpriced
      ? "Każdy ząb w planie musi mieć pozycję z cennika."
      : emailMissing
        ? "Podaj e-mail odbiorcy, żeby zatwierdzić kosztorys."
        : null;

  // --- Approve: POST the tree by-id; server re-resolves prices and freezes ---
  async function handleApprove() {
    if (approveDisabled || inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setSubmitError(null);
    // Send pricelist items BY ID only — the resolved client price is preview-only
    // and is never trusted for the immutable freeze (server re-resolves). rawText
    // is intentionally absent from the payload (patient-safe invariant).
    //
    // `id`, when present, turns this into a draft→approved transition on that row
    // rather than a fresh insert, so reopening and approving a draft leaves one
    // quote, not two. `patient_email` is a sibling of the tree and lands in its
    // own column — never inside `content` (FR-072/FR-066).
    const payload = {
      ...treePayload(),
      patient_email: patientEmail.trim(),
      ...(savedId ? { id: savedId } : {}),
    };
    try {
      const res = await fetch("/api/admin/quotes/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as { path?: string; error?: string } | null;
      if (!res.ok || !data?.path) {
        setSubmitError(data?.error ?? "Nie udało się zatwierdzić kosztorysu.");
        return;
      }
      setApprovedPath(data.path);
    } catch {
      setSubmitError("Błąd połączenia. Spróbuj ponownie.");
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  function resetQuote() {
    setPatientType("adult");
    setTeeth([]);
    setVisits([]);
    setGeneralItems([]);
    setPatientEmail("");
    setRawText("");
    setToothInput("");
    setToothWarnings([]);
    setSubmitError(null);
    setApprovedPath(null);
    // A fresh quote is a fresh row: drop the id the approved one occupied, or the
    // next save would try to update a now-immutable record.
    setSavedId(null);
    setSaveError(null);
    setSavedAt(null);
    generalCounter.current = 0;
  }

  if (approvedPath) {
    return <ApprovalConfirmation path={approvedPath} onReset={resetQuote} />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-8">
      <div className="border-border flex flex-wrap items-baseline justify-between gap-4 border-b pb-4">
        <h1 className="font-serif text-2xl font-medium tracking-tight">
          {readOnly ? "Kosztorys zatwierdzony" : savedId ? "Kosztorys (szkic)" : "Nowy kosztorys"}
        </h1>
        <a href="/admin" className="text-muted-foreground text-sm underline underline-offset-4">
          Lista kosztorysów
        </a>
      </div>

      <Section title="E-mail odbiorcy">
        {readOnly ? (
          <p className="text-sm">{patientEmail || <span className="text-muted-foreground">— brak —</span>}</p>
        ) : (
          <>
            <Label htmlFor="patientEmail" className="text-muted-foreground mb-1">
              Tylko do Twojej referencji — nigdy nie trafia na stronę pacjenta. Wymagany do zatwierdzenia.
            </Label>
            <Input
              id="patientEmail"
              type="email"
              placeholder="pacjent@example.com"
              value={patientEmail}
              onChange={(e) => {
                setPatientEmail(e.target.value);
              }}
            />
          </>
        )}
      </Section>

      {!readOnly && (
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
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={parsing || rawText.trim().length === 0}
              onClick={() => void handlePrefill()}
            >
              {parsing ? "Wypełnianie…" : "Wypełnij z notatki"}
            </Button>
            <span className="text-muted-foreground text-xs">
              Uzupełnia formularz — niczego nie nadpisuje i nie zatwierdza.
            </span>
          </div>
          {parseError && <p className="text-destructive mt-2 text-sm">{parseError}</p>}
          <ParseWarnings warnings={parseWarnings} />
        </Section>
      )}

      <Section title="Typ pacjenta">
        <div className="flex gap-2">
          <Button
            type="button"
            disabled={readOnly}
            variant={patientType === "child" ? "default" : "outline"}
            onClick={() => {
              setPatientType("child");
            }}
          >
            Dziecko
          </Button>
          <Button
            type="button"
            disabled={readOnly}
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
        {!readOnly && (
          <div className="flex gap-2">
            {/* The placeholder IS this field's accessible name — `seed.spec.ts`
                and `patient-link-content.spec.ts` both locate it that way. It
                does not move. */}
            <Input
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
        )}
        {toothWarnings.length > 0 && (
          <ul className="text-urgency-moderate-ink border-urgency-moderate/50 mt-2 space-y-0.5 border-l-2 pl-3 text-xs">
            {toothWarnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
        <div className="mt-3 space-y-3">
          {teeth.length === 0 && (
            <p className="text-muted-foreground text-sm">
              {readOnly ? "Brak zębów w kosztorysie." : "Brak zębów. Dodaj numery powyżej."}
            </p>
          )}
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
              readOnly={readOnly}
            />
          ))}
        </div>
      </Section>

      <Section title="Wizyty">
        <VisitList
          visits={visits}
          onAdd={addVisit}
          onRemove={removeVisit}
          onLabelChange={setVisitLabel}
          readOnly={readOnly}
        />
      </Section>

      <Section title="Pozycje ogólne">
        <GeneralItems
          items={generalItems}
          options={generalOptions}
          visits={visits}
          onAdd={addGeneral}
          onRemove={removeGeneral}
          onVisitChange={setGeneralVisit}
          readOnly={readOnly}
        />
      </Section>

      <Section title="Podgląd kosztów">
        <TotalsPreview totals={totals} />
      </Section>

      {readOnly ? (
        <Section title="Link dla pacjenta">
          <p className="text-muted-foreground mb-2 text-sm">
            Kosztorys jest zatwierdzony, więc nie da się go już zmienić (nowa wersja = nowy kosztorys i nowy link).
          </p>
          {patientToken ? (
            <CopyLink path={`/p/${patientToken}`} />
          ) : (
            <p className="text-destructive text-sm">Ten kosztorys nie ma linku dla pacjenta.</p>
          )}
        </Section>
      ) : (
        // The two actions that end the task, kept reachable from anywhere in a
        // form that gets long. Same buttons, same names, same order, same
        // gating — only the position changed.
        //
        // `sticky`, not `fixed`. A fixed bar sits outside the flow, so it needs
        // the container to reserve its height by hand — and a hand-picked
        // reserve is wrong the moment the bar grows a wrapped error line, at
        // which point it covers the last tooth row. Worse, a fixed bar can park
        // itself over a control that Playwright has just scrolled to and eat the
        // click, failing a spec with a message that never mentions a bar. Sticky
        // occupies real space at the end of the flow, so it cannot overlap
        // anything, and still pins to the bottom while there is more form below.
        <div className="border-border bg-background/95 no-print sticky bottom-0 z-10 -mx-4 border-t px-4 backdrop-blur-sm">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-3">
            <Button type="button" size="lg" disabled={approveDisabled || submitting} onClick={handleApprove}>
              {submitting ? "Zatwierdzanie…" : "Zatwierdź"}
            </Button>
            <Button type="button" size="lg" variant="outline" disabled={saving} onClick={() => void handleSaveDraft()}>
              {saving ? "Zapisywanie…" : "Zapisz szkic"}
            </Button>
            {savedAt && !saveError && <span className="text-muted-foreground text-sm">Zapisano {savedAt}</span>}
            {approveReason && <p className="text-muted-foreground basis-full text-sm">{approveReason}</p>}
            {submitError && <p className="text-destructive basis-full text-sm">{submitError}</p>}
            {saveError && <p className="text-destructive basis-full text-sm">{saveError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
