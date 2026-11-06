import Link from "next/link";
import type { Kamus } from "@/lib/i18n/kamus";

/** Pilihan peran di atas formulir masuk: pengelola memakai email, staf memakai kode usaha + ID + PIN (Tristan 6 Nov: staf bingung). */
export function PilihMasuk({ aktif, next, teks: t }: { aktif: "pengelola" | "staf"; next?: string; teks: Kamus["auth"] }) {
  const pilihan = [
    { id: "pengelola", href: next ? `/masuk?next=${encodeURIComponent(next)}` : "/masuk", judul: t.pilihPengelola, ket: t.pilihPengelolaKet },
    { id: "staf", href: "/masuk/staf", judul: t.pilihStaf, ket: t.pilihStafKet },
  ] as const;
  return (
    <nav aria-label={t.masukSebagai} className="mb-6" data-testid="pilih-masuk">
      <p className="text-sm font-semibold">{t.masukSebagai}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {pilihan.map((p) => (
          <Link key={p.id} href={p.href} aria-current={p.id === aktif ? "page" : undefined}
            className="rounded-[var(--radius-kartu)] border border-garis-kuat p-3 text-left aria-[current=page]:border-tinta aria-[current=page]:bg-tinta aria-[current=page]:text-kertas">
            <span className="block font-semibold">{p.judul}</span>
            <span className="mt-0.5 block text-xs opacity-80">{p.ket}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
