// T-01C belajar format jalur pindah data: berkas yang judul kolomnya tidak dikenali kenali() dipetakan model sekali.
// Model hanya melihat judul kolom dan tipe tiap kolom (teks/angka/tanggal/hp/kosong), tidak pernah isi baris. Pengawas di bawah
// (tanpa model) memeriksa peta terhadap berkas; peta disimpan bayangan per usaha dengan sidik judul kolom, lalu aktif setelah cocok
// 2 kali. Berkas ini disalin persis ke supabase/functions/pelajari-pindah/peta.ts (tes salinan).
import { angka, hp, tanggal } from "./format.ts";

export type FormatPeta = "karyawan" | "produk";
export const BIDANG_PETA: Record<FormatPeta, { wajib: string[]; boleh: Record<string, "teks" | "angka" | "tanggal" | "hp"> }> = {
  karyawan: { wajib: ["nama"], boleh: { nama: "teks", id: "teks", jabatan: "teks", telepon: "hp", mulai: "tanggal", gaji_pokok: "angka" } },
  produk: { wajib: ["nama"], boleh: { nama: "teks", kode: "teks", satuan: "teks", harga_jual: "angka", stok: "angka" } },
};
export type Peta = { format: FormatPeta; kolom: Record<string, string> };
export type TipeKolom = "teks" | "angka" | "tanggal" | "hp" | "kosong";
export type Ringkas = { baris_judul: number; judul: string[]; tipe: TipeKolom[]; sidik: string };

const judulNorm = (s: unknown) => String(s ?? "").replace(/^﻿/, "").trim().toLowerCase().replace(/^[*#]+\s*/, "").replace(/\s+/g, " ");
const isi = (s: unknown) => String(s ?? "").trim().replace(/^'/, "");

function tipeSel(v: unknown): TipeKolom {
  if (isi(v) === "") return "kosong";
  if (v instanceof Date || (typeof v === "string" && tanggal(v))) return "tanggal";
  if (hp(v)) return "hp";
  if (angka(v) !== null) return "angka";
  return "teks";
}

/** Sidik judul kolom (FNV-1a 32 bit dari judul terurut): kunci peta per tata letak berkas, tanpa isi baris. */
export function sidikJudul(judul: string[]): string {
  let h = 0x811c9dc5;
  for (const c of [...judul].filter(Boolean).sort().join("|")) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}

/** Baris judul = baris pertama (dari 10 baris awal) yang isinya teks dan paling sedikit 80% dari jumlah kolom terbanyak. */
export function ringkasKolom(rows: unknown[][]): Ringkas | null {
  const awal = rows.slice(0, 10);
  const terisi = (r: unknown[]) => r.filter((x) => isi(x) !== "").length;
  const maks = Math.max(0, ...awal.map(terisi));
  if (maks < 2) return null;
  const i = awal.findIndex((r) => terisi(r) >= Math.max(2, Math.ceil(maks * 0.8)) && r.every((x) => isi(x) === "" || tipeSel(x) === "teks"));
  if (i < 0) return null;
  const judul = rows[i].map(judulNorm);
  const data = rows.slice(i + 1).filter((r) => r.some((x) => isi(x) !== "")).slice(0, 50);
  const tipe = judul.map((_, k) => {
    const hitung: Record<TipeKolom, number> = { teks: 0, angka: 0, tanggal: 0, hp: 0, kosong: 0 };
    for (const r of data) hitung[tipeSel(r[k])]++;
    const isiSaja = (Object.entries(hitung) as [TipeKolom, number][]).filter(([t]) => t !== "kosong").sort((a, b) => b[1] - a[1]);
    return isiSaja[0]?.[1] ? isiSaja[0][0] : "kosong";
  });
  return { baris_judul: i, judul, tipe, sidik: sidikJudul(judul) };
}

/** Terapkan peta ke baris berkas: bentuk baris sama dengan kenali() (format.ts) supaya propose_migration tidak berubah. */
export function terapkanPeta(rows: unknown[][], r: Ringkas, peta: Peta): { baris: Record<string, unknown>[]; dilewati: number } {
  const idx = (b: string) => (peta.kolom[b] ? r.judul.indexOf(peta.kolom[b]) : -1);
  const ambil = (row: unknown[], b: string) => { const i = idx(b); return i >= 0 ? row[i] : undefined; };
  const data = rows.slice(r.baris_judul + 1).filter((x) => x.some((v) => isi(v) !== ""));
  let dilewati = 0;
  const baris = data.flatMap((row): Record<string, unknown>[] => {
    const nama = isi(ambil(row, "nama"));
    if (nama.length < 2 || angka(nama) !== null) { dilewati++; return []; }
    if (peta.format === "karyawan") {
      const gaji = angka(ambil(row, "gaji_pokok"));
      return [{ id: isi(ambil(row, "id")) || undefined, nama, jabatan: isi(ambil(row, "jabatan")) || undefined, telepon: hp(ambil(row, "telepon")) ?? undefined,
        mulai: tanggal(ambil(row, "mulai")) ?? undefined, ...(gaji && gaji > 0 ? { gaji_pokok: Math.round(gaji) } : {}) }];
    }
    const harga = angka(ambil(row, "harga_jual"));
    const stok = angka(ambil(row, "stok"));
    return [{ kode: isi(ambil(row, "kode")) || undefined, nama, satuan: isi(ambil(row, "satuan")) || undefined,
      harga_jual: harga !== null && harga >= 0 ? Math.round(harga) : 0, ...(stok !== null && stok > 0 ? { stok } : {}) }];
  });
  return { baris, dilewati };
}

/** Pengawas bukan AI: peta harus memakai bidang dari daftar tetap, judul yang ada di berkas (satu judul satu bidang), dan tipe
 *  kolom yang cocok dengan tipe bidangnya. Hanya butuh ringkasan (judul + tipe), bukan isi baris. */
export function periksaPeta(r: Ringkas, peta: Peta): { lulus: boolean; alasan: string[] } {
  const alasan: string[] = [];
  const aturan = BIDANG_PETA[peta.format as FormatPeta];
  if (!aturan) return { lulus: false, alasan: ["format di luar daftar tetap"] };
  const dipakai = new Set<string>();
  for (const [b, j] of Object.entries(peta.kolom ?? {})) {
    if (!(b in aturan.boleh)) { alasan.push(`bidang tidak dikenal: ${b.slice(0, 30)}`); continue; }
    const i = r.judul.indexOf(j);
    if (i < 0) { alasan.push(`judul tidak ada di berkas: ${String(j).slice(0, 40)}`); continue; }
    if (dipakai.has(j)) alasan.push(`judul dipakai dua kali: ${j}`);
    dipakai.add(j);
    const t = r.tipe[i];
    const mau = aturan.boleh[b];
    const cocok = t === "kosong" || t === mau || (mau === "teks" && t !== "tanggal") || (mau === "angka" && t === "hp" && b === "stok");
    if (!cocok) alasan.push(`${b} butuh ${mau}, kolom ${j} berisi ${t}`);
  }
  for (const w of aturan.wajib) if (!peta.kolom?.[w]) alasan.push(`bidang wajib belum dipetakan: ${w}`);
  return { lulus: alasan.length === 0, alasan };
}

/** Dua peta sama bila format dan pasangan bidang-judulnya sama (untuk masa bayangan). */
export const petaSama = (a: Peta, b: Peta) =>
  a.format === b.format && JSON.stringify(Object.entries(a.kolom).sort()) === JSON.stringify(Object.entries(b.kolom).sort());
