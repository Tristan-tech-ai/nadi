import { JALUR_N, TITIK } from "./logo-jalur";

/** Tanda Nadi: huruf n dari secarik kertas nota yang kakinya sobek, dengan satu titik denyut kunyit (D-10). */
export function TandaNadi({ ukuran = 28, className = "" }: { ukuran?: number; className?: string }) {
  return (
    <svg width={ukuran} height={ukuran} viewBox="0 0 32 32" className={className} role="img" aria-label="Nadi">
      <path d={JALUR_N} fill="var(--tinta)" />
      <circle cx={TITIK.cx} cy={TITIK.cy} r={TITIK.r} fill="var(--kunyit)" />
    </svg>
  );
}

export function LogoNadi({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <TandaNadi />
      <span className="font-judul text-[22px] font-extrabold leading-none tracking-tight text-tinta">nadi</span>
    </span>
  );
}
