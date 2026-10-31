import type { Metadata } from "next";
import Link from "next/link";
import { DemoNota } from "@/components/landing/demo-nota";
import { LogoNadi } from "@/components/ui/logo";

// Landing (naskah: docs/design/landing.md). Statis, satu gerak bermakna (nota tercetak), satu tombol utama per layar.
export const metadata: Metadata = {
  title: "Nadi: lempar nota, Nadi yang merapikan",
  description: "Foto nota belanja, slip gaji, atau rekap absen. Nadi membacanya dan menyiapkan usulan yang tinggal kamu setujui dari HP.",
};

const MASALAH = [
  { masalah: "Nota belanja menumpuk di laci, baru dicatat akhir bulan.", nadi: "Foto notanya. Nadi menyalin barang, harga, dan total, lalu mencocokkan jumlah per baris dengan totalnya.", siap: true },
  { masalah: "Data karyawan tercecer di KTP, WhatsApp, dan Excel lama.", nadi: "Lempar foto KTP atau Excel karyawan. Nadi menyiapkan daftar orang; NIK hanya disimpan 4 digit akhirnya.", siap: true },
  { masalah: "Karyawan lapangan tidak punya email.", nadi: "Staf masuk dengan kode usaha, ID staf, dan PIN 6 angka.", siap: true },
  { masalah: "Mutasi rekening dicatat ulang satu per satu.", nadi: "Lempar CSV mutasi bank. Setiap baris jadi transaksi masuk atau keluar setelah kamu setujui.", siap: true },
  { masalah: "Absen di buku, gaji dihitung manual tiap bulan.", nadi: "Absen dari HP dan gaji yang dihitung dari bukti absen.", siap: false },
  { masalah: "Satu orang memegang kasir, gudang, dan antar barang.", nadi: "Topi: satu orang bisa memakai beberapa peran kerja, tugasnya ikut per peran.", siap: false },
];

const LANGKAH = [
  { judul: "Lempar", isi: "Foto, PDF, CSV, atau Excel. Dari HP, atau bagikan langsung dari WhatsApp." },
  { judul: "Nadi membaca", isi: "Isi berkas dirapikan dan angkanya dicocokkan. Keyakinan dan buktinya selalu terlihat." },
  { judul: "Kamu putuskan", isi: "Setujui atau tolak dari Feed. Baru setelah itu data tercatat." },
];

export default function Beranda() {
  return (
    <>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-6">
        <Link href="/" aria-label="Beranda Nadi">
          <LogoNadi />
        </Link>
        <Link href="/masuk" className="text-sm font-semibold underline-offset-4 hover:underline">Masuk</Link>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5">
        <section className="grid items-start gap-12 pt-12 pb-20 lg:grid-cols-[3fr_2fr] lg:gap-16 lg:pt-20" aria-labelledby="judul-utama">
          <div className="max-w-2xl">
            <h1 id="judul-utama" className="font-judul text-[1.9rem] font-extrabold leading-[1.08] tracking-tight sm:text-6xl">
              Lempar nota, slip, atau Excel apa saja. <span className="stabilo">Nadi yang merapikan.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-tinta-2">
              Foto nota belanja, slip gaji, atau rekap absen. Nadi membacanya dan menyiapkan usulan: catat belanja, tambah karyawan, masukkan absen. Tidak ada yang tercatat sebelum kamu setujui.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link href="/daftar" className="inline-flex h-12 items-center rounded-[var(--radius-isian)] bg-tinta px-6 font-semibold text-kertas transition-[background-color,transform] duration-150 hover:bg-tinta/90 active:translate-y-px">
                Mulai dari satu nota
              </Link>
              <p className="text-sm text-tinta-2">
                Sudah punya akun? <Link href="/masuk" className="font-semibold text-tinta underline underline-offset-4">Masuk</Link>
              </p>
            </div>
          </div>
          <DemoNota />
        </section>

        <section className="border-t border-garis py-16" aria-labelledby="judul-masalah">
          <h2 id="judul-masalah" className="font-judul text-3xl font-extrabold tracking-tight">Pekerjaan kecil yang menghabiskan malammu</h2>
          <p className="mt-2 max-w-2xl text-tinta-2">Yang sudah bisa dikerjakan Nadi hari ini, dan yang sedang dibuat. Tidak ada yang kami akui sebelum jadi.</p>
          <ul className="mt-8 divide-y divide-garis border-y border-garis">
            {MASALAH.map((m) => (
              <li key={m.masalah} className="grid gap-2 py-5 md:grid-cols-[2fr_3fr_7.5rem] md:gap-8">
                <p className="font-semibold">{m.masalah}</p>
                <p className="text-tinta-2">{m.nadi}</p>
                <p className={`text-sm font-semibold md:text-right ${m.siap ? "text-daun" : "text-tinta-2"}`}>{m.siap ? "Sudah bisa" : "Sedang dibuat"}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="grid gap-12 border-t border-garis py-16 lg:grid-cols-[2fr_3fr]" aria-labelledby="judul-cara">
          <h2 id="judul-cara" className="font-judul text-3xl font-extrabold tracking-tight">Tiga langkah, satu jari</h2>
          <ol className="space-y-8">
            {LANGKAH.map((l, i) => (
              <li key={l.judul} className="grid grid-cols-[2.5rem_1fr] gap-4">
                <span className="angka font-mono text-2xl font-medium text-tinta-2" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="text-lg font-semibold">{l.judul}</h3>
                  <p className="mt-1 text-tinta-2">{l.isi}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-12 border-t border-garis py-16 lg:grid-cols-2" aria-label="Hemat dan asisten AI">
          <div>
            <h2 className="font-judul text-3xl font-extrabold tracking-tight">Berkas kedua dibaca tanpa AI</h2>
            <p className="mt-4 text-tinta-2">
              Setelah membaca satu berkas, Nadi menulis aturan untuk tata letaknya. Slip gaji, invoice pemasok, mutasi bank, dan nota berikutnya dengan tata letak sama dibaca dengan aturan itu, tanpa memanggil AI dan tanpa biaya token.
            </p>
            <p className="mt-4 text-sm text-tinta-2">Pada uji kami dengan berkas contoh: <span className="angka font-semibold text-tinta">5 dari 5</span> tata letak terbaca ulang tanpa AI.</p>
          </div>
          <div>
            <h2 className="font-judul text-3xl font-extrabold tracking-tight">Pakai asisten AI yang sudah kamu langgani</h2>
            <p className="mt-4 text-tinta-2">
              Asisten AI yang mendukung MCP bisa tersambung ke Nadi atas izinmu, membaca data usaha sesuai peranmu, dan mengajukan usulan. Semua perubahan tetap menunggu persetujuanmu, dan izinnya bisa kamu cabut kapan saja.
            </p>
          </div>
        </section>

        <section className="border-t border-garis py-16" aria-labelledby="judul-data">
          <h2 id="judul-data" className="font-judul text-3xl font-extrabold tracking-tight">Datamu terpisah, kamu yang memutuskan</h2>
          <ul className="mt-6 grid gap-4 text-tinta-2 md:grid-cols-3">
            <li>Data setiap usaha terpisah di database dan diperiksa per baris. Pemisahannya diuji otomatis.</li>
            <li>NIK tidak disimpan utuh: hanya sidik acak dan 4 digit akhirnya.</li>
            <li>Kunci AI tidak pernah ada di HP atau browser. Semua panggilan AI lewat server.</li>
          </ul>
        </section>

        <section className="border-t border-garis py-20" aria-labelledby="judul-mulai">
          <h2 id="judul-mulai" className="font-judul text-4xl font-extrabold tracking-tight">Mulai dari satu nota.</h2>
          <p className="mt-3 max-w-xl text-tinta-2">Buat akun, siapkan usahamu, lalu foto nota belanja hari ini. Usulan pertamamu muncul dalam hitungan detik.</p>
          <Link href="/daftar" className="mt-8 inline-flex h-12 items-center rounded-[var(--radius-isian)] bg-tinta px-6 font-semibold text-kertas transition-[background-color,transform] duration-150 hover:bg-tinta/90 active:translate-y-px">
            Buat akun
          </Link>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-garis px-5 py-8 text-sm text-tinta-2">
        <p>© 2026 Nadi</p>
        <nav aria-label="Tautan kaki" className="flex gap-5">
          <Link href="/masuk" className="hover:text-tinta">Masuk</Link>
          <Link href="/masuk/staf" className="hover:text-tinta">Masuk sebagai staf</Link>
        </nav>
      </footer>
    </>
  );
}
