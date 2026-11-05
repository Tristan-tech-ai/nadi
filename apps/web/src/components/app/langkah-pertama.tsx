import Link from "next/link";
import type { ReactNode } from "react";

// U-05 keadaan kosong yang mengajar: tautan langkah pertama di dalam kalimat keadaan kosong, untuk langkah yang ada di halaman lain.
// Langkah di halaman yang sama ditunjuk lewat atribut data-langkah (diperiksa e2e/mulai.spec.ts). Tanpa "use client": dipakai di
// komponen server maupun klien.
export function LangkahPertama({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center font-semibold text-laut underline underline-offset-4 print:hidden">
      {children}
    </Link>
  );
}
