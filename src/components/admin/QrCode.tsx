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
        className="border-border bg-card flex w-full flex-col items-center gap-2 rounded-md border p-3"
      >
        <div
          className="size-[200px] max-w-full [&>svg]:size-full"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: renderPatientQrSvg(url) }}
        />
        <a href={url} className="max-w-full text-center font-mono text-xs break-all underline underline-offset-4">
          {url}
        </a>
      </div>
    </div>
  );
}
