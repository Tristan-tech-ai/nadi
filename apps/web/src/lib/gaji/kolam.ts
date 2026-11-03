// Kolam Bonus Beban (F3-05, docs/design/kolam-bonus-beban.md). Murni, tanpa jaringan. Angka resmi dihitung SQL
// (app.kolam_hitung); fungsi di sini dipakai layar untuk memeriksa ulang jumlahnya dan untuk ekspor CSV.

export type BagianKolam = {
  orang_id: string;
  nama: string;
  id_staf: string | null;
  poin: number;
  kerja_n: number;
  persen: number;
  rupiah: number;
  kerja_ids: string[];
  dibanding_ids: string[];
  alasan: string;
};

export type HitungKolam = {
  bulan: string;
  nama_bulan: string;
  zona: string;
  jumlah: number;
  total_poin: number;
  kerja_n: number;
  cukup: boolean;
  pesan: string | null;
  bagian: BagianKolam[];
  peringatan: string[];
  dikecualikan: { orang_id: string; nama: string; alasan: string; poin: number; kerja_n: number }[];
  tanpa_poin: { nama: string; kerja_n: number }[];
  slip_terkunci: boolean;
  disetujui: { id: string; jumlah: number; disetujui_at: string } | null;
};

export type KolamSaya = { bulan: string; nama_bulan: string; rupiah: number; poin: number; kerja_n: number; disetujui_at: string } | null;

export type Pengecualian = { orang_id: string; alasan: string };

/** Sumber hukum komponen slip (PP 36/2021 Pasal 8 ayat (2) dan Pasal 10: insentif, pendapatan non-upah). */
export const SUMBER_INSENTIF = "PP 36/2021 Pasal 8 dan 10";
/** Kolam bisa dibagi bila minimal sekian kerja berpoin selesai di bulan itu (sama dengan SQL). */
export const AMBANG_KERJA = 5;

const N0 = BigInt(0);
const N1 = BigInt(1);
const SKALA = BigInt(1000);
const keBulat = (poin: number) => BigInt(Math.round(poin * Number(SKALA)));

/**
 * Pembulatan sisa terbesar: bagian bulat ke bawah dari kolam x poin / total poin, lalu sisa rupiah diberikan satu per satu ke
 * pecahan terbesar; seri diputus urut id (sama dengan SQL: order by pecahan desc, orang_id). Jumlah = kolam persis. Hitungan
 * BigInt supaya pasti untuk kolam besar (poin dibulatkan ke 3 desimal).
 */
export function bagiSisaTerbesar(kolam: number, peserta: { id: string; poin: number }[]): Map<string, number> {
  const p = peserta.map((x) => ({ id: x.id, poin: keBulat(x.poin) })).filter((x) => x.poin > N0);
  const hasil = new Map<string, number>();
  const total = p.reduce((s, x) => s + x.poin, N0);
  if (!p.length || total === N0) return hasil;
  const k = BigInt(kolam);
  const b = p.map((x) => ({ id: x.id, dasar: (k * x.poin) / total, pecahan: (k * x.poin) % total }));
  let sisa = k - b.reduce((s, x) => s + x.dasar, N0);
  const urut = [...b].sort((x, y) => (x.pecahan === y.pecahan ? (x.id < y.id ? -1 : x.id > y.id ? 1 : 0) : x.pecahan > y.pecahan ? -1 : 1));
  for (const x of urut) {
    hasil.set(x.id, Number(x.dasar + (sisa > N0 ? N1 : N0)));
    if (sisa > N0) sisa--;
  }
  return new Map([...hasil.entries()].sort(([a], [z]) => (a < z ? -1 : a > z ? 1 : 0)));
}

/** Pemeriksaan ulang layar: rupiah dari SQL sama dengan pembagian sisa terbesar dan jumlahnya = kolam. */
export function cocokDenganKolam(kolam: number, bagian: Pick<BagianKolam, "orang_id" | "poin" | "rupiah">[]): boolean {
  if (!bagian.length) return true;
  const h = bagiSisaTerbesar(kolam, bagian.map((b) => ({ id: b.orang_id, poin: Number(b.poin) })));
  return bagian.every((b) => h.get(b.orang_id) === Number(b.rupiah)) && bagian.reduce((s, b) => s + Number(b.rupiah), 0) === kolam;
}

export type BarisKolam = Pick<BagianKolam, "orang_id" | "nama" | "id_staf" | "poin" | "persen" | "rupiah" | "kerja_n">;

/** Sel CSV RFC 4180; sel yang diawali = + - @ diberi tanda kutip tunggal supaya spreadsheet tidak menjalankannya sebagai rumus. */
function sel(nilai: string | number | null): string {
  let t = nilai === null ? "" : String(nilai);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

/**
 * CSV untuk spreadsheet: orang, ID staf, poin, persen, rupiah (bilangan bulat tanpa titik ribuan), sumber. Titik desimal pada
 * poin dan persen (dibaca sebagai angka). BOM UTF-8 supaya Excel membaca huruf dengan benar.
 */
export function csvKolam(baris: BarisKolam[], b: { bulan: string; namaBulan: string }): string {
  const kepala = ["orang", "id_staf", "poin", "persen", "rupiah", "sumber"].join(",");
  const isi = baris.map((r) =>
    [
      sel(r.nama),
      sel(r.id_staf),
      sel(Number(r.poin)),
      sel(Number(r.persen)),
      sel(Math.round(Number(r.rupiah))),
      sel(`Insentif beban kerja ${b.namaBulan}: ${r.kerja_n} kerja selesai (${SUMBER_INSENTIF})`),
    ].join(","),
  );
  return `﻿${[kepala, ...isi].join("\r\n")}`;
}

export const namaBerkasKolam = (bulan: string) => `kolam-insentif-beban-${bulan}.csv`;

/** Rupiah dari ketikan ("Rp1.000.000", "250000"): bilangan bulat 1 sampai 10 miliar, atau null. */
export function rupiahIsian(teks: string | null | undefined): number | null {
  const t = String(teks ?? "").replace(/[^\d]/g, "");
  if (!t || t.length > 11) return null;
  const n = Number(t);
  return n > 0 && n <= 10_000_000_000 ? n : null;
}

/** Bulan YYYY-MM dari parameter, atau cadangan. */
export const bulanKolam = (x: string | undefined, cadangan: string) => (x && /^\d{4}-(0[1-9]|1[0-2])$/.test(x) ? x : cadangan);

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Parameter k=<id>~<alasan> (boleh berulang) menjadi daftar pengecualian; yang tidak sah dibuang, id ganda diambil yang pertama. */
export function bacaPengecualian(v: string | string[] | undefined): Pengecualian[] {
  const daftar = Array.isArray(v) ? v : v ? [v] : [];
  const hasil: Pengecualian[] = [];
  for (const x of daftar.slice(0, 200)) {
    const i = x.indexOf("~");
    if (i < 0) continue;
    const id = x.slice(0, i);
    const alasan = x.slice(i + 1).replace(/\s+/g, " ").trim();
    if (ID.test(id) && alasan.length >= 3 && alasan.length <= 300 && !hasil.some((h) => h.orang_id === id)) hasil.push({ orang_id: id, alasan });
  }
  return hasil;
}

/** Persen untuk layar: 33,3% atau 50%. */
export const teksPersen = (p: number, bahasa: "id" | "en" = "id") => `${Number(p).toLocaleString(bahasa === "en" ? "en-US" : "id-ID", { maximumFractionDigits: 1 })}%`;
/** Poin untuk layar: 1,5 poin. */
export const teksPoinKolam = (p: number, bahasa: "id" | "en" = "id") =>
  bahasa === "en" ? `${Number(p).toLocaleString("en-US", { maximumFractionDigits: 1 })} points` : `${Number(p).toLocaleString("id-ID", { maximumFractionDigits: 1 })} poin`;
