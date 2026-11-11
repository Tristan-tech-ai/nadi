// X-16 pembangun fitur tambahan tanpa menulis JSON. Rancangan dari formulir (nama, koleksi, isian, status, akses) diubah menjadi
// manifest biasa oleh fungsi murni ini; hasilnya tetap diperiksa pengawas yang sama di server dan disimpan sebagai draf.
// Hal lanjutan (rumus, rujukan antarkoleksi, otomasi) tetap lewat JSON atau AI-mu.
import type { Akses, Bidang, IkonMod, Koleksi, Manifest, Tampilan, TipeBidang, Transisi } from "./skema";
import { RUANG_MOD, VERSI_SKEMA } from "./skema";

/** Tipe isian yang bisa dipilih di formulir, dengan label sehari-hari. */
export const TIPE_PEMBANGUN: readonly { tipe: TipeBidang; label: string }[] = [
  { tipe: "teks", label: "Teks pendek" }, { tipe: "teks_panjang", label: "Teks panjang" }, { tipe: "angka", label: "Angka" },
  { tipe: "rupiah", label: "Rupiah" }, { tipe: "tanggal", label: "Tanggal" }, { tipe: "tanggal_jam", label: "Tanggal dan jam" },
  { tipe: "pilihan", label: "Pilihan" }, { tipe: "centang", label: "Centang" }, { tipe: "tautan", label: "Tautan (https)" },
  { tipe: "telepon", label: "Telepon" }, { tipe: "orang", label: "Orang di usaha" }, { tipe: "pelanggan", label: "Pelanggan" },
];

export type RancanganIsian = { label: string; tipe: TipeBidang; wajib: boolean; pilihan: string };
export type RancanganKoleksi = { nama: string; isian: RancanganIsian[]; status: string; staf: Akses; akuntan: Akses };
export type Rancangan = { nama: string; deskripsi: string; ikon: IkonMod; ruang: (typeof RUANG_MOD)[number]; koleksi: RancanganKoleksi[] };

const TERLARANG = new Set(["__proto__", "constructor", "prototype", "id", "status", "perusahaan_id", "mod_id", "dibuat_oleh", "dibuat_at", "diubah_at"]);
const tanpaAksen = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Kode mod dari nama: huruf kecil, angka, tanda hubung; unik terhadap kode yang sudah ada di usaha. */
export function kodeMod(nama: string, sudah: readonly string[] = []): string {
  let k = tanpaAksen(nama).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 34) || "fitur";
  if (!/^[a-z]/.test(k)) k = `f-${k}`;
  if (k.length < 3) k = `${k}-fitur`;
  let hasil = k, n = 2;
  while (sudah.includes(hasil)) hasil = `${k}-${n++}`;
  return hasil;
}

/** Kode isian/koleksi/status dari label: huruf kecil, angka, garis bawah; unik dalam daftarnya, bukan nama sistem. */
export function kodeIsian(label: string, sudah: Set<string>): string {
  let k = tanpaAksen(label).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 26) || "isian";
  if (!/^[a-z]/.test(k)) k = `i_${k}`;
  if (k.length < 2 || TERLARANG.has(k)) k = `${k}_isi`;
  let hasil = k, n = 2;
  while (sudah.has(hasil)) hasil = `${k}_${n++}`;
  sudah.add(hasil);
  return hasil;
}

const daftarKoma = (s: string) => [...new Set(s.split(",").map((x) => x.trim().replace(/\s+/g, " ")).filter(Boolean))];

/** Masalah rancangan yang bisa dijelaskan ke pemilik sebelum manifest disusun (pengawas tetap memeriksa hasilnya). */
export function periksaRancangan(r: Rancangan): string[] {
  const a: string[] = [];
  if (r.nama.trim().length < 3) a.push("Nama fitur minimal 3 huruf.");
  if (!r.koleksi.length) a.push("Tambahkan minimal satu bagian.");
  r.koleksi.forEach((k, i) => {
    const di = `Bagian ${i + 1}${k.nama.trim() ? ` (${k.nama.trim()})` : ""}`;
    if (k.nama.trim().length < 2) a.push(`${di}: beri nama bagian.`);
    const isian = k.isian.filter((x) => x.label.trim());
    if (!isian.length) a.push(`${di}: tambahkan minimal satu isian.`);
    if (!isian.some((x) => x.tipe === "teks")) a.push(`${di}: perlu satu isian Teks pendek sebagai judul catatan.`);
    for (const x of isian) if (x.tipe === "pilihan" && daftarKoma(x.pilihan).length < 2) a.push(`${di}: isian ${x.label.trim()} butuh minimal dua pilihan, dipisah koma.`);
    if (k.status.trim() && daftarKoma(k.status).length < 2) a.push(`${di}: status butuh minimal dua tahap, dipisah koma, atau kosongkan.`);
  });
  return a;
}

/** Susun manifest dari rancangan. Status berurutan: setiap tahap maju ke tahap berikutnya; tahap terakhir adalah akhir. */
export function susunManifest(r: Rancangan, kodeSudah: readonly string[] = []): Manifest {
  const kodeKoleksi = new Set<string>();
  const koleksi: Koleksi[] = r.koleksi.map((k) => {
    const kode = kodeIsian(k.nama, kodeKoleksi);
    const sudah = new Set<string>();
    let adaPenugasan = false;
    const bidang: Bidang[] = k.isian.filter((x) => x.label.trim()).map((x) => {
      const b: Bidang = { kode: kodeIsian(x.label, sudah), label: x.label.trim().slice(0, 60), tipe: x.tipe };
      if (x.wajib) b.wajib = true;
      if (x.tipe === "pilihan") { const s = new Set<string>(); b.pilihan = daftarKoma(x.pilihan).slice(0, 50).map((p) => ({ kode: kodeIsian(p, s), label: p.slice(0, 60) })); }
      if (x.tipe === "orang" && !adaPenugasan) { b.penugasan = true; adaPenugasan = true; }
      return b;
    });
    const judul = bidang.find((b) => b.tipe === "teks")!.kode;
    const tahap = daftarKoma(k.status).slice(0, 12);
    const kodeTahap = new Set<string>();
    const status = tahap.length >= 2 ? {
      awal: "",
      daftar: tahap.map((t, i) => ({ kode: kodeIsian(t, kodeTahap), label: t.slice(0, 60), ...(i === tahap.length - 1 ? { akhir: true } : {}) })),
      transisi: [] as Transisi[],
    } : undefined;
    if (status) {
      status.awal = status.daftar[0].kode;
      const peran: Transisi["peran"] = adaPenugasan ? ["pemilik", "admin", "ditugaskan"] : ["pemilik", "admin", "staf"];
      status.transisi = status.daftar.slice(1).map((s, i) => ({ dari: [status.daftar[i].kode], ke: s.kode, peran, label: s.label }));
    }
    const isi = bidang.map((b) => b.kode);
    const tampilan: Tampilan[] = [
      { jenis: "daftar", kolom: isi.slice(0, 5) },
      ...(status ? [{ jenis: "papan", kolom_kartu: isi.filter((c) => c !== judul).slice(0, 2) } as Tampilan] : []),
      ...(bidang.some((b) => b.tipe === "tanggal" || b.tipe === "tanggal_jam") ? [{ jenis: "kalender", tanggal: bidang.find((b) => b.tipe === "tanggal" || b.tipe === "tanggal_jam")!.kode } as Tampilan] : []),
      { jenis: "formulir", bidang: isi },
      { jenis: "rincian", bidang: isi },
    ];
    const batas = (v: Akses, maks: Akses): Akses => (v === "kelola" ? maks : v);
    return { kode, nama: k.nama.trim().slice(0, 60), judul, bidang, ...(status ? { status } : {}), tampilan,
      akses: { pemilik: "kelola", admin: "kelola", akuntan: batas(k.akuntan, "tulis"), staf: batas(k.staf, "tulis") } };
  });
  return {
    skema: VERSI_SKEMA, kode: kodeMod(r.nama, kodeSudah), nama: r.nama.trim().slice(0, 60),
    deskripsi: (r.deskripsi.trim() || `Fitur ${r.nama.trim()} buatan sendiri.`).slice(0, 300), ikon: r.ikon, ruang: r.ruang, versi: "1.0.0", koleksi,
  };
}
