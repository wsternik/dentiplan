// The new-quote editor island (S-01, Phase 2). Owns the entire working
// `QuoteContent` tree in client state, renders every section, and derives both
// cost variants live via the pure Phase-1 engine. No persistence here — the
// Approve action is wired to the server endpoint in Phase 3.
//
// PATIENT-SAFE INVARIANT: `rawText` is persisted only in the admin-only
// `diagnosis_note` column. It is never part of `treePayload()` or the patient-safe
// `content` returned to anon callers.

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InfoHint } from "@/components/ui/info-hint";
import { ChartLegend } from "@/components/tooth-chart/ChartLegend";
import { ToothChart } from "@/components/tooth-chart/ToothChart";
import { computeQuoteTotals } from "@/lib/quote/cost";
import { toChartTeeth } from "@/lib/tooth-chart/model";
import { isValidToothNumber } from "@/lib/quote/tooth-name";
import type { GeneralItem, PatientType, PricelistItemRef, ToothEntry, Visit } from "@/types";
import { ApprovalConfirmation } from "./ApprovalConfirmation";
import { ParseWarnings } from "./ParseWarnings";
import { Section } from "./controls";
import { CopyLink } from "./CopyLink";
import { GeneralItems } from "./GeneralItems";
import { QrCode } from "./QrCode";
import { ToothRow } from "./ToothRow";
import { TotalsPreview } from "./TotalsPreview";
import { VisitList } from "./VisitList";
import type { PickerOption } from "@/lib/pricing";
import { mergePrefill } from "@/lib/llm/merge";
import type { PrefillResult } from "@/lib/llm/schema";
import type { QuoteEditorProps } from "./types";
import { cn } from "@/lib/utils";

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
 * Which of `numbers` are new to `existing`, and what to say about the ones that
 * are not. Pure, and applied twice on the add path: once against the rendered
 * list to build the message, once inside the `setTeeth` updater against the
 * live list to build the write.
 *
 * Twice rather than once because the two answers are needed at different
 * moments. A state updater does not run synchronously — React queues it and
 * calls it during the next render — so a warning cannot be carried out of one;
 * the caller needs it now, and the rendered list is what the message is about
 * anyway. The write is the opposite: it has to see `prev`, because two adds
 * landing in the same tick would both read the pre-click list from the closure
 * and insert the same tooth twice, giving two rows one React key.
 */
function planAdditions(existing: ToothEntry[], numbers: number[]): { additions: ToothEntry[]; warnings: string[] } {
  const seen = new Set(existing.map((t) => t.number));
  const warnings: string[] = [];
  const additions: ToothEntry[] = [];

  for (const n of numbers) {
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

  return { additions, warnings };
}

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
  initialDiagnosisNote,
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
  const [rawText, setRawText] = useState(initialDiagnosisNote ?? "");
  const [toothInput, setToothInput] = useState("");
  const [toothWarnings, setToothWarnings] = useState<string[]>([]);
  // The new-quote route begins with the diagnosis note as the primary action.
  // Reopened drafts and approved quotes already contain deliberate work, so
  // hiding their form would make existing data look missing.
  const [noteFirst, setNoteFirst] = useState(!quoteId && !readOnly);
  const [manualFormOpen, setManualFormOpen] = useState(Boolean(quoteId) || readOnly);

  // --- Note prefill (S-02, FR-011/FR-012) ---
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  // What the prefill did, for the live region. The overlay announces that the
  // form is being filled; without this, the announcement it ends on is silence —
  // and the reveal below is a purely visual event, so a screen-reader user would
  // be told neither that the model answered nor that a form opened around her.
  const [parseStatus, setParseStatus] = useState<string | null>(null);
  // `inert` on the busy wrapper blurs whatever was focused, so the prefill
  // button loses focus the moment it is clicked. Restoring it matters more now
  // that the form opens: otherwise the keyboard path to the freshly revealed
  // fields starts at the top of the document.
  const prefillButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusAfterPrefill = useRef(false);
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
  // Every server write freezes a snapshot before its await. Keeping the editor
  // inert until that request settles prevents a later visible edit from being
  // omitted while the UI still reports the snapshot as saved or approved.
  const operationBusy = parsing || saving || submitting;
  const operationStatus = parsing
    ? "Wypełnianie formularza z notatki."
    : submitting
      ? "Zatwierdzanie kosztorysu."
      : saving
        ? "Zapisywanie szkicu."
        : (parseStatus ?? "");

  // The wrapper is only interactive again after the render that clears
  // `parsing`, so the focus call belongs here rather than in `handlePrefill`'s
  // `finally`: an `inert` ancestor rejects it.
  useEffect(() => {
    if (parsing || !restoreFocusAfterPrefill.current) return;
    restoreFocusAfterPrefill.current = false;
    prefillButtonRef.current?.focus();
  }, [parsing]);

  const totals = useMemo(() => computeQuoteTotals({ teeth, visits, generalItems }), [teeth, visits, generalItems]);
  const readOnlyPatientPath = patientToken ? `/p/${patientToken}` : null;
  // The drawing is derived from the same tree as the totals and the rows, by
  // the same pure function the patient page uses. There is no second source of
  // truth for it to drift from, which is why the text picker and the note
  // prefill move it without either of them knowing it exists.
  const chartTeeth = useMemo(() => toChartTeeth({ teeth, visits, generalItems }), [teeth, visits, generalItems]);

  // --- Tooth entry (FR-021/FR-012/FR-076) ---

  /**
   * Add teeth by number, and hand back what could not be added. This is the
   * seam the chart shares with the text picker, so it deliberately does not
   * tokenize (there is no text to tokenize behind a click), does not clear
   * `toothInput` (a chart click must not empty a half-typed field), and does
   * not call `setToothWarnings` — its caller merges these warnings with
   * whatever it produced itself and flushes once, because a second
   * `setToothWarnings` in the same handler would clobber the first and the
   * invalid-token warnings would vanish without a trace.
   */
  function addToothNumbers(numbers: number[]): string[] {
    const { warnings } = planAdditions(teeth, numbers);
    setTeeth((prev) => {
      const { additions } = planAdditions(prev, numbers);
      // A batch of pure duplicates leaves the tree untouched — returning `prev`
      // unchanged lets React bail out — while its warnings still travel back.
      if (additions.length === 0) return prev;
      return [...prev, ...additions].sort((a, b) => a.number - b.number);
    });
    return warnings;
  }

  function addTeeth() {
    const tokens = toothInput.split(/[\s,]+/).filter(Boolean);
    const invalid: string[] = [];
    const numbers: number[] = [];

    for (const token of tokens) {
      const n = Number(token);
      // The message quotes the raw token, which is the only side of this
      // conversion where "1x" is still visible.
      if (!Number.isInteger(n) || !isValidToothNumber(n)) {
        invalid.push(`Nieprawidłowy numer zęba: ${token}`);
        continue;
      }
      numbers.push(n);
    }

    setToothWarnings([...invalid, ...addToothNumbers(numbers)]);
    setToothInput("");
  }

  /**
   * A click on the drawing (FR-076). A tooth already in the plan is not added
   * twice: every one of its fields lives in its row, so the click takes her
   * there instead of doing nothing visible in a section she may have scrolled
   * past.
   */
  function handleChartToothClick(number: number) {
    if (teeth.some((t) => t.number === number)) {
      const row = document.getElementById(`tooth-${number}`);
      row?.scrollIntoView({ block: "center", behavior: "smooth" });
      // `preventScroll`, because `scrollIntoView` above has already chosen the
      // position and focus would otherwise re-scroll to its own.
      row?.focus({ preventScroll: true });
      return;
    }
    setToothWarnings(addToothNumbers([number]));
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
    const body = {
      ...treePayload(),
      patient_email: patientEmail.trim() || null,
      diagnosis_note: rawText,
    };
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
  // `rawText` is the only thing sent to the model, and it never enters
  // `treePayload()` or patient-visible `content`.
  function applyPrefill(result: PrefillResult) {
    const merged = mergePrefill(treeRef.current, result, generalCounter.current);
    generalCounter.current = merged.generalIdSeed;
    setTeeth(merged.teeth);
    setVisits(merged.visits);
    setGeneralItems(merged.generalItems);
    return merged;
  }

  async function handlePrefill() {
    if (inFlight.current) return;
    inFlight.current = true;
    restoreFocusAfterPrefill.current = true;
    setParsing(true);
    setParseError(null);
    setParseStatus(null);
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
      const merged = applyPrefill(result);
      setParseWarnings(merged.warnings);
      setParseStatus(`Wypełniono formularz z notatki. Formularz jest otwarty, liczba zębów: ${merged.teeth.length}.`);
      // The whole answer lands inside `#quote-details`, which the note-first
      // route keeps collapsed. Leaving it closed means the prefill finishes and
      // nothing on screen moves, so she has to guess that the result is one
      // click away. Only the success branch opens it: a failed prefill has
      // nothing to show, and FR-013 keeps it from changing anything.
      setManualFormOpen(true);
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
    // and is never trusted for the immutable freeze (server re-resolves).
    //
    // `id`, when present, turns this into a draft→approved transition on that row
    // rather than a fresh insert, so reopening and approving a draft leaves one
    // quote, not two. `patient_email` is a sibling of the tree and lands in its
    // own column — never inside `content` (FR-072/FR-066). The raw diagnosis is
    // another sibling and follows the same boundary into `diagnosis_note`.
    const payload = {
      ...treePayload(),
      patient_email: patientEmail.trim(),
      diagnosis_note: rawText,
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
    setNoteFirst(true);
    setManualFormOpen(false);
    generalCounter.current = 0;
  }

  if (approvedPath) {
    return <ApprovalConfirmation path={approvedPath} onReset={resetQuote} />;
  }

  const diagnosisNoteSection = (!readOnly || rawText.trim().length > 0) && (
    <Section title="Notatka z diagnozy">
      {readOnly ? (
        <p className="text-sm whitespace-pre-line">{rawText}</p>
      ) : (
        <>
          <Label htmlFor="rawText" className="text-muted-foreground mb-2 leading-relaxed">
            <span className="sr-only">Pole robocze — </span>
            Zapisywana razem z kosztorysem, widoczna tylko dla Ciebie — nigdy nie trafia na stronę pacjenta.
          </Label>
          <Textarea
            id="rawText"
            rows={noteFirst ? 8 : 4}
            maxLength={4000}
            placeholder="Wklej opis diagnozy do pomocy przy wypełnianiu…"
            value={rawText}
            onChange={(e) => {
              setRawText(e.target.value);
            }}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              shape="pill"
              ref={prefillButtonRef}
              disabled={operationBusy || rawText.trim().length === 0}
              onClick={() => void handlePrefill()}
            >
              {parsing ? "Wypełnianie…" : "Wypełnij z notatki"}
            </Button>
            <InfoHint label="Jak działa wypełnianie z notatki">
              Uzupełnia formularz — niczego nie nadpisuje i nie zatwierdza.
            </InfoHint>
          </div>
          {parseError && <p className="text-destructive mt-2 text-sm">{parseError}</p>}
          <ParseWarnings warnings={parseWarnings} />
        </>
      )}
    </Section>
  );

  return (
    <div className="shell-workspace relative py-8 sm:py-12" aria-busy={operationBusy} aria-label="Edytor kosztorysu">
      <span className="sr-only" role="status" aria-live="polite">
        {operationStatus}
      </span>
      {parsing && (
        <div className="bg-background/75 absolute inset-0 z-30 cursor-wait backdrop-blur-[1px]" aria-hidden="true">
          <div className="sticky top-6 flex justify-center px-4">
            <span className="bg-popover text-popover-foreground border-border rounded-full border px-5 py-2.5 text-sm font-semibold shadow-[0_16px_35px_-22px_color-mix(in_oklch,var(--foreground)_55%,transparent)]">
              Wypełnianie formularza…
            </span>
          </div>
        </div>
      )}

      <div
        inert={operationBusy || undefined}
        className={cn("space-y-5 sm:space-y-6", operationBusy && "pointer-events-none select-none")}
      >
        <div className="border-border flex flex-wrap items-end justify-between gap-5 border-b pb-6">
          <div>
            <span className="bg-brand mb-3 block h-1 w-10 rounded-full" aria-hidden="true" />
            <h1 className="font-editorial text-3xl font-medium tracking-[-0.035em] sm:text-4xl">
              {readOnly ? "Kosztorys zatwierdzony" : savedId ? "Kosztorys (szkic)" : "Nowy kosztorys"}
            </h1>
          </div>
          <a
            href="/admin"
            className="border-border bg-card hover:bg-accent focus-visible:ring-ring inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium tracking-tight transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Lista kosztorysów
          </a>
        </div>

        {noteFirst && diagnosisNoteSection}

        {noteFirst && (
          <Button
            type="button"
            variant="outline"
            className="bg-card w-full justify-center rounded-xl border-dashed py-5"
            aria-expanded={manualFormOpen}
            aria-controls="quote-details"
            onClick={() => {
              setManualFormOpen((open) => !open);
            }}
          >
            {manualFormOpen ? "Ukryj formularz ręczny" : "Dostosuj formularz ręcznie"}
          </Button>
        )}

        <div id="quote-details" className="space-y-5 sm:space-y-6" hidden={!manualFormOpen}>
          {!noteFirst && diagnosisNoteSection}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Section title="E-mail odbiorcy">
              {readOnly ? (
                <p className="text-sm">{patientEmail || <span className="text-muted-foreground">— brak —</span>}</p>
              ) : (
                <>
                  <div className="mb-1 flex items-center gap-1">
                    <Label htmlFor="patientEmail" className="text-muted-foreground">
                      <span className="sr-only">
                        Tylko do Twojej referencji — nigdy nie trafia na stronę pacjenta. Wymagany do zatwierdzenia.
                      </span>
                      <span aria-hidden="true">Adres e-mail</span>
                    </Label>
                    <InfoHint label="Informacja o adresie e-mail">
                      Tylko do Twojej referencji — nigdy nie trafia na stronę pacjenta. Wymagany do zatwierdzenia.
                    </InfoHint>
                  </div>
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

            <Section title="Typ pacjenta">
              <div className="flex flex-wrap gap-2">
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
          </div>

          <Section title="Zęby">
            {!readOnly && (
              <div className="flex flex-col gap-2 sm:flex-row">
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
                <Button type="button" shape="pill" className="sm:shrink-0" onClick={addTeeth}>
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
            {/* The same drawing the patient gets, above the rows it addresses.
            `read-only` on an approved quote is inert but still hoverable —
            FR-053 freezes the quote, not the tooltip. */}
            <div className="tooth-chart-layout bg-secondary/35 mt-5 rounded-xl p-4 sm:p-5 lg:grid lg:grid-cols-2 lg:items-center lg:gap-6">
              <ToothChart
                teeth={chartTeeth}
                mode={readOnly ? "read-only" : "interactive"}
                onToothClick={handleChartToothClick}
              />
              <ChartLegend />
            </div>

            <div className="mt-4 space-y-3">
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
              {readOnlyPatientPath ? (
                <div className="bg-secondary/35 space-y-4 rounded-xl p-4 sm:p-5">
                  <CopyLink path={readOnlyPatientPath} />
                  <QrCode path={readOnlyPatientPath} />
                </div>
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
            <div className="border-border bg-card/95 no-print sticky bottom-0 z-10 -mx-4 border-t px-4 shadow-[0_-18px_38px_-34px_color-mix(in_oklch,var(--foreground)_60%,transparent)] backdrop-blur-sm sm:mx-0 sm:rounded-t-xl sm:border-x">
              <div className="grid grid-cols-2 items-center gap-2 py-3 sm:flex sm:flex-wrap sm:gap-x-3 sm:gap-y-1.5">
                <Button
                  type="button"
                  size="lg"
                  shape="pill"
                  className="w-full sm:w-auto"
                  disabled={approveDisabled || operationBusy}
                  onClick={handleApprove}
                >
                  {submitting ? "Zatwierdzanie…" : "Zatwierdź"}
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  shape="pill"
                  className="w-full sm:w-auto"
                  disabled={operationBusy}
                  onClick={() => void handleSaveDraft()}
                >
                  {saving ? "Zapisywanie…" : "Zapisz szkic"}
                </Button>
                {savedAt && !saveError && (
                  <span className="text-muted-foreground col-span-2 text-sm sm:basis-full">Zapisano {savedAt}</span>
                )}
                {approveReason && (
                  <p className="text-muted-foreground col-span-2 min-w-0 text-sm leading-relaxed break-words sm:basis-full">
                    {approveReason}
                  </p>
                )}
                {submitError && (
                  <p className="text-destructive col-span-2 min-w-0 text-sm leading-relaxed break-words sm:basis-full">
                    {submitError}
                  </p>
                )}
                {saveError && (
                  <p className="text-destructive col-span-2 min-w-0 text-sm leading-relaxed break-words sm:basis-full">
                    {saveError}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
