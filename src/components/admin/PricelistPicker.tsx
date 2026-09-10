// Category-grouped pricelist picker (FR-025/FR-029). Item names are NOT globally
// unique, so options are grouped under their category via <optgroup> to
// disambiguate. Selecting an option calls `onAdd` with the resolved
// `PickerOption` and resets, so the same item can be added repeatedly.

import { useMemo } from "react";
import { NativeSelect } from "./controls";
import { formatPriceValue } from "./format";
import type { PickerOption } from "@/lib/pricing";
import { cn } from "@/lib/utils";

interface Props {
  options: PickerOption[];
  onAdd: (option: PickerOption) => void;
  placeholder?: string;
  className?: string;
}

export function PricelistPicker({ options, onAdd, placeholder = "Dodaj pozycję z cennika…", className }: Props) {
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const groups = useMemo(() => {
    const map = new Map<string, PickerOption[]>();
    for (const option of options) {
      const list = map.get(option.category) ?? [];
      list.push(option);
      map.set(option.category, list);
    }
    return [...map.entries()];
  }, [options]);

  return (
    <NativeSelect
      className={cn("bg-background", className)}
      value=""
      onChange={(e) => {
        const option = byId.get(e.target.value);
        if (option) onAdd(option);
        e.target.value = "";
      }}
      aria-label={placeholder}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {groups.map(([category, items]) => (
        <optgroup key={category} label={category}>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({formatPriceValue(item.price)})
            </option>
          ))}
        </optgroup>
      ))}
    </NativeSelect>
  );
}
