// Kamus situs publik bahasa Indonesia (I-02). Sumber bentuk untuk semua bahasa: kamus lain bertipe Kamus dan dites
// berkunci identik (kamus.test.ts). Isi tur fitur diambil dari components/landing/isi.ts.
import { BUKTI, FAQ, HARI, PERAN, SEDANG_DIBUAT } from "@/components/landing/isi";
import { PAKET } from "@/lib/paket";

export const kamusId = {
  meta: {
    judul: "Nadi: lempar nota, Nadi yang merapikan",
    deskripsi: "Nota, absen, izin, gaji, tagihan, dan pembukuan usaha kecil dalam satu Feed yang kamu setujui dari HP.",
  },
  kepala: {
    beranda: "Beranda Nadi",
    navUtama: "Utama",
    nav: { hari: "Satu hari", peran: "Siapa memakai", harga: "Harga", keamanan: "Keamanan", panduan: "Panduan" },
    masuk: "Masuk",
    cobaContoh: "Coba usaha contoh",
  },
  pemilih: { label: "Bahasa", id: "Bahasa Indonesia", en: "English" },
  kaki: {
    slogan: "Kertas kerja usaha kecil yang mengisi dirinya sendiri.",
    produk: "Produk",
    contohMakanan: "Usaha contoh (makanan)",
    contohToko: "Usaha contoh (toko)",
    panduan: "Panduan per peran",
    harga: "Harga",
    tentang: "Tentang Nadi",
    akun: "Akun",
    buatAkun: "Buat akun",
    masuk: "Masuk",
    masukStaf: "Masuk sebagai staf",
    keamanan: "Keamanan data",
    privasi: "Kebijakan privasi",
    syarat: "Syarat layanan",
  },
  beranda: {
    judulAwal: "Lempar nota, slip, atau Excel apa saja.",
    judulSorot: "Nadi yang merapikan.",
    pengantar: "Nota, absen, izin, gaji, tagihan, dan pembukuan usaha kecil berubah jadi usulan di satu Feed. Kamu setujui dari HP; tidak ada yang tercatat sebelum itu.",
    mulai: "Mulai dari satu nota",
    bukaContoh: "Buka usaha contoh tanpa daftar",
    hariJudul: "Satu hari di warung, satu buku kas",
    hariPengantar: "Setiap baris di bawah sudah berjalan di Nadi hari ini. Coba sendiri di usaha contoh: semua tombolnya bisa ditekan.",
    peranJudul: "Siapa memakai apa",
    peranPengantarAwal: "Satu usaha, empat layar sesuai peran. Panduan per peran ada di",
    peranPengantarTautan: "halaman panduan",
    buktiJudul: "Angka yang bisa kamu periksa",
    buktiPengantar: "Belum ada logo pelanggan atau jumlah pengguna di sini, karena Nadi baru dibuka. Yang ada adalah hasil uji kami sendiri.",
    hargaJudul: "Harga",
    hargaSorot: "Selama masa uji semua paket gratis dan belum ada tagihan.",
    hargaRencana: "Harga di bawah adalah rencana per bulan, belum termasuk PPN.",
    hargaTahunan: "Bayar tahunan: {n} bulan gratis.",
    mulaiHarga: "mulai",
    sampaiOrang: "sampai {n} orang",
    laluPerOrang: ", lalu {harga} per orang",
    berkasPerBulan: "{n} berkas per bulan",
    keamananJudul: "Datamu terpisah, kamu yang memutuskan",
    keamanan: [
      { judul: "Terpisah per usaha.", isi: "Database memeriksa setiap baris sebelum dibaca, dan pemisahannya diuji pada setiap perubahan." },
      { judul: "AI tidak memutuskan uang.", isi: "AI membaca dan mengusulkan; persetujuan, gaji, dan pelunasan selalu lewat tombolmu." },
      { judul: "NIK tidak disimpan utuh.", isi: "Hanya sidik acak dan 4 digit akhirnya." },
      { judul: "Kamera dan suara diproses di perangkat.", isi: "Mata dan transkrip wawancara berjalan di HP atau laptopmu; gambar kamera tidak diunggah." },
      { judul: "Kunci AI tidak pernah di HP atau browser.", isi: "Semua panggilan AI lewat server di Singapura." },
      { judul: "Semua bisa ditelusuri.", isi: "Setiap keputusan otomatis tercatat dengan alasannya dan bisa dibatalkan." },
    ],
    faqJudul: "Pertanyaan yang sering muncul",
    sedangDibuat: "Sedang dibuat",
    akhirJudul: "Mulai dari satu nota.",
    akhirIsi: "Buat akun, siapkan usahamu, lalu foto nota belanja hari ini. Usulan pertamamu muncul dalam hitungan detik.",
    akhirBuat: "Buat akun",
    akhirContoh: "atau buka usaha contoh dulu",
  },
  aplikasi: {
    lompat: "Lompat ke isi",
    beranda: "Beranda aplikasi",
    navUtama: "Navigasi utama",
    keluar: "Keluar",
    usahaCadangan: "Perusahaan",
    nav: { feed: "Feed", lempar: "Lempar", kerja: "Kerja", izin: "Izin", gaji: "Gaji", magang: "Magang", orang: "Orang", akuntan: "Akuntan", usaha: "Usaha" },
  },
  demo: {
    label: "Contoh nota belanja",
    judulAwal: "Catat belanja",
    judulAkhir: "di UD Sumber Rejeki",
    ringkas: "3 barang, nota NT-4671. Jumlah per baris cocok dengan total.",
    setujui: "Setujui",
    tolak: "Tolak",
    diterima: "Diterima",
    ditolak: "Ditolak",
    tercatat: "Tercatat sebagai belanja 13 Okt 2026.",
    tidakDicatat: "Tidak dicatat. Nota tetap tersimpan sebagai bukti.",
    ulangi: "Ulangi",
    catatan: "Contoh dengan nota uji. Di Nadi, kartu ini muncul di Feed setelah kamu memotret nota.",
  },
  paket: Object.fromEntries(PAKET.map((p) => [p.kode, { nama: p.nama, isi: p.isi }])) as Record<string, { nama: string; isi: string[] }>,
  isi: { hari: HARI as { jam: string; peran: string; kejadian: string; nadi: string }[], peran: PERAN as { peran: string; ringkas: string; fitur: string[] }[], bukti: BUKTI, faq: FAQ, sedangDibuat: SEDANG_DIBUAT },
};

export type Kamus = typeof kamusId;

/** Isi {nama} di teks kamus. */
export function isiTeks(teks: string, nilai: Record<string, string | number>): string {
  return teks.replace(/\{(\w+)\}/g, (_, k: string) => String(nilai[k] ?? `{${k}}`));
}
