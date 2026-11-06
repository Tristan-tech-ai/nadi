import Link from "next/link";
import { notFound } from "next/navigation";
import { HalamanInfo } from "@/components/landing/halaman-info";
import { artikel, artikelUntuk, cariArtikel, kategoriUntuk, siapa, type Artikel } from "@/lib/bantuan/artikel";

type Bahasa = "id" | "en";
const T = {
  id: { awal: "", judul: "Pusat bantuan", pengantar: (n: number) => `${n} artikel tentang setiap layar Nadi. Cari, atau pilih topik.`, cari: "Cari bantuan", cariForm: "Cari di pusat bantuan", contoh: "Misalnya: lupa kata sandi, gaji, invoice", tombol: "Cari",
    hasil: (n: number, q: string) => (n ? `${n} artikel untuk "${q}"` : `Belum ada artikel untuk "${q}"`), kosong: "Coba kata lain, atau pilih topik di bawah. Masih buntu? Lihat", panduanPeran: "Panduan per peran",
    jejak: "Jejak", langkah: "Langkahnya", letak: "Di mana dan untuk siapa", letakMenu: "Letaknya di menu", ctrlK: "Di dalam aplikasi bisa juga dicari dengan Ctrl K.", siapa: "Yang bisa membuka", guna: "Gunanya",
    buka: (j: string) => `Buka ${j} di Nadi`, contohUsaha: "Lihat di usaha contoh", tombolTanya: "Di dalam aplikasi, tombol ? di samping judul halaman menjelaskan layar ini dan halaman lain di ruangnya.", terkait: "Artikel terkait" },
  en: { awal: "/en", judul: "Help center", pengantar: (n: number) => `${n} articles about every Nadi screen. Search, or pick a topic. The app itself is in Indonesian by default; button names are shown as they appear.`, cari: "Search help", cariForm: "Search the help center", contoh: "For example: forgot password, payroll, invoice", tombol: "Search",
    hasil: (n: number, q: string) => (n ? `${n} articles for "${q}"` : `No articles for "${q}" yet`), kosong: "Try another word, or pick a topic below. Still stuck? See the", panduanPeran: "guide by role",
    jejak: "Breadcrumb", langkah: "Steps", letak: "Where and for whom", letakMenu: "Where it is in the menu", ctrlK: "Inside the app you can also find it with Ctrl K.", siapa: "Who can open it", guna: "What it is for",
    buka: (j: string) => `Open ${j} in Nadi`, contohUsaha: "See it in the sample business", tombolTanya: "Inside the app, the ? button next to the page title explains this screen and the other pages in its space.", terkait: "Related articles" },
} as const;

const kelasKartu = "block rounded-[var(--radius-kartu)] border border-garis p-4 hover:bg-kertas-2";

function DaftarArtikel({ isi, bahasa }: { isi: Artikel[]; bahasa: Bahasa }) {
  return (
    <ul className="grid gap-2">
      {isi.map((a) => (
        <li key={a.slug}>
          <Link href={`${T[bahasa].awal}/bantuan/artikel/${a.slug}`} className={kelasKartu} data-testid="hasil-artikel">
            <span className="font-semibold">{a.judul}</span>
            <span className="mt-1 block text-[15px] text-tinta-2">{a.ringkas}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Formulir cari GET biasa: jalan tanpa JavaScript, hasil dihitung di server dari artikel yang sama. */
export function CariBantuan({ q, bahasa = "id" }: { q: string; bahasa?: Bahasa }) {
  const t = T[bahasa];
  return (
    <form action={`${t.awal}/bantuan`} method="get" role="search" className="flex flex-wrap gap-2" aria-label={t.cariForm}>
      <label htmlFor="cari-bantuan" className="sr-only">{t.cari}</label>
      <input id="cari-bantuan" name="q" type="search" defaultValue={q} placeholder={t.contoh}
        className="h-12 min-w-0 flex-1 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base" />
      <button type="submit" className="h-12 rounded-[var(--radius-isian)] bg-tinta px-5 font-semibold text-kertas">{t.tombol}</button>
    </form>
  );
}

export function HasilCari({ q, bahasa = "id" }: { q: string; bahasa?: Bahasa }) {
  const t = T[bahasa];
  const hasil = cariArtikel(q, bahasa);
  return (
    <section aria-labelledby="judul-hasil" className="mt-8">
      <h2 id="judul-hasil" className="papan papan-sedang">{t.hasil(hasil.length, q)}</h2>
      <div className="mt-4">
        {hasil.length ? <DaftarArtikel isi={hasil.slice(0, 20)} bahasa={bahasa} /> : (
          <p>{t.kosong} <Link href={`${t.awal}/panduan`} className="underline underline-offset-4">{t.panduanPeran}</Link>.</p>
        )}
      </div>
    </section>
  );
}

export function DaftarKategori({ bahasa = "id" }: { bahasa?: Bahasa }) {
  const semua = artikelUntuk(bahasa);
  return (
    <div className="mt-10 grid gap-10">
      {kategoriUntuk(bahasa).map((k) => {
        const isi = semua.filter((a) => a.kategori === k.id);
        if (!isi.length) return null;
        return (
          <section key={k.id} aria-labelledby={`kat-${k.id}`} data-testid="kategori-bantuan">
            <h2 id={`kat-${k.id}`} className="papan papan-sedang">{k.label}</h2>
            <p className="mt-1 text-tinta-2">{k.ket}</p>
            <div className="mt-4"><DaftarArtikel isi={isi} bahasa={bahasa} /></div>
          </section>
        );
      })}
    </div>
  );
}

export const judulPusat = (bahasa: Bahasa) => ({ judul: T[bahasa].judul, pengantar: T[bahasa].pengantar(artikelUntuk(bahasa).length) });

const tautan = "font-semibold underline underline-offset-4";

/** Halaman satu artikel (id atau en). */
export function HalamanArtikel({ slug, bahasa }: { slug: string; bahasa: Bahasa }) {
  const t = T[bahasa];
  const a = artikel(slug, bahasa);
  if (!a) notFound();
  const kat = kategoriUntuk(bahasa).find((k) => k.id === a.kategori);
  const terkait = artikelUntuk(bahasa).filter((x) => x.kategori === a.kategori && x.slug !== a.slug).slice(0, 6);
  return (
    <HalamanInfo judul={a.judul} pengantar={a.ringkas} warna="laut" bahasa={bahasa}>
      <nav aria-label={t.jejak} className="text-[15px] text-tinta-2" data-testid="jejak-bantuan">
        <Link href={`${t.awal}/bantuan`} className="underline underline-offset-4">{t.judul}</Link> / <span>{kat?.label}</span>
      </nav>
      {a.jenis === "tugas" ? (
        <section className="mt-6" aria-labelledby="judul-langkah">
          <h2 id="judul-langkah" className="papan papan-sedang">{t.langkah}</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-6" data-testid="langkah-artikel">{a.langkah.map((l) => <li key={l}>{l}</li>)}</ol>
          {a.catatan ? <p className="mt-6 rounded-[var(--radius-kartu)] bg-kertas-2 p-4">{a.catatan}</p> : null}
          <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2">{a.tautan.map((x) => <Link key={x.href} href={x.href} className={tautan}>{x.label}</Link>)}</p>
        </section>
      ) : (
        <section className="mt-6 grid gap-4" aria-labelledby="judul-letak">
          <h2 id="judul-letak" className="papan papan-sedang">{t.letak}</h2>
          <dl className="grid gap-3">
            <div><dt className="font-semibold">{t.letakMenu}</dt><dd>{a.ruang} / {a.judul}. {t.ctrlK}</dd></div>
            <div><dt className="font-semibold">{t.siapa}</dt><dd>{siapa(a.halaman.peran, bahasa)}.</dd></div>
            <div><dt className="font-semibold">{t.guna}</dt><dd>{bahasa === "en" ? a.halaman.guna.en : a.halaman.guna.id}</dd></div>
          </dl>
          <p className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href={a.halaman.href} className={tautan} data-testid="buka-layar">{t.buka(a.judul)}</Link>
            <Link href="/demo" className={tautan}>{t.contohUsaha}</Link>
          </p>
          <p className="text-[15px] text-tinta-2">{t.tombolTanya}</p>
        </section>
      )}
      {terkait.length ? (
        <section className="mt-10" aria-labelledby="judul-terkait">
          <h2 id="judul-terkait" className="papan papan-sedang">{t.terkait}</h2>
          <ul className="mt-4 grid gap-2">{terkait.map((x) => <li key={x.slug}><Link href={`${t.awal}/bantuan/artikel/${x.slug}`} className="underline underline-offset-4">{x.judul}</Link></li>)}</ul>
        </section>
      ) : null}
    </HalamanInfo>
  );
}
