import type { ButtonHTMLAttributes } from "react";

type Ragam = "utama" | "kedua" | "teks" | "bahaya";
type Ukuran = "biasa" | "besar";

const RAGAM: Record<Ragam, string> = {
  utama: "bg-tinta text-kertas hover:bg-tinta/90 active:translate-y-px",
  kedua: "bg-transparent text-tinta border border-garis-kuat hover:bg-kertas-2 active:translate-y-px",
  teks: "bg-transparent text-tinta underline-offset-4 hover:underline px-2",
  bahaya: "bg-transparent text-cap border border-cap hover:bg-cap hover:text-kertas active:translate-y-px",
};
const UKURAN: Record<Ukuran, string> = {
  biasa: "h-10 px-4 text-sm",
  besar: "h-12 px-5 text-base",
};

/** Satu tombol utama per layar (ANTI-SLOP S22). Ukuran besar = target sentuh 48 px untuk staf dan Feed di HP. */
export function Tombol({ ragam = "utama", ukuran = "biasa", className = "", type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { ragam?: Ragam; ukuran?: Ukuran }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius-isian)] font-semibold transition-[background-color,color,transform] duration-150 ease-[var(--ease-nadi)] disabled:cursor-not-allowed disabled:opacity-50 ${RAGAM[ragam]} ${UKURAN[ukuran]} ${className}`}
      {...props}
    />
  );
}
