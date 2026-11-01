import { Bingkai } from "./bingkai";

/** Slip gaji dengan tumpukan koin (gaji). */
export function IlustrasiSlip({ className }: { className?: string }) {
  return (
    <Bingkai className={className}>
      <rect x="30" y="14" width="66" height="88" rx="3" fill="var(--kertas-2)" />
      <path d="M42 30h42M42 44h30M42 54h36M42 64h24" />
      <path d="M42 82h42" strokeWidth="3.5" />
      <ellipse cx="120" cy="96" rx="18" ry="6" fill="var(--kunyit)" />
      <path d="M102 96v-8c0 3 8 6 18 6s18-3 18-6v8" />
      <ellipse cx="120" cy="80" rx="18" ry="6" fill="var(--kunyit)" />
      <path d="M102 80v-8c0 3 8 6 18 6s18-3 18-6v8" />
      <ellipse cx="120" cy="64" rx="18" ry="6" fill="var(--kunyit)" />
    </Bingkai>
  );
}
