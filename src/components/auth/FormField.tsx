import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const inputBase =
  "h-11 w-full rounded-lg border bg-background px-3 py-2 pr-10 pl-10 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-[color,box-shadow,background-color] focus-visible:bg-card focus-visible:ring-[3px]";

interface FormFieldProps {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  icon: ReactNode;
  endContent?: ReactNode;
}

export function FormField({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  error,
  icon,
  endContent,
}: FormFieldProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-foreground block text-sm font-semibold tracking-[-0.01em]">
        {label}
      </label>
      <div className="relative">
        <span
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
          aria-hidden="true"
        >
          {icon}
        </span>
        <input
          id={id}
          name={id}
          type={type}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          placeholder={placeholder}
          className={cn(
            inputBase,
            error
              ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/25"
              : "border-input focus-visible:border-ring focus-visible:ring-ring/50",
          )}
        />
        {endContent}
      </div>
      {error ? (
        <p className="text-destructive flex items-center gap-1.5 text-xs font-medium">
          <CircleAlert className="size-3.5" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
