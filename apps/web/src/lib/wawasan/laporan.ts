// M-23 pembuat laporan sederhana: pemilik/admin memilih satu sumber, kolom, dan kata saring, lalu melihat dan mengunduh CSV.
// Sumber dan kolom berdaftar putih (tidak ada nama kolom dari pengguna yang masuk ke kueri tanpa dicocokkan), dibaca lewat RLS
// seperti layar lain. Data rahasia (gaji, rekening, NIK) tidak ada di daftar.

export const SUMBER = {
  orang: { tabel: "orang", cari: "nama", urut: "nama", kolom: ["nama", "jenis", "status", "telepon", "email", "dibuat_at"] },
  produk: { tabel: "produk", cari: "nama", urut: "nama", kolom: ["kode", "nama", "kategori", "satuan", "harga_jual", "aktif"] },
  invoice: { tabel: "invoice", cari: "pelanggan", urut: "tanggal", kolom: ["nomor", "pelanggan", "tanggal", "jatuh_tempo", "total", "status", "lunas_tanggal"] },
  // X-18: kerja dan proyek operasional (nama proyek dari dimensi, diratakan di ambil.ts).
  kerja: { tabel: "kerja", cari: "judul", urut: "dibuat_at", kolom: ["judul", "status", "tenggat", "tenggat_awal", "selesai_at", "poin_beban", "dibuat_at"] },
  proyek: { tabel: "proyek_info", cari: "status", urut: "dibuat_at", kolom: ["nama", "status", "tipe", "pola", "mulai", "target"] },
} as const;
export type Sumber = keyof typeof SUMBER;
export const BATAS_BARIS = 2000;

/** X-18 sumber dari koleksi fitur tambahan yang aktif: kolom hanya kode isian di manifest (tanpa rumus dan berkas). */
export type SumberMod = { kunci: `mod:${string}`; modId: string; koleksi: string; nama: string; judul: string; kolom: string[]; label: Record<string, string>; tipe: Record<string, string>; ruj: Record<string, string> };
type ModAktif = { id: string; kode: string; nama: string; manifest: { koleksi: { kode: string; nama: string; judul: string; status?: unknown; bidang: { kode: string; label: string; tipe: string; koleksi?: string }[] }[] } };
export function sumberMod(mods: readonly ModAktif[]): SumberMod[] {
  return mods.flatMap((m) => (m.manifest?.koleksi ?? []).map((k) => {
    const bidang = k.bidang.filter((b) => b.tipe !== "rumus" && b.tipe !== "berkas" && /^[a-z][a-z0-9_]{1,29}$/.test(b.kode));
    const kolom = [...bidang.map((b) => b.kode), ...(k.status ? ["status"] : []), "dibuat_at"];
    return { kunci: `mod:${m.kode}:${k.kode}` as const, modId: m.id, koleksi: k.kode, nama: `${m.nama} / ${k.nama}`, judul: k.judul, kolom,
      label: { ...Object.fromEntries(bidang.map((b) => [b.kode, b.label])), status: "Status", dibuat_at: "Dibuat" },
      tipe: Object.fromEntries(bidang.map((b) => [b.kode, b.tipe])),
      // rujukan ke koleksi lain di mod yang sama ditampilkan dengan judul catatan tujuannya
      ruj: Object.fromEntries(bidang.filter((b) => b.tipe === "rujukan").map((b) => [b.kode, m.manifest.koleksi.find((x) => x.kode === b.koleksi)?.judul ?? ""])) };
  }));
}

export type Pilihan = { sumber: Sumber | `mod:${string}`; kolom: string[]; cari: string; mod?: SumberMod };

const satu = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const daftar = (v: unknown): string[] => (Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : []).map(String);

/** Pilihan dari parameter URL: sumber tak dikenal = orang, kolom di luar daftar dibuang, kosong atau sumber baru (asal berbeda) = semua kolom, kata saring maks 60 huruf. */
export function bacaPilihan(sp: Record<string, unknown>, mods: readonly SumberMod[] = []): Pilihan {
  const s = String(satu(sp.sumber) ?? "");
  const mod = mods.find((m) => m.kunci === s);
  const sumber: Pilihan["sumber"] = mod ? mod.kunci : s in SUMBER ? (s as Sumber) : "orang";
  const boleh: readonly string[] = mod ? mod.kolom : SUMBER[sumber as Sumber].kolom;
  // Kolom yang dicentang untuk sumber sebelumnya tidak dibawa saat sumber diganti (nama kolom bisa sama, misalnya status).
  const asal = String(satu(sp.asal) ?? "");
  const kolom = asal && asal !== sumber ? [] : [...new Set(daftar(sp.kolom).map((k) => k.trim()).filter((k) => boleh.includes(k)))];
  const cari = String(satu(sp.cari) ?? "").replace(/[%_,()*\\]/g, " ").trim().slice(0, 60);
  return { sumber, kolom: kolom.length ? boleh.filter((k) => kolom.includes(k)) : [...boleh], cari, ...(mod ? { mod } : {}) };
}

/** Nilai sel CSV: larik digabung, teks yang diawali = + - @ diberi petik agar tidak dijalankan sebagai rumus di Excel. */
export function selCsv(v: unknown): string {
  let s = v === null || v === undefined ? "" : Array.isArray(v) ? v.join(", ") : String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV pemisah titik koma (Excel berlokal Indonesia), judul kolom dari kamus. */
export function keCsv(baris: Record<string, unknown>[], kolom: string[], judul: Record<string, string>): string {
  return [kolom.map((k) => selCsv(judul[k] ?? k)).join(";"), ...baris.map((b) => kolom.map((k) => selCsv(b[k])).join(";"))].join("\r\n") + "\r\n";
}
