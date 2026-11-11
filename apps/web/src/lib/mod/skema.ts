// Nadi Mod v1: fitur tambahan berupa DATA (manifest JSON) yang dijalankan penafsir tetap Nadi. Tidak ada kode pengguna
// yang dieksekusi. Spesifikasi lengkap: docs/design/MOD.md; riset dan alasan: docs/research/mod.md.

export const VERSI_SKEMA = 1 as const;

/** Tipe bidang tetap (17 isian + 1 hitung). Rujukan ke data inti usaha selalu dibatasi usaha yang sama oleh database. */
export const TIPE_BIDANG = [
  "teks", "teks_panjang", "angka", "rupiah", "tanggal", "tanggal_jam", "pilihan", "pilihan_banyak", "centang",
  "tautan", "telepon", "berkas", "orang", "pelanggan", "produk", "proyek", "rujukan", "rumus",
] as const;
export type TipeBidang = (typeof TIPE_BIDANG)[number];

/** Rujukan ke data inti usaha (dibaca lewat RLS, tidak pernah lintas usaha). */
export const SUMBER_INTI = { orang: "orang", pelanggan: "customer", produk: "produk", proyek: "dimension" } as const;

export const PERAN = ["pemilik", "admin", "akuntan", "staf"] as const;
export type Peran = (typeof PERAN)[number];

/**
 * Tingkat akses per peran, aditif seperti hak akses Odoo, ditegakkan database:
 * tidak < lihat (baca semua) < milik_sendiri (baca semua, tulis yang dibuat atau ditugaskan ke dirinya) < tulis (tulis semua) < kelola (tulis + arsip + pindah status apa pun).
 */
export const AKSES = ["tidak", "lihat", "milik_sendiri", "tulis", "kelola"] as const;
export type Akses = (typeof AKSES)[number];
/** Batas atas per peran: mod tidak bisa memberi staf atau akuntan lebih dari "tulis"; pemilik dan admin selalu "kelola". */
export const AKSES_MAKS: Record<Peran, Akses> = { pemilik: "kelola", admin: "kelola", akuntan: "tulis", staf: "tulis" };

export const JENIS_TAMPILAN = ["daftar", "papan", "kalender", "formulir", "rincian"] as const;
export type JenisTampilan = (typeof JENIS_TAMPILAN)[number];

/** Letak di menu: salah satu ruang aplikasi (src/lib/ruang.ts). */
export const RUANG_MOD = ["hari-ini", "uang", "jual", "barang", "orang", "tempat", "dokumen", "otomasi"] as const;

/** Ikon yang boleh dipakai mod (nama ikon Phosphor yang sudah dimuat aplikasi). */
export const IKON_MOD = [
  "kanban", "kalender", "kalender-cek", "daftar-cek", "papan-klip", "map", "dokumen", "tas-kerja", "gedung", "toko", "kubus",
  "paket", "truk", "kunci-pas", "kotak-alat", "orang-tiga", "kartu-id", "topi-wisuda", "megafon", "obrolan", "headset", "kamera-video",
  "target", "bola-lampu", "petir", "perisai", "stempel", "tanda-tangan", "struk", "dompet", "koin", "grafik", "peta", "hadiah",
  "pesawat", "jangkar", "mata", "salib-medis", "rumah", "kunci",
] as const;
export type IkonMod = (typeof IKON_MOD)[number];

export const BATAS = {
  manifestByte: 64 * 1024,
  koleksi: 10,
  bidangPerKoleksi: 40,
  pilihanPerBidang: 50,
  status: 12,
  transisi: 60,
  tampilanPerKoleksi: 8,
  otomasi: 20,
  laporan: 10,
  teksLabel: 60,
  teksDeskripsi: 300,
  rumusHuruf: 200,
  catatanPerKoleksi: 20000,
  modPerUsaha: 40,
} as const;

export type Pilihan = { kode: string; label: string; warna?: "abu" | "kunyit" | "daun" | "laut" | "cap" };

export type Bidang = {
  kode: string;
  label: string;
  tipe: TipeBidang;
  wajib?: boolean;
  petunjuk?: string;
  pilihan?: Pilihan[];
  /** angka/rupiah */
  min?: number;
  max?: number;
  /** orang: true = banyak orang (pelaksana). rujukan: kode koleksi di mod yang sama. */
  banyak?: boolean;
  koleksi?: string;
  /** orang yang ditugaskan: dipakai akses milik_sendiri dan peran transisi "ditugaskan" */
  penugasan?: boolean;
  /** rumus: ekspresi tata bahasa Nadi (lihat rumus.ts), hanya dihitung saat ditampilkan */
  rumus?: string;
};

export type StatusDef = { kode: string; label: string; akhir?: boolean; warna?: Pilihan["warna"] };
/** Peran transisi: peran aplikasi, atau "pembuat" (yang membuat catatan) dan "ditugaskan" (orang di bidang penugasan). */
export type PeranTransisi = Peran | "pembuat" | "ditugaskan";
export type Transisi = { dari: string[] | "*"; ke: string; peran: PeranTransisi[]; wajib_isi?: string[]; label?: string };
export type AlurStatus = { awal: string; daftar: StatusDef[]; transisi: Transisi[] };

export type Tampilan =
  | { jenis: "daftar"; kolom: string[]; urut?: { bidang: string; arah: "naik" | "turun" }; saring?: string[] }
  | { jenis: "papan"; kolom_kartu: string[] }
  | { jenis: "kalender"; tanggal: string }
  | { jenis: "formulir"; bidang: string[] }
  | { jenis: "rincian"; bidang: string[] };

export type Koleksi = {
  kode: string;
  nama: string;
  judul: string;
  bidang: Bidang[];
  status?: AlurStatus;
  tampilan: Tampilan[];
  akses: Record<Peran, Akses>;
};

export type Otomasi = {
  kode: string;
  pemicu: { jenis: "buat" | "status"; koleksi: string; ke?: string } | { jenis: "tenggat"; koleksi: string; bidang: string; hari_sebelum: number };
  syarat?: { bidang: string; op: "sama" | "beda" | "lebih" | "kurang" | "berisi"; nilai: string | number | boolean }[];
  aksi: { jenis: "kartu" | "pengingat"; judul: string; kepada: "pengelola" | "pembuat" | "ditugaskan" } | { jenis: "kerja"; judul: string; kepada: "ditugaskan" | "pengelola" };
};

export type Laporan = { kode: string; judul: string; koleksi: string; kelompok: string; hitung: "jumlah" | { total: string } };

export type Manifest = {
  skema: typeof VERSI_SKEMA;
  kode: string;
  nama: string;
  deskripsi: string;
  ikon: IkonMod;
  ruang: (typeof RUANG_MOD)[number];
  versi: string;
  koleksi: Koleksi[];
  otomasi?: Otomasi[];
  laporan?: Laporan[];
};

/** Contoh lengkap: fitur proyek agensi dari dokumen Laravel (Petunjuk Teknis v1.0), disusun sebagai mod. */
export const CONTOH_PROYEK_AGENSI: Manifest = {
  skema: 1,
  kode: "proyek-agensi",
  nama: "Proyek agensi",
  deskripsi: "Proyek klien dengan tugas tim, subtugas, kirim hasil, review, dan log rapat.",
  ikon: "kanban",
  ruang: "jual",
  versi: "1.0.0",
  koleksi: [
    {
      kode: "proyek",
      nama: "Proyek",
      judul: "nama",
      bidang: [
        { kode: "nama", label: "Nama proyek", tipe: "teks", wajib: true },
        { kode: "klien", label: "Klien", tipe: "pelanggan" },
        { kode: "pic", label: "PIC", tipe: "orang", wajib: true, penugasan: true },
        { kode: "tim", label: "Tim", tipe: "orang", banyak: true, penugasan: true },
        { kode: "jenis", label: "Jenis", tipe: "pilihan", pilihan: [{ kode: "sekali", label: "Sekali" }, { kode: "berulang", label: "Berulang" }, { kode: "berkelanjutan", label: "Berkelanjutan" }] },
        { kode: "target_awal", label: "Target awal", tipe: "tanggal" },
        { kode: "tenggat", label: "Tenggat", tipe: "tanggal" },
        { kode: "nilai", label: "Nilai kontrak", tipe: "rupiah", min: 0 },
      ],
      status: {
        awal: "rencana",
        daftar: [{ kode: "rencana", label: "Rencana" }, { kode: "jalan", label: "Berjalan", warna: "laut" }, { kode: "tunda", label: "Ditunda", warna: "kunyit" },
          { kode: "selesai", label: "Selesai", akhir: true, warna: "daun" }, { kode: "batal", label: "Batal", akhir: true, warna: "cap" }],
        transisi: [{ dari: "*", ke: "jalan", peran: ["pemilik", "admin", "ditugaskan"] }, { dari: ["jalan"], ke: "tunda", peran: ["pemilik", "admin", "ditugaskan"] },
          { dari: ["jalan", "tunda"], ke: "selesai", peran: ["pemilik", "admin"] }, { dari: "*", ke: "batal", peran: ["pemilik", "admin"] }],
      },
      tampilan: [{ jenis: "daftar", kolom: ["nama", "klien", "pic", "tenggat"], urut: { bidang: "tenggat", arah: "naik" }, saring: ["jenis"] }, { jenis: "papan", kolom_kartu: ["klien", "tenggat"] },
        { jenis: "formulir", bidang: ["nama", "klien", "pic", "tim", "jenis", "target_awal", "tenggat", "nilai"] }],
      akses: { pemilik: "kelola", admin: "kelola", akuntan: "lihat", staf: "milik_sendiri" },
    },
    {
      kode: "tugas",
      nama: "Tugas",
      judul: "judul",
      bidang: [
        { kode: "judul", label: "Judul", tipe: "teks", wajib: true },
        { kode: "proyek", label: "Proyek", tipe: "rujukan", koleksi: "proyek", wajib: true },
        { kode: "induk", label: "Bagian dari", tipe: "rujukan", koleksi: "tugas" },
        { kode: "pic", label: "PIC", tipe: "orang", wajib: true, penugasan: true },
        { kode: "pelaksana", label: "Pelaksana", tipe: "orang", banyak: true, penugasan: true },
        { kode: "tenggat", label: "Tenggat", tipe: "tanggal_jam" },
        { kode: "hasil", label: "Tautan hasil", tipe: "tautan" },
        { kode: "catatan_hasil", label: "Catatan hasil", tipe: "teks_panjang" },
        { kode: "catatan_revisi", label: "Catatan revisi", tipe: "teks_panjang" },
        { kode: "terlambat", label: "Terlambat (hari)", tipe: "rumus", rumus: "JIKA(KOSONG({tenggat}), 0, MAKS(0, HARI_ANTARA({tenggat}, HARI_INI())))" },
      ],
      status: {
        awal: "antrian",
        daftar: [{ kode: "antrian", label: "Antrian" }, { kode: "dikerjakan", label: "Dikerjakan", warna: "laut" }, { kode: "review", label: "Review", warna: "kunyit" },
          { kode: "selesai", label: "Selesai", akhir: true, warna: "daun" }],
        transisi: [{ dari: ["antrian"], ke: "dikerjakan", peran: ["ditugaskan", "pemilik", "admin"] },
          { dari: ["dikerjakan"], ke: "review", peran: ["ditugaskan"], wajib_isi: ["hasil"], label: "Kirim untuk review" },
          { dari: ["review"], ke: "dikerjakan", peran: ["pemilik", "admin"], wajib_isi: ["catatan_revisi"], label: "Minta revisi" },
          { dari: ["review"], ke: "selesai", peran: ["pemilik", "admin"], label: "Terima" }],
      },
      tampilan: [{ jenis: "papan", kolom_kartu: ["proyek", "pelaksana", "tenggat"] }, { jenis: "daftar", kolom: ["judul", "proyek", "pic", "tenggat", "terlambat"], saring: ["proyek"] },
        { jenis: "kalender", tanggal: "tenggat" }, { jenis: "formulir", bidang: ["judul", "proyek", "induk", "pic", "pelaksana", "tenggat"] },
        { jenis: "rincian", bidang: ["judul", "proyek", "induk", "pic", "pelaksana", "tenggat", "hasil", "catatan_hasil", "catatan_revisi", "terlambat"] }],
      akses: { pemilik: "kelola", admin: "kelola", akuntan: "lihat", staf: "milik_sendiri" },
    },
    {
      kode: "aktivitas",
      nama: "Rapat dan hambatan",
      judul: "judul",
      bidang: [
        { kode: "judul", label: "Judul", tipe: "teks", wajib: true },
        { kode: "proyek", label: "Proyek", tipe: "rujukan", koleksi: "proyek", wajib: true },
        { kode: "jenis", label: "Jenis", tipe: "pilihan", wajib: true, pilihan: [{ kode: "rapat", label: "Rapat" }, { kode: "kunjungan", label: "Kunjungan" }, { kode: "revisi", label: "Revisi klien" }, { kode: "hambatan", label: "Hambatan" }] },
        { kode: "waktu", label: "Waktu", tipe: "tanggal_jam", wajib: true },
        { kode: "peserta", label: "Peserta hadir", tipe: "orang", banyak: true },
        { kode: "durasi", label: "Durasi (menit)", tipe: "angka", min: 0, max: 1440 },
        { kode: "dampak", label: "Dampak ke jadwal", tipe: "teks_panjang" },
      ],
      tampilan: [{ jenis: "daftar", kolom: ["waktu", "judul", "proyek", "jenis"], urut: { bidang: "waktu", arah: "turun" }, saring: ["jenis", "proyek"] }, { jenis: "kalender", tanggal: "waktu" },
        { jenis: "formulir", bidang: ["judul", "proyek", "jenis", "waktu", "peserta", "durasi", "dampak"] }],
      akses: { pemilik: "kelola", admin: "kelola", akuntan: "lihat", staf: "tulis" },
    },
  ],
  otomasi: [
    { kode: "minta-review", pemicu: { jenis: "status", koleksi: "tugas", ke: "review" }, aksi: { jenis: "kartu", judul: "Tugas {judul} menunggu review", kepada: "pengelola" } },
    { kode: "ingat-tenggat", pemicu: { jenis: "tenggat", koleksi: "tugas", bidang: "tenggat", hari_sebelum: 1 }, aksi: { jenis: "pengingat", judul: "Besok tenggat: {judul}", kepada: "ditugaskan" } },
  ],
  laporan: [{ kode: "tugas-per-status", judul: "Tugas per status", koleksi: "tugas", kelompok: "status", hitung: "jumlah" }],
};
