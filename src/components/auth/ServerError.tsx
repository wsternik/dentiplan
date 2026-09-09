import { CircleAlert } from "lucide-react";

interface ServerErrorProps {
  message?: string | null;
}

export function ServerError({ message }: ServerErrorProps) {
  if (!message) return null;

  return (
    <p
      role="alert"
      className="border-destructive/35 bg-destructive/8 text-destructive flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm leading-relaxed"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}
