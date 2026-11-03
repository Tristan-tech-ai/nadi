import Link from "next/link";
import { HalamanInfo } from "@/components/landing/halaman-info";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus } from "@/lib/i18n/kamus";

/** Panduan per peran (F6-06), dua bahasa (I-03). Satu langkah = satu hal yang dikerjakan orang itu, dengan tempatnya di aplikasi. */
export function HalamanPanduan({ bahasa }: { bahasa: Bahasa }) {
  const k = ambilKamus(bahasa).panduanHalaman;
  return (
    <HalamanInfo bahasa={bahasa} judul={k.judul} pengantar={k.pengantar}>
      <nav aria-label={k.pilihPeran} className="flex flex-wrap gap-2">
        {k.peran.map((p) => (
          <a key={p.id} href={`#${p.id}`} className="rounded-full border border-garis px-4 py-2 text-sm font-semibold hover:bg-kertas-2">{p.nama}</a>
        ))}
      </nav>
      {k.peran.map((p) => (
        <section key={p.id} id={p.id} aria-labelledby={`judul-${p.id}`} className="mt-10 scroll-mt-6 border-t border-garis pt-6" data-testid="panduan-peran">
          <h2 id={`judul-${p.id}`} className="font-judul text-2xl font-extrabold tracking-tight">{p.nama}</h2>
          <p className="mt-1 text-sm text-tinta-2">{p.untuk}</p>
          <ol className="mt-4 grid gap-4">
            {p.langkah.map((l, i) => (
              <li key={l.judul} className="flex gap-3">
                <span className="angka mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-garis-kuat text-sm font-semibold" aria-hidden>{i + 1}</span>
                <div>
                  <h3 className="font-semibold">{l.judul}</h3>
                  <p className="mt-0.5 text-tinta-2">{l.isi}</p>
                  {"href" in l && l.href ? <Link href={l.href} className="mt-1 inline-block text-sm font-semibold underline underline-offset-4">{l.label}</Link> : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
      <p className="mt-12 text-sm text-tinta-2">
        {k.cobaAwal} <Link href="/demo" hrefLang="id" className="font-semibold text-tinta underline underline-offset-4">{k.cobaTautan}</Link> {k.cobaAkhir}
      </p>
    </HalamanInfo>
  );
}
