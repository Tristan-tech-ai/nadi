// M-23 pembuat laporan sederhana: pemilik/admin memilih satu sumber, kolom, dan kata saring, lalu melihat dan mengunduh CSV.
// Sumber dan kolom berdaftar putih (tidak ada nama kolom dari pengguna yang masuk ke kueri tanpa dicocokkan), dibaca lewat RLS
// seperti layar lain. Data rahasia (gaji, rekening, NIK) tidak ada di daftar.

export const SUMBER = {
  orang: { tabel: "orang", cari: "nama", urut: "nama", kolom: ["nama", "jenis", "status", "telepon", "email", "dibuat_at"] },
  produk: { tabel: "produk", cari: "nama", urut: "nama", kolom: ["kode", "nama", "kategori", "satuan", "harga_jual", "aktif"] },
  invoice: { tabel: "invoice", cari: "pelanggan", urut: "tanggal", kolom: ["nomor", "pelanggan", "tanggal", "jatuh_tempo", "total", "status", "lunas_tanggal"] },
} as const;
export type Sumber = keyof typeof SUMBER;
export const BATAS_BARIS = 2000;

export type Pilihan = { sumber: Sumber; kolom: string[]; cari: string };

const satu = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const daftar = (v: unknown): string[] => (Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : []).map(String);

/** Pilihan dari parameter URL: sumber tak dikenal = orang, kolom di luar daftar dibuang, kosong atau sumber baru (asal berbeda) = semua kolom, kata saring maks 60 huruf. */
export function bacaPilihan(sp: Record<string, unknown>): Pilihan {
  const s = String(satu(sp.sumber) ?? "");
  const sumber: Sumber = s in SUMBER ? (s as Sumber) : "orang";
  const boleh: readonly string[] = SUMBER[sumber].kolom;
  // Kolom yang dicentang untuk sumber sebelumnya tidak dibawa saat sumber diganti (nama kolom bisa sama, misalnya status).
  const asal = String(satu(sp.asal) ?? "");
  const kolom = asal && asal !== sumber ? [] : [...new Set(daftar(sp.kolom).map((k) => k.trim()).filter((k) => boleh.includes(k)))];
  const cari = String(satu(sp.cari) ?? "").replace(/[%_,()*\\]/g, " ").trim().slice(0, 60);
  return { sumber, kolom: kolom.length ? boleh.filter((k) => kolom.includes(k)) : [...boleh], cari };
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
