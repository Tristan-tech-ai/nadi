import { Bingkai } from "./bingkai";

/** Papan jepit dengan daftar kerja yang dicentang (papan kerja). */
export function IlustrasiPapan({ className }: { className?: string }) {
  return (
    <Bingkai className={className}>
      <rect x="44" y="16" width="72" height="94" rx="6" fill="var(--kertas-2)" />
      <rect x="62" y="10" width="36" height="14" rx="3" fill="var(--kunyit)" />
      <rect x="54" y="38" width="10" height="10" rx="2" />
      <path d="M56 43l3 3 5-7" />
      <rect x="54" y="58" width="10" height="10" rx="2" />
      <path d="M56 63l3 3 5-7" />
      <rect x="54" y="78" width="10" height="10" rx="2" />
      <path d="M72 43h32M72 63h26M72 83h30" />
    </Bingkai>
  );
}
