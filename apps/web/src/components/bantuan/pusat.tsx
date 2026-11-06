import Link from "next/link";
import { type Artikel, cariArtikel, kategori, SEMUA_ARTIKEL } from "@/lib/bantuan/artikel";

const kelasKartu = "block rounded-[var(--radius-kartu)] border border-garis p-4 hover:bg-kertas-2";

function DaftarArtikel({ isi }: { isi: Artikel[] }) {
  return (
    <ul className="grid gap-2">
      {isi.map((a) => (
        <li key={a.slug}>
          <Link href={`/bantuan/artikel/${a.slug}`} className={kelasKartu} data-testid="hasil-artikel">
            <span className="font-semibold">{a.judul}</span>
            <span className="mt-1 block text-[15px] text-tinta-2">{a.ringkas}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Formulir cari GET biasa: jalan tanpa JavaScript, hasil dihitung di server dari artikel yang sama. */
export function CariBantuan({ q }: { q: string }) {
  return (
    <form action="/bantuan" method="get" role="search" className="flex flex-wrap gap-2" aria-label="Cari di pusat bantuan">
      <label htmlFor="cari-bantuan" className="sr-only">Cari bantuan</label>
      <input id="cari-bantuan" name="q" type="search" defaultValue={q} placeholder="Misalnya: lupa kata sandi, gaji, invoice"
        className="h-12 min-w-0 flex-1 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base" />
      <button type="submit" className="h-12 rounded-[var(--radius-isian)] bg-tinta px-5 font-semibold text-kertas">Cari</button>
    </form>
  );
}

export function HasilCari({ q }: { q: string }) {
  const hasil = cariArtikel(q);
  return (
    <section aria-labelledby="judul-hasil" className="mt-8">
      <h2 id="judul-hasil" className="papan papan-sedang">{hasil.length ? `${hasil.length} artikel untuk "${q}"` : `Belum ada artikel untuk "${q}"`}</h2>
      <div className="mt-4">
        {hasil.length ? <DaftarArtikel isi={hasil.slice(0, 20)} /> : (
          <p>Coba kata lain, atau pilih topik di bawah. Masih buntu? Lihat <Link href="/panduan" className="underline underline-offset-4">Panduan per peran</Link>.</p>
        )}
      </div>
    </section>
  );
}

export function DaftarKategori() {
  return (
    <div className="mt-10 grid gap-10">
      {kategori().map((k) => {
        const isi = SEMUA_ARTIKEL.filter((a) => a.kategori === k.id);
        if (!isi.length) return null;
        return (
          <section key={k.id} aria-labelledby={`kat-${k.id}`} data-testid="kategori-bantuan">
            <h2 id={`kat-${k.id}`} className="papan papan-sedang">{k.label}</h2>
            <p className="mt-1 text-tinta-2">{k.ket}</p>
            <div className="mt-4"><DaftarArtikel isi={isi} /></div>
          </section>
        );
      })}
    </div>
  );
}
