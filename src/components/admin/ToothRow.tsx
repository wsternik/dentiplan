import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dentitionForTooth } from "@/types";
import type { ToothEntry, ToothStatus, TreatmentType, Urgency, Visit } from "@/types";
import { DENTITION_LABELS, STATUS_LABELS, TREATMENT_LABELS, URGENCY_LABELS } from "@/lib/quote/labels";
import { toothName } from "@/lib/quote/tooth-name";
import { NativeSelect } from "./controls";
import { formatPriceValue } from "./format";
import { PricelistPicker } from "./PricelistPicker";
import type { PickerOption } from "@/lib/pricing";

interface Props {
  tooth: ToothEntry;
  visits: Visit[];
  options: PickerOption[];
  expanded: boolean;
  onToggle: () => void;
  onPatch: (patch: Partial<ToothEntry>) => void;
  onAddItem: (option: PickerOption) => void;
  onRemoveItem: (index: number) => void;
  onRemove: () => void;
  readOnly?: boolean;
}

export function ToothRow({
  tooth,
  visits,
  options,
  expanded,
  onToggle,
  onPatch,
  onAddItem,
  onRemoveItem,
  onRemove,
  readOnly,
}: Props) {
  const [noteOpen, setNoteOpen] = useState(Boolean(tooth.note));
  const n = tooth.number;
  const unpriced = tooth.status === "in-plan" && !tooth.pricelistItems.length;
  return (
    <article className="bg-card overflow-hidden rounded border" aria-label={`Ząb ${n}`}>
      <button
        id={`tooth-toggle-${n}`}
        type="button"
        aria-expanded={expanded}
        aria-controls={`tooth-details-${n}`}
        aria-describedby={unpriced ? `tooth-error-${n}` : undefined}
        onClick={onToggle}
        className="tooth-summary w-full px-3 py-2.5 text-left"
      >
        <strong className="numeric text-2xl">{n}</strong>
        <span className="min-w-0">
          <span className="block font-medium">
            {tooth.treatmentType ? TREATMENT_LABELS[tooth.treatmentType] : "Nie określono"}
          </span>
          <span className="text-muted-foreground block text-sm">
            {STATUS_LABELS[tooth.status]} · {tooth.urgency ? URGENCY_LABELS[tooth.urgency] : "Pilność nieokreślona"} ·{" "}
            {tooth.visitNumber ? `Wizyta ${tooth.visitNumber}` : "Bez wizyty"}
          </span>
        </span>
        <span className="tooth-price text-sm">
          <span className="block">
            {tooth.pricelistItems.length
              ? tooth.pricelistItems.map((i) => formatPriceValue(i.price)).join(" + ")
              : "Brak ceny"}
          </span>
          {tooth.status !== "in-plan" && <span className="text-muted-foreground block">Nie wliczono do sum</span>}
        </span>
        <span aria-hidden="true">{expanded ? "−" : "+"}</span>
      </button>
      {unpriced && (
        <p id={`tooth-error-${n}`} className="text-urgency-moderate-ink px-3 pb-2 text-sm">
          Ząb w planie wymaga pozycji z cennika.
        </p>
      )}
      <div id={`tooth-details-${n}`} hidden={!expanded} className="bg-muted/30 space-y-4 border-t p-4">
        <p className="font-medium">
          {toothName(n)} · {DENTITION_LABELS[dentitionForTooth(n)]}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            Rodzaj leczenia
            {readOnly ? (
              <p>{tooth.treatmentType ? TREATMENT_LABELS[tooth.treatmentType] : "Nie określono"}</p>
            ) : (
              <NativeSelect
                aria-label={`Rodzaj leczenia — ząb ${n}`}
                value={tooth.treatmentType ?? ""}
                onChange={(e) => {
                  onPatch({ treatmentType: (e.target.value || null) as TreatmentType | null });
                }}
              >
                <option value="">Nie określono</option>
                {(Object.keys(TREATMENT_LABELS) as TreatmentType[]).map((k) => (
                  <option key={k} value={k}>
                    {TREATMENT_LABELS[k]}
                  </option>
                ))}
              </NativeSelect>
            )}
          </label>
          <label className="space-y-1 text-sm">
            Status
            {readOnly ? (
              <p>{STATUS_LABELS[tooth.status]}</p>
            ) : (
              <NativeSelect
                aria-label={`Status — ząb ${n}`}
                value={tooth.status}
                onChange={(e) => {
                  const status = e.target.value as ToothStatus;
                  onPatch(status === "in-plan" ? { status } : { status, visitNumber: null });
                }}
              >
                {(Object.keys(STATUS_LABELS) as ToothStatus[]).map((k) => (
                  <option key={k} value={k}>
                    {STATUS_LABELS[k]}
                  </option>
                ))}
              </NativeSelect>
            )}
          </label>
        </div>
        <section aria-label={`Zabiegi — ząb ${n}`} className="bg-card rounded border p-3">
          <h3 className="mb-2 font-semibold">Zabiegi z cennika</h3>
          <ul className="divide-y">
            {tooth.pricelistItems.map((item, index) => (
              <li key={`${item.id}-${index}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  {item.name} · <span className="font-medium">{formatPriceValue(item.price)}</span>
                </span>
                {!readOnly && (
                  <Button
                    variant="ghost"
                    aria-label={`Usuń pozycję ${item.name} — ząb ${n}`}
                    onClick={() => {
                      onRemoveItem(index);
                    }}
                  >
                    ×
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {!readOnly && (
            <PricelistPicker
              id={`tooth-price-${n}`}
              describedBy={unpriced ? `tooth-error-${n}` : undefined}
              options={options}
              onAdd={onAddItem}
              placeholder={`Dodaj zabieg — ząb ${n}`}
            />
          )}
          <p className="text-muted-foreground mt-2 text-sm">Ceny pozycji; koszt wariantu znajdziesz w podsumowaniu.</p>
        </section>
        <div className="grid gap-4 sm:grid-cols-2">
          {tooth.status === "in-plan" && (
            <label className="space-y-1 text-sm">
              Wizyta
              {readOnly || !visits.length ? (
                <p>{tooth.visitNumber ? `Wizyta ${tooth.visitNumber}` : "Bez przypisania do wizyty"}</p>
              ) : (
                <NativeSelect
                  aria-label={`Wizyta — ząb ${n}`}
                  value={tooth.visitNumber ?? ""}
                  onChange={(e) => {
                    onPatch({ visitNumber: e.target.value ? Number(e.target.value) : null });
                  }}
                >
                  <option value="">Bez przypisania do wizyty</option>
                  {visits.map((v) => (
                    <option key={v.number} value={v.number}>
                      Wizyta {v.number}
                      {v.label ? ` — ${v.label}` : ""}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </label>
          )}
          <label className="space-y-1 text-sm">
            Pilność
            {readOnly ? (
              <p>{tooth.urgency ? URGENCY_LABELS[tooth.urgency] : "Nie określono"}</p>
            ) : (
              <NativeSelect
                aria-label={`Pilność — ząb ${n}`}
                value={tooth.urgency ?? ""}
                onChange={(e) => {
                  onPatch({ urgency: (e.target.value || null) as Urgency | null });
                }}
              >
                <option value="">Nie określono</option>
                {(Object.keys(URGENCY_LABELS) as Urgency[]).map((k) => (
                  <option key={k} value={k}>
                    {URGENCY_LABELS[k]}
                  </option>
                ))}
              </NativeSelect>
            )}
          </label>
        </div>
        {noteOpen || tooth.note ? (
          <label className="block space-y-1 text-sm">
            Notatka — ząb {n}
            {readOnly ? (
              <p className="whitespace-pre-wrap">{tooth.note || "Brak notatki"}</p>
            ) : (
              <Input
                aria-label={`Notatka — ząb ${n}`}
                value={tooth.note}
                onChange={(e) => {
                  onPatch({ note: e.target.value });
                }}
              />
            )}
          </label>
        ) : (
          !readOnly && (
            <Button
              variant="ghost"
              onClick={() => {
                setNoteOpen(true);
              }}
            >
              Dodaj notatkę — ząb {n}
            </Button>
          )
        )}
        {!readOnly && (
          <div>
            <Button variant="ghost" onClick={onRemove}>
              Usuń ząb {n}
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}
