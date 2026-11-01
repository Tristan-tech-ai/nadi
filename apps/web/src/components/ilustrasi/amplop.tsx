import { Bingkai } from "./bingkai";

/** Amplop masuk dengan perangko distabilo (agenda surat masuk). */
export function IlustrasiAmplop({ className }: { className?: string }) {
  return (
    <Bingkai className={className}>
      <path d="M80 6v20M72 18l8 8 8-8" />
      <rect x="28" y="36" width="104" height="66" rx="4" fill="var(--kertas-2)" />
      <path d="M28 40l52 36 52-36M28 100l38-30M132 100 94 70" />
      <rect x="106" y="44" width="18" height="22" rx="1.5" fill="var(--kunyit)" />
      <path d="M110 50h10M110 56h8" strokeWidth="2" />
    </Bingkai>
  );
}
