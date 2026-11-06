import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HalamanInfo } from "@/components/landing/halaman-info";
import { artikel, kategori, SEMUA_ARTIKEL, siapa } from "@/lib/bantuan/artikel";

export function generateStaticParams() {
  return SEMUA_ARTIKEL.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: PageProps<"/bantuan/artikel/[slug]">): Promise<Metadata> {
  const a = artikel((await params).slug);
  return a ? { title: `${a.judul} | Bantuan Nadi`, description: a.ringkas, alternates: { canonical: `/bantuan/artikel/${a.slug}` } } : {};
}

const tautan = "font-semibold underline underline-offset-4";

export default async function ArtikelBantuan({ params }: PageProps<"/bantuan/artikel/[slug]">) {
  const a = artikel((await params).slug);
  if (!a) notFound();
  const kat = kategori().find((k) => k.id === a.kategori);
  const terkait = SEMUA_ARTIKEL.filter((x) => x.kategori === a.kategori && x.slug !== a.slug).slice(0, 6);
  return (
    <HalamanInfo judul={a.judul} pengantar={a.ringkas} warna="laut">
      <nav aria-label="Jejak" className="text-[15px] text-tinta-2" data-testid="jejak-bantuan">
        <Link href="/bantuan" className="underline underline-offset-4">Pusat bantuan</Link> / <span>{kat?.label}</span>
      </nav>
      {a.jenis === "tugas" ? (
        <section className="mt-6" aria-labelledby="judul-langkah">
          <h2 id="judul-langkah" className="papan papan-sedang">Langkahnya</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-6" data-testid="langkah-artikel">{a.langkah.map((l) => <li key={l}>{l}</li>)}</ol>
          {a.catatan ? <p className="mt-6 rounded-[var(--radius-kartu)] bg-kertas-2 p-4">{a.catatan}</p> : null}
          <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2">{a.tautan.map((t) => <Link key={t.href} href={t.href} className={tautan}>{t.label}</Link>)}</p>
        </section>
      ) : (
        <section className="mt-6 grid gap-4" aria-labelledby="judul-letak">
          <h2 id="judul-letak" className="papan papan-sedang">Di mana dan untuk siapa</h2>
          <dl className="grid gap-3">
            <div><dt className="font-semibold">Letaknya di menu</dt><dd>{a.ruang} / {a.judul}. Di dalam aplikasi bisa juga dicari dengan Ctrl K.</dd></div>
            <div><dt className="font-semibold">Yang bisa membuka</dt><dd>{siapa(a.halaman.peran)}.</dd></div>
            <div><dt className="font-semibold">Gunanya</dt><dd>{a.halaman.guna.id}</dd></div>
          </dl>
          <p className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href={a.halaman.href} className={tautan} data-testid="buka-layar">Buka {a.judul} di Nadi</Link>
            <Link href="/demo" className={tautan}>Lihat di usaha contoh</Link>
          </p>
          <p className="text-[15px] text-tinta-2">Di dalam aplikasi, tombol ? di samping judul halaman menjelaskan layar ini dan halaman lain di ruangnya.</p>
        </section>
      )}
      {terkait.length ? (
        <section className="mt-10" aria-labelledby="judul-terkait">
          <h2 id="judul-terkait" className="papan papan-sedang">Artikel terkait</h2>
          <ul className="mt-4 grid gap-2">{terkait.map((t) => <li key={t.slug}><Link href={`/bantuan/artikel/${t.slug}`} className="underline underline-offset-4">{t.judul}</Link></li>)}</ul>
        </section>
      ) : null}
    </HalamanInfo>
  );
}
