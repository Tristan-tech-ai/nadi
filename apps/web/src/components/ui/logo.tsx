/** Logo Nadi: selembar nota bertepi sobek dengan satu denyut kunyit melintas, ditambah huruf "nadi". */
export function TandaNadi({ ukuran = 28, className = "" }: { ukuran?: number; className?: string }) {
  return (
    <svg width={ukuran} height={ukuran} viewBox="0 0 32 32" className={className} role="img" aria-label="Nadi">
      <path d="M6 3h20a1 1 0 0 1 1 1v22.5l-2.5 2-2.5-2-2.5 2-2.5-2-2.5 2-2.5-2-2.5 2L5 26.5V4a1 1 0 0 1 1-1Z" fill="var(--tinta)" />
      <path d="M8 15h4.5l2-4.5 3 9 2-4.5H24" fill="none" stroke="var(--kunyit)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
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
