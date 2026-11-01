import { Bingkai } from "./bingkai";

/** Surat keluar bernomor dengan kotak QR verifikasi (surat keluar). */
export function IlustrasiSurat({ className }: { className?: string }) {
  return (
    <Bingkai className={className}>
      <rect x="42" y="8" width="76" height="104" rx="3" fill="var(--kertas-2)" />
      <path d="M54 22h52" strokeWidth="3.5" />
      <rect x="62" y="30" width="36" height="8" rx="1.5" fill="var(--kunyit)" stroke="none" />
      <path d="M54 50h52M54 58h52M54 66h40M54 74h46" />
      <rect x="54" y="86" width="18" height="18" rx="1.5" />
      <path d="M58 90h4v4h-4zM66 98h2M58 100h2M66 90h2" strokeWidth="2" />
      <path d="M86 98h20" />
    </Bingkai>
  );
}
