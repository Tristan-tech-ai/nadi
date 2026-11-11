/* eslint-disable @typescript-eslint/no-explicit-any -- korpus serangan sengaja menyusun manifest yang melanggar tipe Manifest */
import { describe, expect, it } from "vitest";
import { periksaManifest } from "./pengawas";
import { hitung, urai } from "./rumus";
import { CONTOH_PROYEK_AGENSI, type Manifest } from "./skema";

const salin = (): Manifest & Record<string, unknown> => JSON.parse(JSON.stringify(CONTOH_PROYEK_AGENSI));
type Ubah = (m: any) => unknown;

/** Manifest sah sederhana: satu koleksi dengan bidang yang diberikan. */
function sederhana(kode: string, nama: string, bidang: unknown[], lain: Record<string, unknown> = {}): Manifest {
  return {
    skema: 1, kode, nama, deskripsi: `Catatan ${nama.toLowerCase()} untuk usaha.`, ikon: "papan-klip", ruang: "hari-ini", versi: "1.0.0",
    koleksi: [{ kode: "catatan", nama, judul: "judul", bidang: [{ kode: "judul", label: "Judul", tipe: "teks", wajib: true }, ...bidang] as never,
      tampilan: [{ jenis: "daftar", kolom: ["judul"] }, { jenis: "formulir", bidang: ["judul"] }],
      akses: { pemilik: "kelola", admin: "kelola", akuntan: "lihat", staf: "tulis" }, ...lain }],
  } as Manifest;
}

const SAH: [string, Manifest][] = [
  ["proyek agensi (contoh lengkap)", CONTOH_PROYEK_AGENSI],
  ["log rapat", sederhana("log-rapat", "Rapat", [{ kode: "waktu", label: "Waktu", tipe: "tanggal_jam" }, { kode: "peserta", label: "Peserta", tipe: "orang", banyak: true }])],
  ["kalender konten", sederhana("kalender-konten", "Konten", [{ kode: "platform", label: "Platform", tipe: "pilihan", pilihan: [{ kode: "ig", label: "Instagram" }, { kode: "tiktok", label: "TikTok" }] }, { kode: "tayang", label: "Jadwal tayang", tipe: "tanggal_jam" }, { kode: "url", label: "URL tayang", tipe: "tautan" }])],
  ["helpdesk", sederhana("helpdesk", "Tiket", [{ kode: "pelapor", label: "Pelapor", tipe: "orang" }, { kode: "prioritas", label: "Prioritas", tipe: "pilihan", pilihan: [{ kode: "rendah", label: "Rendah" }, { kode: "tinggi", label: "Tinggi", warna: "cap" }] }])],
  ["peminjaman alat", sederhana("pinjam-alat", "Peminjaman", [{ kode: "barang", label: "Barang", tipe: "produk" }, { kode: "kembali", label: "Tanggal kembali", tipe: "tanggal" }])],
  ["kunjungan lapangan", sederhana("kunjungan", "Kunjungan", [{ kode: "pelanggan", label: "Pelanggan", tipe: "pelanggan" }, { kode: "foto", label: "Foto", tipe: "berkas" }, { kode: "telp", label: "Telepon", tipe: "telepon" }])],
  ["permintaan pembelian", sederhana("minta-beli", "Permintaan", [{ kode: "jumlah", label: "Jumlah", tipe: "angka", min: 1, max: 10000 }, { kode: "harga", label: "Harga satuan", tipe: "rupiah", min: 0 }, { kode: "total", label: "Total", tipe: "rumus", rumus: "{jumlah} * {harga}" }])],
  ["armada", sederhana("armada", "Kendaraan", [{ kode: "plat", label: "Nomor plat", tipe: "teks" }, { kode: "servis", label: "Servis berikut", tipe: "tanggal" }, { kode: "km", label: "Kilometer", tipe: "angka", min: 0 }])],
  ["inspeksi K3", sederhana("inspeksi-k3", "Inspeksi", [{ kode: "aman", label: "Aman", tipe: "centang" }, { kode: "temuan", label: "Temuan", tipe: "teks_panjang" }, { kode: "proyek", label: "Proyek", tipe: "proyek" }])],
  ["event", sederhana("event", "Acara", [{ kode: "mulai", label: "Mulai", tipe: "tanggal_jam" }, { kode: "tamu", label: "Jumlah tamu", tipe: "angka", min: 0 }, { kode: "tag", label: "Tag", tipe: "pilihan_banyak", pilihan: [{ kode: "internal", label: "Internal" }, { kode: "klien", label: "Klien" }] }])],
  ["dengan alur status + papan", sederhana("alur-sederhana", "Pekerjaan", [{ kode: "petugas", label: "Petugas", tipe: "orang", penugasan: true }], {
    status: { awal: "baru", daftar: [{ kode: "baru", label: "Baru" }, { kode: "selesai", label: "Selesai", akhir: true }], transisi: [{ dari: ["baru"], ke: "selesai", peran: ["ditugaskan", "pemilik"] }] },
    tampilan: [{ jenis: "papan", kolom_kartu: ["petugas"] }, { jenis: "formulir", bidang: ["judul", "petugas"] }] })],
];

const k0 = (m: any) => m.koleksi[0];
const b = (m: any, i: number) => m.koleksi[1].bidang[i];
const SERANGAN: [string, Ubah][] = [
  ["nama berisi tag script", (m) => { m.nama = "<script>alert(1)</script>"; }],
  ["nama javascript:", (m) => { m.nama = "javascript:alert(1)"; }],
  ["deskripsi atribut onerror", (m) => { m.deskripsi = "gambar onerror=alert(1)"; }],
  ["kode mod huruf besar dan spasi", (m) => { m.kode = "Proyek Agensi"; }],
  ["kode mod berisi perintah SQL", (m) => { m.kode = "x; drop table orang"; }],
  ["ikon jalur berkas", (m) => { m.ikon = "../../etc/passwd"; }],
  ["ruang admin palsu", (m) => { m.ruang = "admin"; }],
  ["skema versi lain", (m) => { m.skema = 2; }],
  ["versi bukan semver", (m) => { m.versi = "latest"; }],
  ["manifest raksasa", (m) => { m.koleksi[0].bidang[0].petunjuk = "a".repeat(70000); }],
  ["koleksi kosong", (m) => { m.koleksi = []; }],
  ["11 koleksi", (m) => { m.koleksi = Array.from({ length: 11 }, (_, i) => ({ ...m.koleksi[2], kode: `k${i}x` })); }],
  ["41 bidang", (m) => { k0(m).bidang = Array.from({ length: 41 }, (_, i) => ({ kode: `b${i}x`, label: "B", tipe: "teks" })); }],
  ["tipe bidang sql", (m) => { k0(m).bidang.push({ kode: "q", label: "Q", tipe: "sql" }); }],
  ["tipe bidang html", (m) => { k0(m).bidang.push({ kode: "isi_html", label: "Isi", tipe: "html" }); }],
  ["51 pilihan", (m) => { k0(m).bidang[4].pilihan = Array.from({ length: 51 }, (_, i) => ({ kode: `p${i}x`, label: "P" })); }],
  ["pilihan pada bidang teks", (m) => { k0(m).bidang[0].pilihan = [{ kode: "aa", label: "A" }]; }],
  ["rujukan ke koleksi yang tidak ada", (m) => { b(m, 1).koleksi = "gaji"; }],
  ["rujukan ke tabel inti", (m) => { b(m, 1).koleksi = "auth.users"; }],
  ["rumus eval", (m) => { b(m, 9).rumus = "eval(\"1\")"; }],
  ["rumus fetch", (m) => { b(m, 9).rumus = "FETCH(\"http://169.254.169.254\")"; }],
  ["rumus merujuk bidang tak ada", (m) => { b(m, 9).rumus = "{gaji} * 2"; }],
  ["rumus merujuk rumus", (m) => { m.koleksi[1].bidang.push({ kode: "x2", label: "X", tipe: "rumus", rumus: "{terlambat} + 1" }); }],
  ["rumus lebih dari 200 huruf", (m) => { b(m, 9).rumus = "1+".repeat(110) + "1"; }],
  ["rumus terlalu dalam", (m) => { b(m, 9).rumus = "(".repeat(25) + "1" + ")".repeat(25); }],
  ["rumus __proto__", (m) => { b(m, 9).rumus = "{__proto__}"; }],
  ["kode bidang __proto__", (m) => { k0(m).bidang.push({ kode: "__proto__", label: "X", tipe: "teks" }); }],
  ["kode bidang menimpa perusahaan_id", (m) => { k0(m).bidang.push({ kode: "perusahaan_id", label: "Usaha", tipe: "teks" }); }],
  ["staf diberi kelola", (m) => { k0(m).akses.staf = "kelola"; }],
  ["akuntan diberi kelola", (m) => { k0(m).akses.akuntan = "kelola"; }],
  ["pemilik dikurangi jadi lihat", (m) => { k0(m).akses.pemilik = "lihat"; }],
  ["peran asing superadmin", (m) => { k0(m).akses.superadmin = "kelola"; }],
  ["transisi oleh service_role", (m) => { k0(m).status.transisi[0].peran = ["service_role"]; }],
  ["transisi ke status tak ada", (m) => { k0(m).status.transisi[0].ke = "dihapus"; }],
  ["status awal tak ada", (m) => { k0(m).status.awal = "x"; }],
  ["13 status", (m) => { k0(m).status.daftar = Array.from({ length: 13 }, (_, i) => ({ kode: `s${i}x`, label: "S" })); }],
  ["papan tanpa alur status", (m) => { m.koleksi[2].tampilan.push({ jenis: "papan", kolom_kartu: ["judul"] }); }],
  ["kalender pada bidang teks", (m) => { k0(m).tampilan.push({ jenis: "kalender", tanggal: "nama" }); }],
  ["aksi webhook ke metadata cloud", (m) => { m.otomasi[0].aksi = { jenis: "webhook", url: "http://169.254.169.254/latest/meta-data", kepada: "pengelola" }; }],
  ["judul aksi merujuk bidang tak ada", (m) => { m.otomasi[0].aksi.judul = "Gaji {gaji_pemilik}"; }],
  ["judul aksi berisi tag", (m) => { m.otomasi[0].aksi.judul = "<img src=x onerror=alert(1)>"; }],
  ["pemicu ke koleksi asing", (m) => { m.otomasi[0].pemicu.koleksi = "orang"; }],
  ["laporan total bidang teks", (m) => { m.laporan[0].hitung = { total: "judul" }; }],
  ["kunci asing di akar: sql", (m) => { m.sql = "select * from orang"; }],
  ["kunci asing di bidang: default_sql", (m) => { k0(m).bidang[0].default_sql = "now()"; }],
  ["label template literal", (m) => { k0(m).bidang[0].label = "Nama ${process.env}"; }],
  ["nama berisi karakter kendali", (m) => { m.nama = "Proyek\u0000agensi"; }],
  ["pengingat 999 hari sebelum", (m) => { m.otomasi[1].pemicu.hari_sebelum = 999; }],
  ["koleksi ganda", (m) => { m.koleksi[1].kode = "proyek"; }],
  ["judul koleksi bukan bidang teks", (m) => { k0(m).judul = "nilai"; }],
  ["penugasan pada bidang bukan orang", (m) => { k0(m).bidang[0].penugasan = true; }],
  ["ditugaskan tanpa bidang penugasan", (m) => { m.koleksi[2].status = { awal: "a1", daftar: [{ kode: "a1", label: "A" }], transisi: [{ dari: "*", ke: "a1", peran: ["ditugaskan"] }] }; }],
];

describe("pengawas manifest Nadi Mod", () => {
  it.each(SAH)("menerima manifest sah: %s", (_, m) => {
    expect(periksaManifest(m)).toEqual([]);
  });
  it(`korpus serangan berisi minimal 40 kasus (${SERANGAN.length})`, () => {
    expect(SERANGAN.length).toBeGreaterThanOrEqual(40);
    expect(SAH.length).toBeGreaterThanOrEqual(10);
  });
  it.each(SERANGAN)("menolak: %s", (_, ubah) => {
    const m = salin();
    ubah(m);
    const alasan = periksaManifest(m);
    expect(alasan.length).toBeGreaterThan(0);
    expect(alasan.join(" ")).not.toMatch(/undefined|\[object/);
  });
  it("menolak bukan objek", () => {
    expect(periksaManifest(null)).not.toEqual([]);
    expect(periksaManifest([CONTOH_PROYEK_AGENSI])).not.toEqual([]);
    expect(periksaManifest("{}")).not.toEqual([]);
  });
});

describe("rumus", () => {
  it("menghitung aritmetika, teks, dan logika", () => {
    expect(hitung(urai("{jumlah} * {harga}"), { jumlah: 3, harga: 12500 })).toBe(37500);
    expect(hitung(urai("JIKA({a} > 2, \"besar\", \"kecil\")"), { a: 3 })).toBe("besar");
    expect(hitung(urai("BULAT(10 / 3, 2)"), {})).toBe(3.33);
    expect(hitung(urai("1 / 0"), {})).toBeNull();
    expect(hitung(urai("\"Rp\" & {n}"), { n: 5 })).toBe("Rp5");
    expect(hitung(urai("{a} > 1 DAN {b} = 2"), { a: 2, b: 2 })).toBe(true);
  });
  it("menghitung tanggal terlambat seperti contoh proyek agensi", () => {
    const s = urai("JIKA(KOSONG({tenggat}), 0, MAKS(0, HARI_ANTARA({tenggat}, HARI_INI())))");
    const now = new Date("2026-11-11T09:00:00Z");
    expect(hitung(s, { tenggat: "2026-11-08T10:00:00Z" }, now)).toBe(2);
    expect(hitung(s, { tenggat: "2026-12-01" }, now)).toBe(0);
    expect(hitung(s, { tenggat: null }, now)).toBe(0);
  });
  it("menolak tata bahasa asing", () => {
    for (const r of ["eval(1)", "{a}.constructor", "process", "`x`", "{a} ; drop", "\"a\\\"\"", "JIKA(1,2)", "{A}", "1 +", "()"]) expect(() => urai(r)).toThrow();
  });
  it("bidang yang tidak ada di data menjadi null, bukan properti objek", () => {
    expect(hitung(urai("{constructor}"), {})).toBeNull();
    expect(() => urai("{toString}")).toThrow();
  });
});
