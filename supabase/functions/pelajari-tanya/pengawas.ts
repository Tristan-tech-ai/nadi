// T-01A pengawas bukan AI untuk aturan tanya: model hanya mengusulkan "kata kunci -> niat"; kode ini memutuskan apakah usulan itu
// boleh disimpan. Tidak memanggil model apa pun. Lolos pun baru berstatus bayangan (index.ts).
import { NIAT_DAFTAR, bentukTanya, ditolak, niatBawaan, normal, uraiTanya, type Niat } from "./urai.ts";

/** Kata yang terlalu umum untuk menjadi kunci niat (muncul di hampir semua pertanyaan). */
const UMUM = new Set(["berapa", "ada", "apa", "yang", "ini", "itu", "kita", "kami", "saya", "aku", "dong", "sih", "ya", "kah", "dan", "atau", "di", "ke", "dari",
  "untuk", "buat", "sudah", "belum", "masih", "bulan", "minggu", "hari", "tahun", "lalu", "kemarin", "sekarang", "total", "jumlah", "semua", "usaha", "toko",
  "data", "lihat", "tolong", "coba", "bisa", "mau", "the", "how", "much", "many", "what", "is", "are", "this", "last", "month", "week", "year"]);

export type HasilPeriksaTanya = { lulus: boolean; alasan: string[] };

export function periksaAturanTanya(kalimat: string, kata: string, niat: string, hariIni: string): HasilPeriksaTanya {
  const alasan: string[] = [];
  const k = kata.trim().toLowerCase().replace(/\s+/g, " ");
  if (!(NIAT_DAFTAR as readonly string[]).includes(niat)) alasan.push("niat di luar daftar tetap");
  if (!/^[a-z]+( [a-z]+){0,2}$/.test(k) || k.length < 3 || k.length > 40) alasan.push("kata harus 1-3 kata huruf kecil tanpa angka, 3-40 huruf");
  else {
    if (!normal(kalimat).includes(` ${k} `)) alasan.push("kata tidak ada di kalimat");
    if (k.split(" ").every((w) => UMUM.has(w))) alasan.push("kata terlalu umum");
    if (ditolak(k)) alasan.push("kata termasuk pertanyaan pendapat/sebab/ramalan");
    if (niatBawaan(k)) alasan.push("kata sudah dikenali pengurai bawaan");
  }
  if (ditolak(kalimat)) alasan.push("kalimat meminta pendapat, sebab, atau ramalan");
  // Coba ulang: dengan aturan ini, pengurai harus menghasilkan niat yang sama dengan usulan model.
  if (!alasan.length) {
    const t = uraiTanya(kalimat, hariIni, [{ kata: k, niat: niat as Niat }]);
    if (!t || t.niat !== niat) alasan.push("pengurai dengan aturan ini tidak menghasilkan niat yang sama");
    else if (!bentukTanya(kalimat, hariIni, niat as Niat)) alasan.push("pertanyaan tidak lengkap untuk niat ini");
  }
  return { lulus: alasan.length === 0, alasan };
}

export const BAYANGAN_WAJIB = 2;
