// L-04 pusat bantuan publik. Dua sumber, keduanya dari aplikasi itu sendiri supaya tidak melenceng diam-diam:
// (1) satu artikel per halaman di peta ruang (src/lib/ruang.ts: guna, siapa yang bisa memakai, letaknya di menu, halaman terkait);
// (2) artikel tugas yang ditulis tangan untuk hal yang paling sering ditanyakan, masing-masing menyebut layar dan tombol yang ada.
import { RUANG, type Halaman, type Peran } from "@/lib/ruang";
import { KATALOG_RESMI } from "@/lib/mod/katalog";
import type { Koleksi, Manifest } from "@/lib/mod/skema";
import { KATEGORI_EN, TUGAS_EN } from "./artikel-en";

export type Langkah = string;
export type ArtikelTugas = { slug: string; kategori: string; judul: string; ringkas: string; langkah: Langkah[]; catatan?: string; tautan: { href: string; label: string }[]; cari: string };
export type ArtikelHalaman = { slug: string; kategori: string; judul: string; ringkas: string; halaman: Halaman; ruang: string };
export type Artikel = ({ jenis: "tugas" } & ArtikelTugas) | ({ jenis: "halaman" } & ArtikelHalaman);

export const KATEGORI_TUGAS = [
  { id: "mulai", label: "Mulai dan akun", ket: "Daftar, masuk, lupa kata sandi, dan akun staf." },
  { id: "ai", label: "AI dan sambungan", ket: "Menyambungkan AI-mu lewat MCP dan menyiapkan usaha dari dokumen." },
  { id: "aman", label: "Keamanan dan data", ket: "Siapa yang bisa melihat apa, dan apa yang dibaca AI." },
] as const;

const PERAN_LABEL: Record<Peran, string> = { pemilik: "pemilik", admin: "admin", akuntan: "akuntan", staf: "staf" };

export const TUGAS: ArtikelTugas[] = [
  { slug: "tidak-bisa-masuk", kategori: "mulai", judul: "Tidak bisa masuk atau lupa kata sandi", ringkas: "Atur ulang kata sandi, atau masuk lewat email tanpa kata sandi.",
    langkah: [
      "Buka halaman Masuk, lalu pilih Lupa kata sandi? di samping isian kata sandi.",
      "Tulis email akunmu dan pilih Kirim email. Buka email dari Nadi di HP atau komputer yang sama, lalu ketuk tautannya.",
      "Buat kata sandi baru (minimal 8 karakter). Setelah disimpan kamu langsung masuk.",
      "Tidak ingin mengingat kata sandi? Pilih Masuk lewat email tanpa kata sandi di halaman Masuk.",
    ],
    catatan: "Email belum datang? Cek folder Spam atau Promosi. Kirim ulang bisa setelah 60 detik. Bila halaman daftar menulis bahwa email sudah punya akun, berarti akunnya sudah ada: masuk, jangan daftar lagi.",
    tautan: [{ href: "/masuk/lupa", label: "Atur ulang kata sandi" }, { href: "/masuk/kode", label: "Masuk lewat email" }], cari: "login masuk lupa password sandi reset kode otp email tidak datang" },
  { slug: "buat-akun", kategori: "mulai", judul: "Membuat akun dan menyiapkan usaha", ringkas: "Dari daftar sampai usaha siap dipakai.",
    langkah: [
      "Buka Daftar, tulis email dan kata sandi, lalu pilih Buat akun.",
      "Buka email dari Nadi dan ketuk tautannya untuk mengaktifkan akun.",
      "Beri nama usahamu dan pilih jenisnya. Nadi menyalakan menu yang biasa dipakai usaha sejenis; kamu bisa mengubahnya nanti di Usahamu.",
      "Pilih Isi sendiri, atau Siapkan dengan AI-mu bila daftar karyawan dan aturan kerjamu ada di dokumen.",
    ],
    tautan: [{ href: "/daftar", label: "Buat akun" }], cari: "daftar register sign up akun baru usaha" },
  { slug: "masuk-staf", kategori: "mulai", judul: "Staf masuk tanpa email", ringkas: "Kode usaha, ID staf, dan PIN dari pemilik.",
    langkah: [
      "Pemilik atau admin membuka Orang, mengisi PIN 6 angka di baris orang itu, lalu memilih Buat akun staf.",
      "Nadi menampilkan kode usaha (6 huruf) dan ID staf (misalnya S001). Berikan keduanya beserta PIN ke staf.",
      "Staf membuka Masuk staf dan mengisi kode usaha, ID, dan PIN.",
    ],
    catatan: "PIN salah 5 kali dalam 15 menit mengunci akun staf selama 15 menit. Pemilik bisa mengganti PIN dari halaman Orang.",
    tautan: [{ href: "/masuk/staf", label: "Masuk staf" }], cari: "staf karyawan pin kode usaha id staf" },
  { slug: "lempar-dan-setujui", kategori: "hari-ini", judul: "Lempar berkas lalu setujui usulannya", ringkas: "Berkas menjadi usulan; tidak ada yang tersimpan sebelum kamu setuju.",
    langkah: [
      "Buka Lempar berkas dan lempar foto nota, slip, mutasi bank, atau Excel.",
      "Nadi membaca berkasnya dan menaruh usulan di Feed keputusan, lengkap dengan sumber dan seberapa yakin.",
      "Di kartu usulan, baca Kalau disetujui untuk melihat akibatnya, dan Lihat rincian untuk melihat apa yang ditambah atau diubah.",
      "Pilih Setujui atau Tolak. Setelah disetujui, ikuti tautan Lihat di untuk membuka datanya.",
    ],
    tautan: [{ href: "/app/lempar", label: "Lempar berkas" }, { href: "/app", label: "Feed keputusan" }], cari: "upload unggah nota struk usulan setujui approve feed" },
  { slug: "invoice-qris", kategori: "uang", judul: "Membuat invoice dengan QRIS", ringkas: "Tagihan bernomor yang bisa dibayar lewat QRIS atau rekening.",
    langkah: [
      "Buka Invoice dan atur cara bayar usaha sekali: QRIS statis atau rekening.",
      "Buka Invoice, pilih pelanggan, isi barang atau jasanya, lalu terbitkan.",
      "Salin tautan invoice dan kirim sendiri lewat WhatsApp. Pelanggan melihat tagihan dan QRIS tanpa perlu akun.",
      "Saat uang masuk, cocokkan dengan mutasi di Kas dan bank; invoice menjadi lunas.",
    ],
    catatan: "Nadi tidak mengirim pesan ke pelanggan atas namamu.",
    tautan: [{ href: "/app/invoice", label: "Invoice" }], cari: "tagihan qris bayar piutang tagih whatsapp" },
  { slug: "gaji-bulanan", kategori: "orang", judul: "Menyiapkan gaji bulanan", ringkas: "Gaji pokok, PPh 21, BPJS, lalu slip.",
    langkah: [
      "Isi gaji pokok dan status pajak (misalnya TK/0) setiap orang di halaman Orang.",
      "Buka Gaji, pilih bulannya, lalu siapkan draf gaji.",
      "Gerbang Gaji menahan orang yang janggal (misalnya tanpa absen) beserta alasannya. Periksa lalu putuskan.",
      "Setujui gajinya; slip terbit untuk setiap orang.",
    ],
    catatan: "Nadi menghitung, tetapi tidak memindahkan uang. Transfer tetap kamu lakukan sendiri. Hitung cepat tanpa akun ada di Alat gratis.",
    tautan: [{ href: "/app/gaji", label: "Gaji" }, { href: "/alat/gaji", label: "Kalkulator gaji bersih" }], cari: "payroll slip pph21 bpjs upah gaji bersih" },
  { slug: "sambung-ai", kategori: "ai", judul: "Menyambungkan AI-mu (MCP)", ringkas: "AI-mu menyiapkan draf; kamu yang menerapkan.",
    langkah: [
      "Buka Siapkan dengan AI, bagian Sambungkan AI-mu.",
      "Pilih Salin prompt lengkap untuk AI-mu, lalu tempel di chat AI-mu. Prompt itu berisi alamat server Nadi, cara memasangnya, alat yang boleh dipakai, dan batasannya.",
      "Izinkan sambungan di halaman izin Nadi yang terbuka.",
      "Beri AI-mu dokumen usaha. AI menulis satu draf; periksa di layar tinjau draf, lalu pilih Terapkan. Ada 10 menit untuk membatalkan.",
    ],
    catatan: "AI tidak bisa menerapkan draf, menyetujui, atau memindahkan uang. Cabut sambungannya kapan saja di Usahamu.",
    tautan: [{ href: "/app/siapkan", label: "Siapkan dengan AI" }], cari: "mcp chatgpt gemini ai asisten prompt sambung konektor" },
  { slug: "tanpa-mcp", kategori: "ai", judul: "Menyiapkan usaha dengan chat AI biasa", ringkas: "Untuk chat AI yang tidak mendukung MCP, termasuk yang gratis.",
    langkah: [
      "Di Siapkan dengan AI, pilih Salin prompt dan tempel di chat AI-mu bersama daftar karyawan atau aturan kerja.",
      "AI menjawab dengan satu blok berawalan NADI ONBOARDING 1. Baca dan betulkan bila perlu.",
      "Tempel blok itu kembali di Nadi. Nadi menjadikannya satu draf yang bisa kamu ubah sebelum diterapkan.",
    ],
    tautan: [{ href: "/app/siapkan", label: "Siapkan dengan AI" }], cari: "prompt teks nadi chat ai gratis onboarding" },
  { slug: "mode-coba", kategori: "mulai", judul: "Mencoba Nadi tanpa daftar", ringkas: "Buka aplikasi sungguhan di usaha contoh.",
    langkah: [
      "Buka halaman Coba Nadi dan pilih Buka usaha contoh.",
      "Kamu masuk ke aplikasi Nadi di usaha contoh Toko Bu Sari sebagai pemilik. Semua nama dan angka karangan.",
      "Buka layar apa pun. Perubahan tidak disimpan dan AI tidak dipakai.",
      "Pilih Keluar dari mode coba di pita atas, atau Buat akun untuk usahamu.",
    ],
    tautan: [{ href: "/demo", label: "Coba Nadi" }], cari: "demo coba trial contoh tanpa daftar" },
  { slug: "dua-langkah", kategori: "aman", judul: "Menyalakan verifikasi dua langkah", ringkas: "Kode dari aplikasi autentikator setiap kali masuk.",
    langkah: [
      "Buka Akun dan keamanan.",
      "Pilih nyalakan verifikasi dua langkah, lalu pindai kodenya dengan aplikasi autentikator di HP.",
      "Ketik kode 6 angka yang tampil untuk memastikan.",
      "Di halaman yang sama kamu bisa melihat perangkat yang sedang masuk dan mengeluarkannya.",
    ],
    tautan: [{ href: "/app/akun/keamanan", label: "Akun dan keamanan" }], cari: "2fa mfa autentikator keamanan sesi perangkat" },
  { slug: "data-dan-ai", kategori: "aman", judul: "Apa yang dibaca AI dan siapa yang melihat datamu", ringkas: "Data tiap usaha terpisah; AI membaca sesedikit mungkin.",
    langkah: [
      "Data setiap usaha dipisah di database; orang dari usaha lain tidak bisa membukanya.",
      "Berkas yang dilempar dibaca AI hanya bila Nadi belum mengenal formatnya. Format yang sudah dikenal dibaca tanpa AI.",
      "Mata menghitung orang di perangkatmu. Wajah tidak disimpan; yang dikirim hanya angkanya.",
      "Gaji hanya terlihat oleh pemilik, dan staf hanya melihat data dirinya sendiri.",
    ],
    tautan: [{ href: "/keamanan", label: "Keamanan" }, { href: "/privasi", label: "Privasi" }], cari: "privasi keamanan data ai rahasia wajah mata" },
  { slug: "pindah-aplikasi", kategori: "otomasi", judul: "Pindah dari aplikasi lain", ringkas: "Bawa daftar akun, kontak, karyawan, dan produk.",
    langkah: [
      "Ekspor data dari aplikasi lamamu ke Excel atau CSV.",
      "Buka Pindah dari aplikasi lain dan pilih berkasnya.",
      "Nadi mengenali kolomnya dan menyiapkan satu usulan. Data yang sudah ada dilewati.",
      "Setujui usulannya. Semua datamu juga bisa diunduh kembali dari halaman yang sama.",
    ],
    tautan: [{ href: "/app/pindah", label: "Pindah dari aplikasi lain" }], cari: "migrasi impor jurnal accurate excel csv pindah" },
  { slug: "menambah-fitur", kategori: "tambahan", judul: "Menambah fitur untuk usahamu", ringkas: "Nyalakan modul bawaan atau pasang paket resmi tanpa mengulang dari awal.",
    langkah: [
      "Buka Tambah fitur di ruang Fitur tambahan.",
      "Di Modul bawaan, nyalakan modul yang dipakai usahamu, misalnya kasir atau janji temu.",
      "Di Paket resmi, paket yang cocok untuk jenis usahamu tampil paling atas dengan tanda Cocok untuk usahamu. Pilih Lihat rincian untuk melihat isian, alur status, dan siapa yang bisa mengisi.",
      "Pilih Pasang. Paket muncul di Fitur tambahan dan siap diisi.",
    ],
    catatan: "Melepas paket hanya menyembunyikannya dari menu; catatannya tetap tersimpan dan tampil lagi saat dipasang kembali.",
    tautan: [{ href: "/app/tambah-fitur", label: "Tambah fitur" }], cari: "tambah fitur paket resmi modul pasang plugin ekstensi" },
  { slug: "buat-fitur-sendiri", kategori: "tambahan", judul: "Membuat fitur sendiri tanpa kode", ringkas: "Susun bagian dan isian lewat formulir, atau impor berkas fitur dari usaha lain.",
    langkah: [
      "Buka Tambah fitur, lalu pilih Susun lewat formulir, tanpa menulis JSON.",
      "Tulis nama fitur, nama bagian, dan isiannya. Isian Teks pendek pertama menjadi judul catatan.",
      "Bila perlu alur, tulis tahap status dipisah koma, misalnya Belum, Dikerjakan, Selesai.",
      "Pilih Periksa dan simpan draf. Nadi memeriksanya; draf yang lolos diterapkan dari daftar draf di Tambah fitur.",
      "Punya berkas fitur dari usaha lain? Pilih berkasnya di bagian Buat sendiri; berkas itu juga menjadi draf yang kamu periksa dulu.",
    ],
    catatan: "Setiap fitur punya riwayat versi. Bila perubahan salah, buka Versi dan berkas lalu pilih Kembalikan ke versi sebelumnya.",
    tautan: [{ href: "/app/tambah-fitur/buat", label: "Susun fitur" }, { href: "/app/tambah-fitur", label: "Tambah fitur" }], cari: "buat fitur sendiri formulir manifest json impor berkas versi kembalikan" },
  { slug: "fitur-dengan-ai", kategori: "ai", judul: "Membuat fitur dengan AI-mu", ringkas: "AI-mu menyusun draf fitur lewat MCP; kamu yang menerapkan.",
    langkah: [
      "Sambungkan AI-mu ke Nadi lewat MCP dari halaman Siapkan usaha.",
      "Di Tambah fitur, bagian Buat dengan AI-mu, pilih Salin prompt untuk AI-mu lalu tempel ke AI-mu bersama kebutuhanmu, misalnya dokumen alur kerja tim.",
      "AI-mu membaca aturan fitur, menguji susunannya, dan menulis draf. AI tidak bisa menerapkan, mematikan, atau mengubah fitur yang sudah aktif.",
      "Draf muncul di Tambah fitur. Periksa alasannya bila ada, lalu pilih Terapkan.",
    ],
    catatan: "Setiap draf dari AI diperiksa pemeriksa Nadi yang bukan AI. Isi catatan yang dibaca AI ditandai sebagai data, bukan perintah.",
    tautan: [{ href: "/app/tambah-fitur", label: "Tambah fitur" }, { href: "/app/siapkan", label: "Siapkan usaha" }], cari: "ai mcp chatgpt gemini buat fitur draf otomatis" },
];

const slugHalaman = (href: string) => (href === "/app" ? "feed-keputusan" : href.replace(/^\/app\//, "").replace(/\//g, "-"));

export const ARTIKEL_HALAMAN: ArtikelHalaman[] = RUANG.flatMap((r) =>
  r.halaman.map((h) => ({ slug: slugHalaman(h.href), kategori: r.id, judul: h.label.id, ringkas: h.guna.id, halaman: h, ruang: r.label.id })),
);

// X-14: satu artikel per paket resmi, diturunkan dari manifest yang sama dengan yang dipasang (isian wajib, alur status,
// pengingat), jadi panduannya tidak bisa melenceng dari paketnya. Tautan ke halaman rincian paket di Tambah fitur.
const wajibDari = (k: Koleksi) => k.bidang.filter((b) => b.wajib).map((b) => b.label.toLowerCase());
const daftarKata = (x: string[], dan: string) => (x.length <= 1 ? x.join("") : `${x.slice(0, -1).join(", ")} ${dan} ${x[x.length - 1]}`);
function langkahPaket(m: Manifest, en: boolean): string[] {
  const l = en
    ? [`Open Add features, find ${m.nama} under Official packs, and choose Lihat rincian to see every field, the status flow, and who can fill it in.`,
       `Choose Pasang. Nadi checks the pack with the same checker used for AI-made features, then ${m.nama} appears under Add-on features.`]
    : [`Buka Tambah fitur, cari ${m.nama} di Paket resmi, lalu pilih Lihat rincian untuk melihat setiap isian, alur status, dan siapa yang bisa mengisi.`,
       `Pilih Pasang. Nadi memeriksa paketnya dengan pemeriksa yang sama untuk fitur buatan AI, lalu ${m.nama} muncul di Fitur tambahan.`];
  for (const k of m.koleksi) {
    const w = wajibDari(k);
    l.push(en ? `In ${k.nama}, choose Tambah ${k.nama.toLowerCase()} and fill in ${w.length ? daftarKata(w, "and") : "what you need"}${w.length ? " (required)" : ""}.`
      : `Di bagian ${k.nama}, pilih Tambah ${k.nama.toLowerCase()} lalu isi ${w.length ? daftarKata(w, "dan") : "yang perlu"}${w.length ? " (wajib)" : ""}.`);
    const t = k.status?.transisi.filter((x) => x.label) ?? [];
    if (k.status && t.length) l.push(en ? `Move ${k.nama.toLowerCase()} along its status with the buttons ${daftarKata(t.map((x) => x.label!), "and")}; buttons that need extra fields open them first.`
      : `Pindahkan ${k.nama.toLowerCase()} lewat tombol ${daftarKata(t.map((x) => x.label!), "dan")}; tombol yang wajib mengisi sesuatu membuka isiannya dulu.`);
  }
  return l;
}
function catatanPaket(m: Manifest, en: boolean) {
  const o = (m.otomasi ?? []).map((x) => x.aksi.judul.replace(/\{([a-z_0-9]+)\}/g, "...")).slice(0, 3);
  const lepas = en ? "Removing the pack only hides it from the menu; its records stay and come back when you install it again." : "Melepas paket hanya menyembunyikannya dari menu; catatannya tetap tersimpan dan tampil lagi saat dipasang kembali.";
  return o.length ? `${en ? "Automatic reminders and cards" : "Pengingat dan kartu otomatis"}: ${o.join("; ")}. ${lepas}` : lepas;
}
export const ARTIKEL_PAKET: ArtikelTugas[] = KATALOG_RESMI.map(({ manifest: m, untuk }) => ({
  slug: `paket-${m.kode}`, kategori: "tambahan", judul: `Paket ${m.nama}`, ringkas: m.deskripsi, langkah: langkahPaket(m, false),
  catatan: `Cocok untuk: ${untuk} ${catatanPaket(m, false)}`,
  tautan: [{ href: `/app/tambah-fitur/${m.kode}`, label: `Rincian ${m.nama}` }, { href: "/app/tambah-fitur", label: "Tambah fitur" }],
  cari: `paket fitur tambahan mod ${m.nama.toLowerCase()} ${m.koleksi.map((k) => k.nama.toLowerCase()).join(" ")} ${m.koleksi.flatMap((k) => k.bidang.map((b) => b.label.toLowerCase())).join(" ")}`,
}));
const PAKET_EN: Record<string, { judul: string; ringkas: string; langkah: string[]; catatan: string; tautan: string[] }> = Object.fromEntries(KATALOG_RESMI.map(({ manifest: m }) => [`paket-${m.kode}`, {
  judul: `${m.nama} pack`, ringkas: m.deskripsi, langkah: langkahPaket(m, true), catatan: catatanPaket(m, true), tautan: [`${m.nama} details`, "Add features"],
}]));

export const SEMUA_ARTIKEL: Artikel[] = [
  ...TUGAS.map((t) => ({ jenis: "tugas" as const, ...t })),
  ...ARTIKEL_PAKET.map((t) => ({ jenis: "tugas" as const, ...t })),
  ...ARTIKEL_HALAMAN.map((a) => ({ jenis: "halaman" as const, ...a })),
];

export function kategori() {
  return [
    ...KATEGORI_TUGAS.slice(0, 1).map((k) => ({ ...k })),
    ...RUANG.map((r) => ({ id: r.id, label: r.label.id, ket: r.halaman.slice(0, 3).map((h) => h.label.id).join(", ") + (r.halaman.length > 3 ? ", dan lainnya" : "") + "." })),
    ...KATEGORI_TUGAS.slice(1).map((k) => ({ ...k })),
  ];
}

/** L-08: artikel dalam bahasa yang diminta. Artikel layar memakai label dan guna en dari peta ruang; artikel tugas dari artikel-en.ts. */
export function artikelUntuk(bahasa: "id" | "en"): Artikel[] {
  if (bahasa === "id") return SEMUA_ARTIKEL;
  const ruangEn = new Map(RUANG.map((r) => [r.id, r.label.en]));
  return SEMUA_ARTIKEL.map((a) => {
    if (a.jenis === "halaman") return { ...a, judul: a.halaman.label.en, ringkas: a.halaman.guna.en, ruang: ruangEn.get(a.kategori) ?? a.ruang };
    const e = TUGAS_EN[a.slug] ?? PAKET_EN[a.slug];
    return e ? { ...a, judul: e.judul, ringkas: e.ringkas, langkah: e.langkah, catatan: e.catatan, tautan: a.tautan.map((t, i) => ({ ...t, label: e.tautan[i] ?? t.label })) } : a;
  });
}

export function kategoriUntuk(bahasa: "id" | "en") {
  if (bahasa === "id") return kategori();
  return [
    { id: "mulai", ...KATEGORI_EN.mulai },
    ...RUANG.map((r) => ({ id: r.id, label: r.label.en, ket: r.halaman.slice(0, 3).map((h) => h.label.en).join(", ") + (r.halaman.length > 3 ? ", and more" : "") + "." })),
    { id: "ai", ...KATEGORI_EN.ai }, { id: "aman", ...KATEGORI_EN.aman },
  ];
}

export const artikel = (slug: string, bahasa: "id" | "en" = "id") => artikelUntuk(bahasa).find((a) => a.slug === slug) ?? null;
const PERAN_EN: Record<Peran, string> = { pemilik: "owner", admin: "admin", akuntan: "accountant", staf: "staff" };
export const siapa = (p: readonly Peran[], bahasa: "id" | "en" = "id") => p.map((x) => (bahasa === "en" ? PERAN_EN : PERAN_LABEL)[x]).join(", ");

/** Cari tanpa model: setiap kata harus muncul di judul, ringkasan, langkah, atau kata cari; judul diberi bobot lebih. */
export function cariArtikel(q: string, bahasa: "id" | "en" = "id"): Artikel[] {
  const kata = q.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((k) => k.length > 1);
  if (!kata.length) return [];
  const skor = (a: Artikel) => {
    const judul = a.judul.toLowerCase();
    const isi = [a.ringkas, a.jenis === "tugas" ? a.langkah.join(" ") + " " + a.cari : (a.halaman.cari ?? "") + " " + a.halaman.label.en + " " + a.halaman.guna.en].join(" ").toLowerCase();
    let s = 0;
    for (const k of kata) {
      if (judul.includes(k)) s += 3; else if (isi.includes(k)) s += 1; else return 0;
    }
    return s + (a.jenis === "tugas" ? 0.5 : 0);
  };
  return artikelUntuk(bahasa).map((a) => [a, skor(a)] as const).filter(([, s]) => s > 0).sort((x, y) => y[1] - x[1]).map(([a]) => a);
}
