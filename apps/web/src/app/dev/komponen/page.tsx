import type { Metadata } from "next";
import { CameraIcon, FileArrowUpIcon, ReceiptIcon } from "@phosphor-icons/react/dist/ssr";
import * as Ilustrasi from "@/components/ilustrasi";
import { Cap } from "@/components/ui/cap";
import { AksiUsulan, KartuUsulan } from "@/components/ui/kartu-usulan";
import { LogoNadi, TandaNadi } from "@/components/ui/logo";
import { Rupiah } from "@/components/ui/rupiah";
import { Tombol } from "@/components/ui/tombol";
import { formatJam, formatTanggal } from "@/lib/format";
import { WARNA } from "@/lib/tokens";

export const metadata: Metadata = { title: "Komponen Nadi", robots: { index: false, follow: false } };

// Lembar contoh statis tanpa usaha: zona contoh ditulis jelas, bukan bawaan fungsi format.
const contohWaktu = new Date("2026-10-31T06:30:00Z");
const ZONA_CONTOH = "Asia/Makassar";

export default function Komponen() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-garis pb-6">
        <LogoNadi />
        <p className="text-sm text-tinta-2">Lembar komponen, untuk pemeriksaan desain. Tidak tampil di menu.</p>
      </header>

      <section className="mt-10 grid gap-8 md:grid-cols-[7fr_5fr]">
        <div>
          <h1 className="font-judul text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
            Lempar nota apa saja. <span className="stabilo">Nadi yang merapikan.</span>
          </h1>
          <p className="mt-4 max-w-prose text-tinta-2">
            Contoh judul besar (Bricolage Grotesque) di atas teks antarmuka (Plus Jakarta Sans). Nomor dokumen memakai huruf mono:{" "}
            <span className="font-mono text-tinta">012/HRD/SK/X/2026</span>.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Tombol ukuran="besar">
              <FileArrowUpIcon size={20} aria-hidden />
              Lempar berkas
            </Tombol>
            <Tombol ukuran="besar" ragam="kedua">
              <CameraIcon size={20} aria-hidden />
              Foto nota
            </Tombol>
            <Tombol ukuran="besar" ragam="teks">Lihat contoh</Tombol>
          </div>
        </div>
        <div className="grid content-start gap-3">
          <KartuUsulan
            usulan={{
              judul: "Catat pembelian dari UD Sumber Rejeki",
              penjelasan: "Dibaca dari foto nota: 12 item, jatuh tempo 14 Nov 2026.",
              sumber: "Lempar, foto nota",
              keyakinan: 0.92,
              dampakRp: 1847500,
            }}
            aksi={<AksiUsulan />}
          />
          <KartuUsulan
            usulan={{
              judul: "Tahan gaji Rudi bulan ini",
              penjelasan: "Tidak ada absen sejak 3 Okt, tetapi gaji tetap terjadwal. Rekening sama dengan Andi.",
              sumber: "Gerbang Gaji",
              keyakinan: 0.97,
              dampakRp: 3200000,
              status: "ditahan",
            }}
          />
        </div>
      </section>

      <section className="mt-12" data-testid="ilustrasi">
        <h2 className="text-lg font-semibold">Ilustrasi</h2>
        <div className="mt-3 grid grid-cols-2 gap-6 sm:grid-cols-4">
          {Object.entries(Ilustrasi).map(([nama, Gambar]) => (
            <figure key={nama} className="flex flex-col items-start gap-1"><Gambar /><figcaption className="text-sm text-tinta-2">{nama.replace("Ilustrasi", "")}</figcaption></figure>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Cap status</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <Cap jenis="diterima" />
          <Cap jenis="lunas" />
          <Cap jenis="menunggu" />
          <Cap jenis="ditolak" />
          <Cap jenis="ditahan" />
        </div>
      </section>

      <section className="mt-12 grid gap-6 md:grid-cols-[5fr_7fr]">
        <div>
          <h2 className="text-lg font-semibold">Angka dan waktu</h2>
          <table className="mt-3 w-full text-sm">
            <tbody className="divide-y divide-garis">
              <tr><td className="py-2 text-tinta-2">Penjualan hari ini</td><td className="py-2 text-right"><Rupiah nilai={4875000} /></td></tr>
              <tr><td className="py-2 text-tinta-2">Tagihan belum dibayar</td><td className="py-2 text-right"><Rupiah nilai={12500000} /></td></tr>
              <tr><td className="py-2 text-tinta-2">Kas kecil</td><td className="py-2 text-right"><Rupiah nilai={-75000} /></td></tr>
              <tr><td className="py-2 text-tinta-2">Ringkas</td><td className="py-2 text-right"><Rupiah nilai={1250000} ringkas /></td></tr>
              <tr><td className="py-2 text-tinta-2">Waktu</td><td className="py-2 text-right angka">{formatTanggal(contohWaktu, ZONA_CONTOH)}, {formatJam(contohWaktu, ZONA_CONTOH)}</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <h2 className="text-lg font-semibold">Warna</h2>
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.keys(WARNA).map((nama) => (
              <li key={nama} className="flex items-center gap-2 text-sm">
                <span className="size-6 rounded-[4px] border border-garis" style={{ background: `var(--${nama})` }} aria-hidden />
                <span className="font-mono text-xs">{nama}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex items-center gap-4 text-tinta-2">
            <TandaNadi ukuran={40} />
            <ReceiptIcon size={24} aria-hidden />
            <span className="text-sm">Ikon: Phosphor, satu ketebalan (regular).</span>
          </div>
        </div>
      </section>

      <section className="mt-12 max-w-md">
        <h2 className="text-lg font-semibold">Isian</h2>
        <label className="mt-3 block text-sm font-medium" htmlFor="contoh-nama">Nama usaha</label>
        <input id="contoh-nama" className="mt-1 h-11 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base text-tinta placeholder:text-tinta-2" placeholder="Warung Bu Made" />
        <p className="mt-1 text-xs text-tinta-2">Nama yang tampil di nota dan slip gaji.</p>
      </section>
    </main>
  );
}
