import { useId, useRef, useState, type PointerEvent } from "react";
import { Info } from "lucide-react";
import { Tooltip } from "radix-ui";

interface InfoHintProps {
  label: string;
  children: string;
}

/** A compact help trigger that works with a pointer, keyboard, and touch. */
export function InfoHint({ label, children }: InfoHintProps) {
  const [open, setOpen] = useState(false);
  const descriptionId = useId();
  const touchOpen = useRef(false);

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== "touch") return;

    // Radix deliberately does not open Tooltip on touch. Toggle it ourselves
    // and suppress the compatibility click, which would otherwise focus the
    // trigger and immediately overwrite the controlled state.
    event.preventDefault();
    touchOpen.current = !touchOpen.current;
    setOpen(touchOpen.current);
  }

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root
        open={open}
        onOpenChange={(nextOpen) => {
          touchOpen.current = nextOpen;
          setOpen(nextOpen);
        }}
      >
        <Tooltip.Trigger asChild>
          <button
            type="button"
            aria-label={label}
            aria-describedby={descriptionId}
            className="text-muted-foreground hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-transparent transition-colors focus-visible:ring-[3px] focus-visible:outline-none"
            onPointerDown={handlePointerDown}
          >
            <Info className="size-4" aria-hidden="true" />
          </button>
        </Tooltip.Trigger>

        {/* The description stays mounted when the visual tooltip closes, so
            aria-describedby never points at a missing node. */}
        <span id={descriptionId} className="sr-only">
          {children}
        </span>

        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={6}
            aria-hidden="true"
            className="bg-popover text-popover-foreground border-border z-50 max-w-72 rounded-lg border px-3 py-2 text-sm leading-snug shadow-md"
          >
            {children}
            <Tooltip.Arrow className="fill-border" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
