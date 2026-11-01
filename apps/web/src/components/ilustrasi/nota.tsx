import { Bingkai } from "./bingkai";

/** Nota thermal bertepi sobek dengan baris total distabilo (Feed kosong). */
export function IlustrasiNota({ className }: { className?: string }) {
  return (
    <Bingkai className={className}>
      <path d="M50 12H110V92l-6 6-6-6-6 6-6-6-6 6-6-6-6 6-6-6-6 6-6-6Z" fill="var(--kertas-2)" />
      <rect x="58" y="66" width="44" height="10" rx="1.5" fill="var(--kunyit)" stroke="none" />
      <path d="M60 26h40M60 36h28M60 46h34M60 56h22M60 71h40" />
      <path d="M92 36h8M94 46h6M90 56h10" />
    </Bingkai>
  );
}
