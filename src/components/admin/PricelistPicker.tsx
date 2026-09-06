import { useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPriceValue } from "./format";
import type { PickerOption } from "@/lib/pricing";

interface Props {
  options: PickerOption[];
  onAdd: (option: PickerOption) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  describedBy?: string;
}

// The results stay in normal flow: no overlay can escape the narrow viewport
// or cover the input when a mobile keyboard reduces the available height.
export function PricelistPicker({ options, onAdd, placeholder = "Dodaj zabieg", className, id, describedBy }: Props) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const results = useMemo(
    () => options.filter((o) => o.name.toLocaleLowerCase("pl").includes(query.toLocaleLowerCase("pl").trim())),
    [options, query],
  );
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  function choose(option: PickerOption) {
    onAdd(option);
    setQuery("");
    setActive(0);
    close();
  }
  function move(index: number) {
    setActive(index);
    document.getElementById(`${uid}-option-${index}`)?.scrollIntoView({ block: "nearest" });
  }
  return (
    <div className={className}>
      <Button
        id={id}
        ref={trigger}
        type="button"
        variant="outline"
        aria-expanded={open}
        aria-controls={`${uid}-panel`}
        aria-describedby={describedBy}
        onClick={() => {
          setOpen(!open);
          if (!open) requestAnimationFrame(() => input.current?.focus());
        }}
      >
        {placeholder}
      </Button>
      {open && (
        <div id={`${uid}-panel`} className="bg-card mt-2 min-w-0 rounded border p-3">
          <label htmlFor={`${uid}-search`} className="mb-2 block text-sm">
            Szukaj zabiegu po nazwie
          </label>
          <Input
            ref={input}
            id={`${uid}-search`}
            role="combobox"
            aria-label={`Szukaj — ${placeholder}`}
            aria-expanded={true}
            aria-controls={`${uid}-results`}
            aria-autocomplete="list"
            aria-activedescendant={results[active] ? `${uid}-option-${active}` : undefined}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                move(Math.max(0, Math.min(results.length - 1, active + (e.key === "ArrowDown" ? 1 : -1))));
              }
              if (e.key === "Enter") {
                e.preventDefault();
                if (results[active]) choose(results[active]);
              }
              if (e.key === "Escape") {
                e.preventDefault();
                close();
              }
              if (e.key === "Home" && e.ctrlKey) {
                e.preventDefault();
                move(0);
              }
              if (e.key === "End" && e.ctrlKey) {
                e.preventDefault();
                move(results.length - 1);
              }
            }}
          />
          <p role="status" className="text-muted-foreground my-2 text-sm">
            {results.length ? `Wyniki: ${results.length}. Strzałki wybierają, Enter dodaje.` : "Brak wyników"}
          </p>
          <ul
            id={`${uid}-results`}
            role="listbox"
            aria-label="Zabiegi z cennika"
            className="max-h-[min(18rem,35dvh)] overflow-y-auto overscroll-contain"
          >
            {results.map((option, index) => (
              <li
                key={option.id}
                id={`${uid}-option-${index}`}
                role="option"
                aria-selected={index === active}
                tabIndex={-1}
                className="aria-selected:bg-secondary cursor-pointer border-t px-2 py-3 text-sm"
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onClick={() => {
                  choose(option);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") choose(option);
                }}
              >
                <span className="block font-medium">{option.name}</span>
                <span className="text-muted-foreground block">
                  {option.category} · {formatPriceValue(option.price)}
                </span>
              </li>
            ))}
          </ul>
          <Button type="button" variant="ghost" onClick={close}>
            Zamknij cennik
          </Button>
        </div>
      )}
    </div>
  );
}
