import { Bingkai } from "./bingkai";

/** Dua kunci di satu cincin, berpindah ke orang berikutnya (serah terima). */
export function IlustrasiKunci({ className }: { className?: string }) {
  return (
    <Bingkai className={className}>
      <circle cx="62" cy="30" r="12" />
      <circle cx="50" cy="56" r="11" fill="var(--kunyit)" />
      <circle cx="50" cy="56" r="3.5" fill="var(--kertas-2)" />
      <path d="M50 67v38M50 90h8M50 98h6" />
      <circle cx="74" cy="56" r="11" fill="var(--kertas-2)" />
      <path d="M74 67v34M74 86h8M74 94h6" />
      <path d="M54 41l-2 4M70 41l2 4" />
      <path d="M96 52c16-14 32-6 36 14M126 62l6 5 3-7" />
    </Bingkai>
  );
}
