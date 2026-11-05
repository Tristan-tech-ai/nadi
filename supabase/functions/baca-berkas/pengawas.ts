// T-02 pengawas bukan AI: aturan ekstraktor yang ditulis model hanya DATA (jangkar, regex terbatas, peta kolom) yang dijalankan
// penafsir tetap di ekstraktor.ts. Pemeriksa deterministik ini menolak aturan sebelum disimpan bila bentuknya di luar skema,
// regex-nya berisiko (pengulangan bersarang, rujukan balik, lookaround, terlalu panjang, lambat pada teks jebakan), isinya
// menyerupai skrip/SQL, atau jangkarnya terlalu umum sehingga cocok dengan berkas jenis lain di korpus pembanding.
// Lulus pemeriksa belum berarti aktif: aturan baru berjalan bayangan (dibandingkan dengan model) dulu, lihat index.ts.
import type { Aturan, Tipe } from "./ekstraktor.ts";
import { cocok } from "./ekstraktor.ts";
import { JENIS } from "./inti.ts";

const TIPE: Tipe[] = ["teks", "angka", "rupiah", "tanggal", "periode", "jam"];
const MAKS_POLA = 300;
const MAKS_BIDANG = 40;
const MAKS_KUANTOR_TERBUKA = 12;
const BAHAYA_TEKS = /<\s*script|javascript:|\$\{|`|\b(drop|delete|insert|update|alter|create|truncate|grant)\s+(table|from|into|function|schema|database|role)\b|;\s*--|\beval\s*\(|\bfunction\s*\(|=>|\bimport\s*\(/i;

/** Teks jebakan untuk mengukur waktu regex (pola berbahaya meledak eksponensial pada pengulangan seperti ini). */
const JEBAKAN = ["a".repeat(4000) + "!", " ".repeat(4000) + "x", "1.".repeat(2000) + "z", "Rp " + "9".repeat(3000) + ",", "x\n".repeat(1500)];

/** Korpus pembanding kecil per jenis: aturan untuk jenis X tidak boleh cocok dengan contoh jenis lain (terlalu umum). */
export const KORPUS_PEMBANDING: { jenis: string; teks: string }[] = [
  { jenis: "invoice", teks: "INVOICE\nNomor INV/2026/X/0007\nTanggal 11 Oktober 2026\nJatuh tempo 25 Oktober 2026\nKepada Kafe Senja\nTotal tagihan Rp2.934.000" },
  { jenis: "nota", teks: "TOKO SUMBER REJEKI\nNOTA\nNo. NT-4671\nGula pasir 2 x 18.000 36.000\nTOTAL 36.000\nTerima kasih" },
  { jenis: "slip_gaji", teks: "SLIP GAJI\nPeriode Oktober 2026\nNama Ketut Rahmawati\nGaji pokok 6.400.000\nTunjangan makan 700.000\nPPh 21 48.000\nGaji diterima 7.196.000" },
  { jenis: "mutasi", teks: "Tanggal,Keterangan,Cabang,Jumlah,Saldo\n07/10/2026,PEMBAYARAN LISTRIK PLN,0000,2503000.00 DB,15806500.00" },
  { jenis: "ktp", teks: "PROVINSI BALI\nKOTA DENPASAR\nNIK : ****1840\nNama : AGUS ASTUTI\nTempat/Tgl Lahir : DENPASAR, 26-05-1983\nJenis kelamin : LAKI-LAKI" },
  { jenis: "absen", teks: "Nama,Tanggal,Masuk,Pulang,Keterangan\nSiti Wijaya,2026-10-01,07.15,18.25," },
];

export type HasilPeriksa = { lulus: boolean; alasan: string[] };

/** Kuantor terbuka (+, *, {n,}) di dalam grup yang grupnya sendiri juga diulang: pola klasik penyebab ReDoS. */
export function pengulanganBersarang(pola: string): boolean {
  const tumpuk: { mulai: number; punyaKuantor: boolean }[] = [];
  let lolos = false;
  for (let i = 0; i < pola.length; i++) {
    const c = pola[i];
    if (c === "\\") { i++; continue; }
    if (c === "[") { while (i < pola.length && pola[i] !== "]") { if (pola[i] === "\\") i++; i++; } continue; }
    if (c === "(") { tumpuk.push({ mulai: i, punyaKuantor: false }); continue; }
    if (c === ")") {
      const g = tumpuk.pop();
      const sisa = pola.slice(i + 1);
      const diulang = /^[+*]/.test(sisa) || /^\{\d+,\d*\}/.test(sisa);
      // Satu baris lalu baris baru, misalnya (?:.*\n)*: titik tidak bisa melewati baris baru, jadi tiap putaran pasti (tidak meledak).
      const isi = g ? pola.slice(g.mulai + 1, i).replace(/^\?:/, "") : "";
      const sebaris = /^(\.|\[\^\\n\])[*+]\??\\n$/.test(isi);
      if (g?.punyaKuantor && diulang && !sebaris) lolos = true;
      if (g?.punyaKuantor && tumpuk.length) tumpuk[tumpuk.length - 1].punyaKuantor = true;
      continue;
    }
    if ((c === "+" || c === "*" || (c === "{" && /^\{\d+,\d*\}/.test(pola.slice(i)) && !/^\{\d+\}/.test(pola.slice(i)))) && tumpuk.length) tumpuk[tumpuk.length - 1].punyaKuantor = true;
  }
  return lolos;
}

function periksaPola(pola: unknown, nama: string, alasan: string[], grupBernama = false) {
  if (typeof pola !== "string" || !pola.length) return alasan.push(`${nama}: pola kosong`);
  if (pola.length > MAKS_POLA) alasan.push(`${nama}: pola lebih dari ${MAKS_POLA} huruf`);
  if (/\\[1-9]|\\k</.test(pola)) alasan.push(`${nama}: rujukan balik dilarang`);
  if (/\(\?<?[=!]/.test(pola)) alasan.push(`${nama}: lookahead/lookbehind dilarang`);
  if (pengulanganBersarang(pola)) alasan.push(`${nama}: pengulangan bersarang (berisiko lambat)`);
  if ((pola.match(/(?<!\\)[+*]|\{\d+,\}/g) ?? []).length > MAKS_KUANTOR_TERBUKA) alasan.push(`${nama}: terlalu banyak pengulangan terbuka`);
  if (BAHAYA_TEKS.test(pola)) alasan.push(`${nama}: berisi teks yang menyerupai skrip atau SQL`);
  let re: RegExp;
  try { re = new RegExp(pola, "im"); } catch { return alasan.push(`${nama}: regex tidak sah`); }
  const grup = (pola.match(/\((?!\?)/g) ?? []).length + (pola.match(/\(\?<[A-Za-z]/g) ?? []).length;
  if (!grupBernama && grup !== 1) alasan.push(`${nama}: harus tepat satu grup tangkap`);
  if (grupBernama && !/\(\?<[A-Za-z]\w*>/.test(pola)) alasan.push(`${nama}: baris tabel wajib memakai grup bernama`);
  const t0 = Date.now();
  for (const j of JEBAKAN) re.test(j);
  if (Date.now() - t0 > 50) alasan.push(`${nama}: lambat pada teks jebakan (${Date.now() - t0} ms)`);
}

function periksaTeks(v: unknown, nama: string, alasan: string[], min = 1, maks = 80) {
  if (typeof v !== "string" || v.trim().length < min || v.length > maks) return alasan.push(`${nama}: teks ${min}-${maks} huruf`);
  if (BAHAYA_TEKS.test(v)) alasan.push(`${nama}: berisi teks yang menyerupai skrip atau SQL`);
}

/** Pemeriksa deterministik untuk satu aturan dari model. Tidak memanggil model apa pun. */
export function periksaAturan(aturan: Aturan, korpus = KORPUS_PEMBANDING): HasilPeriksa {
  const alasan: string[] = [];
  const a = aturan as unknown as Record<string, unknown>;
  if (!a || typeof a !== "object") return { lulus: false, alasan: ["aturan bukan objek"] };
  const kunciBoleh = a.bentuk === "teks" ? ["bentuk", "jenis", "jangkar", "bidang", "tabel"] : ["bentuk", "jenis", "jangkar", "kolom"];
  for (const k of Object.keys(a)) if (!kunciBoleh.includes(k)) alasan.push(`kunci tidak dikenal: ${k}`);
  if (a.bentuk !== "teks" && a.bentuk !== "kolom") alasan.push("bentuk harus teks atau kolom");
  // T-01B: aturan struk foto klaim (pemasok, tanggal, total) memakai jenis "struk" di luar JENIS inti Lempar.
  if (typeof a.jenis !== "string" || ![...JENIS, "struk"].includes(a.jenis)) alasan.push("jenis berkas tidak dikenal");
  const jangkar = a.jangkar;
  if (!Array.isArray(jangkar) || jangkar.length < 2 || jangkar.length > 8) alasan.push("jangkar 2-8 label");
  else for (const [i, j] of jangkar.entries()) {
    periksaTeks(j, `jangkar ${i + 1}`, alasan, 2, 60);
    if (typeof j === "string" && /^[\d\s.,/:-]+$/.test(j)) alasan.push(`jangkar ${i + 1}: angka atau tanggal bukan label tetap`);
  }
  if (a.bentuk === "teks") {
    const bidang = a.bidang as Record<string, { pola: unknown; tipe: unknown }> | undefined;
    if (!bidang || typeof bidang !== "object") alasan.push("bidang wajib ada");
    else {
      const daftar = Object.entries(bidang);
      if (!daftar.length && !a.tabel) alasan.push("bidang minimal satu");
      if (daftar.length > MAKS_BIDANG) alasan.push(`bidang lebih dari ${MAKS_BIDANG}`);
      for (const [k, v] of daftar) {
        if (!/^[a-z_][a-z0-9_.]{0,60}$/.test(k) || /(^|\.)(__proto__|constructor|prototype)(\.|$)/.test(k)) alasan.push(`nama bidang tidak sah: ${k.slice(0, 40)}`);
        if (!TIPE.includes(v?.tipe as Tipe)) alasan.push(`${k}: tipe tidak dikenal`);
        periksaPola(v?.pola, k, alasan);
      }
    }
    const tabel = a.tabel as { pola?: unknown; setelah?: unknown; sebelum?: unknown; tipe?: Record<string, unknown>; gabung?: unknown } | undefined;
    if (tabel) {
      periksaPola(tabel.pola, "tabel", alasan, true);
      for (const t of Object.values(tabel.tipe ?? {})) if (!TIPE.includes(t as Tipe)) alasan.push("tabel: tipe kolom tidak dikenal");
      if (tabel.setelah !== undefined && tabel.setelah !== "") periksaTeks(tabel.setelah, "tabel setelah", alasan, 1, 120);
      if (tabel.sebelum !== undefined && tabel.sebelum !== "") periksaTeks(tabel.sebelum, "tabel sebelum", alasan, 1, 120);
      if (tabel.gabung !== undefined && !(Number.isInteger(tabel.gabung) && (tabel.gabung as number) >= 1 && (tabel.gabung as number) <= 4)) alasan.push("tabel: gabung 1-4");
    }
  } else if (a.bentuk === "kolom") {
    const kolom = a.kolom as Record<string, { judul: unknown; tipe: unknown }> | undefined;
    if (!kolom || typeof kolom !== "object" || !Object.keys(kolom).length) alasan.push("kolom wajib ada");
    else for (const [k, v] of Object.entries(kolom)) {
      if (!/^[a-z_][a-z0-9_.]{0,60}$/.test(k) || /(^|\.)(__proto__|constructor|prototype)(\.|$)/.test(k)) alasan.push(`nama kolom tidak sah: ${k.slice(0, 40)}`);
      periksaTeks(v?.judul, `${k} judul`, alasan, 1, 80);
      if (!TIPE.includes(v?.tipe as Tipe)) alasan.push(`${k}: tipe tidak dikenal`);
    }
  }
  // Terlalu umum: jangkar aturan ini cocok dengan contoh berkas jenis lain.
  if (!alasan.length) {
    for (const c of korpus) {
      if (c.jenis === a.jenis) continue;
      try { if (cocok(aturan, c.teks)) alasan.push(`terlalu umum: jangkar juga cocok dengan contoh ${c.jenis}`); } catch { alasan.push("aturan gagal dijalankan pada korpus"); break; }
    }
  }
  return { lulus: alasan.length === 0, alasan };
}

/** Masa bayangan: aturan baru aktif setelah hasilnya sama dengan model pada sejumlah berkas berikutnya. */
export const BAYANGAN_WAJIB = 2;
