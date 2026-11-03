import type { Metadata } from "next";
import Link from "next/link";
import { LogoNadi } from "@/components/ui/logo";

export const metadata: Metadata = { title: "Panduan", description: "Cara memakai Nadi untuk pemilik, admin, staf, dan akuntan." };

type Langkah = { judul: string; isi: string; tautan?: { href: string; label: string } };
type Peran = { id: string; nama: string; untuk: string; langkah: Langkah[] };

// F6-06: panduan per peran. Satu langkah = satu hal yang dikerjakan orang itu, dengan tempatnya di aplikasi.
const PERAN: Peran[] = [
  {
    id: "pemilik",
    nama: "Pemilik",
    untuk: "Kamu yang memutuskan uang, orang, dan aturan usaha.",
    langkah: [
      { judul: "Daftar dan siapkan usaha", isi: "Buat akun, beri nama usaha, pilih jenisnya. Nadi memasang topi (peran kerja) yang biasa ada di usaha sejenis.", tautan: { href: "/daftar", label: "Buat akun" } },
      { judul: "Lempar berkas apa saja", isi: "Foto nota, slip, mutasi bank, atau Excel daftar karyawan. Nadi membacanya lalu menyiapkan usulan untuk kamu setujui; tidak ada yang tersimpan tanpa persetujuanmu." },
      { judul: "Putuskan dari Feed", isi: "Setiap pagi buka Feed: setujui atau tolak usulan, paling mendesak di atas. Sarapan data di atasnya berisi paling banyak 3 hal yang berdampak rupiah, dan kosong bila tidak ada yang penting." },
      { judul: "Atur izin dan gaji", isi: "Tentukan aturan izin (berapa hari boleh disetujui otomatis), lalu siapkan gaji bulanan. Orang dengan tanda janggal (rekening ganda, tanpa absen) ditahan sampai kamu periksa." },
      { judul: "Tagih dengan invoice", isi: "Terbitkan invoice bernomor dengan QRIS atau rekening usahamu. Pengingat muncul di harinya; kamu yang mengirim lewat WhatsApp." },
      { judul: "Pantau meja dan antrean", isi: "Di Mata, pakai kamera tablet atau rekaman video dan gambar zona meja. Gambar diproses di perangkat; yang tersimpan hanya status. Peta usaha menampilkannya langsung." },
      { judul: "Hubungkan AI milikmu", isi: "Di Usahamu, sambungkan asisten AI lewat MCP. Asisten hanya bisa membaca dan mengusulkan; keputusan tetap di Feed." },
    ],
  },
  {
    id: "admin",
    nama: "Admin",
    untuk: "Kamu yang membantu pemilik mengurus orang dan berkas setiap hari.",
    langkah: [
      { judul: "Masuk ke usaha", isi: "Pemilik menambahkanmu sebagai admin. Setelah masuk, pilih usaha yang sedang kamu urus di Usahamu." },
      { judul: "Rapikan data orang", isi: "Tambah karyawan, buatkan akun staf (kode usaha, ID staf, PIN), dan pasang topinya." },
      { judul: "Susun jadwal dan kerja", isi: "Isi kebutuhan shift lalu minta usulan jadwal. Batas lembur dijaga otomatis sesuai PP 35/2021. Bagi kerja di papan Kerja." },
      { judul: "Teruskan usulan", isi: "Usulan uang besar (bawaan di atas Rp5.000.000) hanya bisa diputuskan pemilik; sisanya bisa kamu setujui atau tolak dari Feed." },
    ],
  },
  {
    id: "staf",
    nama: "Staf",
    untuk: "Kamu yang bekerja di lapangan: kasir, pelayan, koki, gudang.",
    langkah: [
      { judul: "Masuk tanpa email", isi: "Pakai kode usaha, ID staf (misalnya S001), dan PIN 6 angka dari pemilik atau admin.", tautan: { href: "/masuk/staf", label: "Masuk sebagai staf" } },
      { judul: "Absen dengan QR", isi: "Pindai QR di tablet pintu, lalu kedip dan menoleh sebentar. Foto wajahmu tidak pernah dikirim." },
      { judul: "Ajukan izin", isi: "Pilih sakit, izin, atau cuti, isi tanggal, lampirkan bukti bila diminta. Kamu langsung melihat disetujui atau tidak, beserta alasannya." },
      { judul: "Lihat kerja dan slip gaji", isi: "Kerja yang ditugaskan ke kamu ada di papan Kerja. Slip gaji muncul setelah pemilik menyetujui gaji bulan itu." },
      { judul: "Tukar shift", isi: "Lepas shift ke rekan bertopi sama; pemilik atau admin yang menyetujui supaya batas lembur tetap terjaga." },
    ],
  },
  {
    id: "akuntan",
    nama: "Akuntan",
    untuk: "Kamu yang memegang pembukuan dan pajak beberapa klien.",
    langkah: [
      { judul: "Terima undangan klien", isi: "Pemilik menambahkanmu lewat email akun Nadi. Semua klienmu tampil di Ruang Akuntan." },
      { judul: "Periksa pembukuan", isi: "Jurnal dari invoice, belanja, dan gaji sudah terpasang. Kunci bulan yang sudah selesai; koreksi dibuat dengan jurnal balik bertanggal hari ini." },
      { judul: "Ekspor untuk Coretax", isi: "Unduh BPMP (PPh 21 bulanan pegawai tetap) dalam susunan template resmi DJP, lalu ubah ke XML dengan konverter resmi." },
      { judul: "Cek posisi pajak usaha", isi: "Kompas Pajak menunjukkan posisi PPh final UMKM dan pasal dasarnya. Kamu melihat dan mengekspor; persetujuan gaji dan usulan tetap di pemilik." },
    ],
  },
];

export default function Panduan() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 pt-6 pb-16">
      <div className="flex items-center justify-between">
        <Link href="/" aria-label="Beranda Nadi"><LogoNadi /></Link>
        <Link href="/masuk" className="text-sm font-semibold underline-offset-4 hover:underline">Masuk</Link>
      </div>
      <h1 className="mt-8 font-judul text-3xl font-extrabold tracking-tight">Panduan Nadi</h1>
      <p className="mt-2 text-tinta-2">Pilih peranmu. Setiap langkah menyebut di mana tempatnya di aplikasi.</p>
      <nav aria-label="Pilih peran" className="mt-6 flex flex-wrap gap-2">
        {PERAN.map((p) => (
          <a key={p.id} href={`#${p.id}`} className="rounded-full border border-garis px-4 py-2 text-sm font-semibold hover:bg-kertas-2">{p.nama}</a>
        ))}
      </nav>
      {PERAN.map((p) => (
        <section key={p.id} id={p.id} aria-labelledby={`judul-${p.id}`} className="mt-10 scroll-mt-6 border-t border-garis pt-6" data-testid="panduan-peran">
          <h2 id={`judul-${p.id}`} className="text-xl font-semibold">{p.nama}</h2>
          <p className="mt-1 text-sm text-tinta-2">{p.untuk}</p>
          <ol className="mt-4 grid gap-4">
            {p.langkah.map((l, i) => (
              <li key={l.judul} className="flex gap-3">
                <span className="angka mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-garis-kuat text-sm font-semibold" aria-hidden>{i + 1}</span>
                <div>
                  <h3 className="font-semibold">{l.judul}</h3>
                  <p className="mt-0.5 text-tinta-2">{l.isi}</p>
                  {l.tautan ? <Link href={l.tautan.href} className="mt-1 inline-block text-sm font-semibold underline underline-offset-4">{l.tautan.label}</Link> : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
      <p className="mt-12 text-sm text-tinta-2">
        Ingin mencoba dulu? <Link href="/demo" className="font-semibold text-tinta underline underline-offset-4">Buka usaha contoh</Link> tanpa daftar.
      </p>
    </main>
  );
}
