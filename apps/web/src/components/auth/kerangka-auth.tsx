import type { ReactNode } from "react";
import Link from "next/link";
import { LogoNadi } from "@/components/ui/logo";

/** Kerangka halaman masuk/daftar: satu kolom, rata kiri, satu tombol utama. */
export function KerangkaAuth({ judul, sub, children }: { judul: string; sub: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-10 pb-16">
      <Link href="/" aria-label="Beranda Nadi" className="self-start">
        <LogoNadi />
      </Link>
      <h1 className="mt-10 font-judul text-3xl font-extrabold leading-tight tracking-tight">{judul}</h1>
      <p className="mt-2 text-tinta-2">{sub}</p>
      <div className="mt-8">{children}</div>
    </main>
  );
}
