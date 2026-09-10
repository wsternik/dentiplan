import { renderPatientQrSvg } from "@/lib/quote/qr";

interface Props {
  /** The same `/p/<token>` path used by the adjacent copy control. */
  path: string;
}

export function QrCode({ path }: Props) {
  const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div
        role="region"
        aria-label="Kod QR linku dla pacjenta"
        className="border-border bg-card flex w-full flex-col items-center gap-3 rounded-xl border p-4 sm:p-5"
      >
        <div
          className="size-[200px] max-w-full [&>svg]:size-full"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: renderPatientQrSvg(url) }}
        />
        <a
          href={url}
          className="decoration-brand-ink/55 hover:decoration-brand-ink max-w-full text-center font-mono text-xs leading-relaxed break-all underline decoration-2 underline-offset-4 transition-colors"
        >
          {url}
        </a>
      </div>
    </div>
  );
}
