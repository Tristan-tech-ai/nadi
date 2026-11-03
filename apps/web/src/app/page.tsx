import type { Metadata } from "next";
import Link from "next/link";
import { DemoNota } from "@/components/landing/demo-nota";
import { BUKTI, FAQ, HARI, PERAN, SEDANG_DIBUAT } from "@/components/landing/isi";
import { KakiSitus, KepalaSitus } from "@/components/landing/kepala-kaki";
import { Rupiah } from "@/components/ui/rupiah";
import { formatAngka } from "@/lib/format";
import { DISKON_TAHUNAN_BULAN, PAKET } from "@/lib/paket";

// Landing D-11 (docs/design/iterasi/landing): pahlawan = kartu nota hidup, tur fitur = buku kas satu hari, harga = tabel buku kas.
// Statis, satu gerak bermakna (nota tercetak), satu tombol utama per layar.
export const metadata: Metadata = {
  title: "Nadi: lempar nota, Nadi yang merapikan",
  description: "Nota, absen, izin, gaji, tagihan, dan pembukuan usaha kecil dalam satu Feed yang kamu setujui dari HP.",
};


const judul2 = "font-judul text-3xl font-extrabold tracking-tight sm:text-4xl";

export default function Beranda() {
  return (
    <>
      <KepalaSitus />

      <main className="mx-auto w-full max-w-6xl px-5">
        <section className="grid items-start gap-x-16 gap-y-8 pt-10 pb-20 lg:grid-cols-[3fr_2fr] lg:pt-20" aria-labelledby="judul-utama">
          <h1 id="judul-utama" className="font-judul text-[1.9rem] font-extrabold leading-[1.08] tracking-tight sm:text-6xl lg:col-start-1 lg:row-start-1">
            Lempar nota, slip, atau Excel apa saja. <span className="stabilo">Nadi yang merapikan.</span>
          </h1>
          <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <DemoNota />
          </div>
          <div className="max-w-xl lg:col-start-1 lg:row-start-2">
            <p className="text-lg text-tinta-2">
              Nota, absen, izin, gaji, tagihan, dan pembukuan usaha kecil berubah jadi usulan di satu Feed. Kamu setujui dari HP; tidak ada yang tercatat sebelum itu.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link href="/daftar" className="inline-flex h-12 items-center rounded-[var(--radius-isian)] bg-tinta px-6 font-semibold text-kertas transition-[background-color,transform] duration-150 hover:bg-tinta/90 active:translate-y-px">
                Mulai dari satu nota
              </Link>
              <Link href="/demo" className="text-sm font-semibold underline underline-offset-4">Buka usaha contoh tanpa daftar</Link>
            </div>
          </div>
        </section>

        <section id="hari" className="scroll-mt-6 border-t border-garis py-16" aria-labelledby="judul-hari">
          <h2 id="judul-hari" className={judul2}>Satu hari di warung, satu buku kas</h2>
          <p className="mt-3 max-w-2xl text-tinta-2">Setiap baris di bawah sudah berjalan di Nadi hari ini. Coba sendiri di usaha contoh: semua tombolnya bisa ditekan.</p>
          <ol className="mt-10 border-y border-garis">
            {HARI.map((h) => (
              <li key={h.jam} className="grid gap-x-6 gap-y-1 border-b border-garis py-5 last:border-b-0 md:grid-cols-[6.5rem_6rem_1fr_1.5fr]">
                <p className="angka font-mono text-sm font-medium text-tinta md:border-r md:border-cap/40 md:pr-4">{h.jam}</p>
                <p className="text-xs font-bold uppercase tracking-wide text-tinta-2 md:pt-0.5">{h.peran}</p>
                <p className="font-semibold">{h.kejadian}</p>
                <p className="text-tinta-2">{h.nadi}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="peran" className="scroll-mt-6 border-t border-garis py-16" aria-labelledby="judul-peran">
          <h2 id="judul-peran" className={judul2}>Siapa memakai apa</h2>
          <p className="mt-3 max-w-2xl text-tinta-2">Satu usaha, empat layar sesuai peran. Panduan per peran ada di <Link href="/panduan" className="font-semibold text-tinta underline underline-offset-4">halaman panduan</Link>.</p>
          <div className="mt-10 grid gap-10 md:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {PERAN.map((p) => (
              <div key={p.peran} className="border-t-2 border-tinta pt-4">
                <h3 className="text-lg font-bold">{p.peran}</h3>
                <p className="mt-1 text-sm text-tinta-2">{p.ringkas}</p>
                <ul className="mt-4 divide-y divide-garis text-sm">
                  {p.fitur.map((f) => (
                    <li key={f} className="py-2">{f}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-garis py-16" aria-labelledby="judul-bukti">
          <h2 id="judul-bukti" className={judul2}>Angka yang bisa kamu periksa</h2>
          <p className="mt-3 max-w-2xl text-tinta-2">Belum ada logo pelanggan atau jumlah pengguna di sini, karena Nadi baru dibuka. Yang ada adalah hasil uji kami sendiri.</p>
          <dl className="mt-10 grid gap-x-8 gap-y-6 border-y border-garis py-6 sm:grid-cols-2 lg:grid-cols-4">
            {BUKTI.map((b) => (
              <div key={b.angka}>
                <dt className="angka font-mono text-3xl font-medium">{b.angka}</dt>
                <dd className="mt-1 text-sm text-tinta-2">{b.isi}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="harga" className="scroll-mt-6 border-t border-garis py-16" aria-labelledby="judul-harga">
          <h2 id="judul-harga" className={judul2}>Harga</h2>
          <p className="mt-3 max-w-2xl text-tinta-2">
            <span className="stabilo">Selama masa uji semua paket gratis dan belum ada tagihan.</span> Harga di bawah adalah rencana per bulan, belum termasuk PPN. Bayar tahunan: {DISKON_TAHUNAN_BULAN} bulan gratis.
          </p>
          <ul className="mt-10 border-y border-garis">
            {PAKET.map((p) => (
              <li key={p.kode} className="grid gap-x-8 gap-y-2 border-b border-garis py-6 last:border-b-0 md:grid-cols-[9rem_13rem_1fr]">
                <h3 className="text-lg font-bold">{p.nama}</h3>
                <div>
                  <p className="text-2xl font-semibold">
                    {p.mulaiDari && <span className="mr-1 text-sm font-normal text-tinta-2">mulai</span>}
                    <Rupiah nilai={p.harga} />
                  </p>
                  <p className="mt-1 text-sm text-tinta-2">
                    sampai {p.orang} orang{p.perOrangTambahan !== null && <>, lalu <Rupiah nilai={p.perOrangTambahan} /> per orang</>}
                  </p>
                </div>
                <p className="text-tinta-2">{p.isi.join(" · ")}{p.berkasPerBulan !== null && ` · ${formatAngka(p.berkasPerBulan)} berkas per bulan`}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="keamanan" className="scroll-mt-6 border-t border-garis py-16" aria-labelledby="judul-keamanan">
          <h2 id="judul-keamanan" className={judul2}>Datamu terpisah, kamu yang memutuskan</h2>
          <ul className="mt-8 grid gap-x-8 gap-y-5 text-tinta-2 md:grid-cols-2">
            <li><span className="font-semibold text-tinta">Terpisah per usaha.</span> Database memeriksa setiap baris sebelum dibaca, dan pemisahannya diuji pada setiap perubahan.</li>
            <li><span className="font-semibold text-tinta">AI tidak memutuskan uang.</span> AI membaca dan mengusulkan; persetujuan, gaji, dan pelunasan selalu lewat tombolmu.</li>
            <li><span className="font-semibold text-tinta">NIK tidak disimpan utuh.</span> Hanya sidik acak dan 4 digit akhirnya.</li>
            <li><span className="font-semibold text-tinta">Kamera dan suara diproses di perangkat.</span> Mata dan transkrip wawancara berjalan di HP atau laptopmu; gambar kamera tidak diunggah.</li>
            <li><span className="font-semibold text-tinta">Kunci AI tidak pernah di HP atau browser.</span> Semua panggilan AI lewat server di Singapura.</li>
            <li><span className="font-semibold text-tinta">Semua bisa ditelusuri.</span> Setiap keputusan otomatis tercatat dengan alasannya dan bisa dibatalkan.</li>
          </ul>
        </section>

        <section id="faq" className="scroll-mt-6 border-t border-garis py-16" aria-labelledby="judul-faq">
          <h2 id="judul-faq" className={judul2}>Pertanyaan yang sering muncul</h2>
          <div className="mt-8 max-w-3xl divide-y divide-garis border-y border-garis">
            {FAQ.map((f) => (
              <details key={f.tanya} className="group py-4">
                <summary className="cursor-pointer list-none font-semibold marker:hidden">
                  <span className="mr-2 inline-block font-mono text-tinta-2 transition-transform duration-150 group-open:rotate-90" aria-hidden>›</span>
                  {f.tanya}
                </summary>
                <p className="mt-3 pl-5 text-tinta-2">{f.jawab}</p>
              </details>
            ))}
          </div>
          <div className="mt-12">
            <h3 className="text-sm font-bold uppercase tracking-wide text-tinta-2">Sedang dibuat</h3>
            <ul className="mt-2 space-y-1 text-tinta-2">
              {SEDANG_DIBUAT.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </div>
        </section>

        <section className="border-t border-garis py-20" aria-labelledby="judul-mulai">
          <h2 id="judul-mulai" className="font-judul text-4xl font-extrabold tracking-tight">Mulai dari satu nota.</h2>
          <p className="mt-3 max-w-xl text-tinta-2">Buat akun, siapkan usahamu, lalu foto nota belanja hari ini. Usulan pertamamu muncul dalam hitungan detik.</p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/daftar" className="inline-flex h-12 items-center rounded-[var(--radius-isian)] bg-tinta px-6 font-semibold text-kertas transition-[background-color,transform] duration-150 hover:bg-tinta/90 active:translate-y-px">
              Buat akun
            </Link>
            <Link href="/demo" className="text-sm font-semibold underline underline-offset-4">atau buka usaha contoh dulu</Link>
          </div>
        </section>
      </main>

      <KakiSitus />
    </>
  );
}
