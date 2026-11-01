import { Bingkai } from "./bingkai";

/** Pesawat kertas yang dilempar, jejak putus-putus (Lempar Saja). */
export function IlustrasiLempar({ className }: { className?: string }) {
  return (
    <Bingkai className={className}>
      <path d="M36 66 124 26 96 94 80 70Z" fill="var(--kertas-2)" />
      <path d="M80 70 124 26 92 82Z" fill="var(--kunyit)" />
      <path d="M124 26 80 70M80 70l-4 18 14-10" />
      <path d="M14 104c10-6 16-14 24-24" strokeDasharray="4 6" />
      <path d="M26 112c8-2 14-6 20-12" strokeDasharray="4 6" />
    </Bingkai>
  );
}
