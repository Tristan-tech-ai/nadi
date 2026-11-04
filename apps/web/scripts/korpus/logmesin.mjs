// Korpus log mesin absen (M-12): tiga ekspor sintetis dengan tata letak berbeda. Satu baris per tempelan; jawaban = rekap per orang
// per hari (masuk = tempelan pertama atau pertama berstatus masuk, pulang = terakhir bila >= 30 menit). Berbenih, indeks sendiri
// (fixtures/korpus/logmesin-indeks.json). Jalankan dari apps/web: node scripts/korpus/logmesin.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";

const AKAR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "fixtures", "korpus");
const DIR = join(AKAR, "logmesin");
mkdirSync(DIR, { recursive: true });
let a = 20261105;
const acak = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const ORANG = ["Sari Dewi", "Komang Ayu", "Made Putra", "Wayan Sari", "Ketut Arta"];
const jam = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}.${String(m % 60).padStart(2, "0")}`;
const hh = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const indeks = [];

/** Tempelan sintetis 3 hari: masuk sekitar 07.45-08.10, kadang tempel ganda saat masuk, pulang sekitar 16.55-17.30; satu orang lupa pulang. */
function tempelan() {
  const daftar = [];
  for (const tgl of ["2026-11-02", "2026-11-03", "2026-11-04"]) {
    ORANG.forEach((nama, i) => {
      const masuk = 465 + Math.floor(acak() * 25);
      daftar.push({ nama, tgl, m: masuk, s: "in" });
      if (acak() < 0.3) daftar.push({ nama, tgl, m: masuk + 1, s: "in" });
      if (!(tgl === "2026-11-03" && i === 4)) daftar.push({ nama, tgl, m: 1015 + Math.floor(acak() * 35), s: "out" });
    });
  }
  return daftar.sort((x, y) => x.tgl.localeCompare(y.tgl) || x.m - y.m);
}
function jawaban(daftar) {
  const per = new Map();
  for (const t of daftar) { const k = `${t.nama}|${t.tgl}`; per.set(k, [...(per.get(k) ?? []), t]); }
  return [...per.values()].map((xs) => {
    const masuk = Math.min(...xs.map((x) => x.m)), akhir = Math.max(...xs.map((x) => x.m));
    return { nama: xs[0].nama, tanggal: xs[0].tgl, masuk: jam(masuk), pulang: akhir - masuk >= 30 ? jam(akhir) : "", keterangan: akhir - masuk >= 30 ? "" : "tempel sekali" };
  }).sort((p, q) => p.tanggal.localeCompare(q.tanggal) || p.nama.localeCompare(q.nama));
}
function catat(id, ext, baris, catatan) {
  writeFileSync(join(DIR, `${id}.json`), JSON.stringify({ jenis: "absen", berkas: `${id}.${ext}`, bidang: { baris }, catatan }, null, 1) + "\n");
  indeks.push({ jenis: "absen", berkas: `logmesin/${id}.${ext}`, jawaban: `logmesin/${id}.json` });
  return join(DIR, `${id}.${ext}`);
}

// 1. Gaya ekspor mesin umum: AC-No., Name, Time (dd/mm/yyyy hh:mm), State C/In C/Out.
{
  const d = tempelan();
  const isi = ["AC-No.,Name,Time,State", ...d.map((t) => `${10 + ORANG.indexOf(t.nama)},${t.nama},${t.tgl.split("-").reverse().join("/")} ${hh(t.m)},${t.s === "in" ? "C/In" : "C/Out"}`)].join("\n");
  writeFileSync(catat("log-01", "csv", jawaban(d), "AC-No., Name, Time, State"), isi + "\n");
}
// 2. Titik koma, tanggal dan jam terpisah, tanpa status, ada judul laporan di baris pertama.
{
  const d = tempelan();
  const isi = ["Laporan Absensi Mesin X Toko Berkah", "No;ID;Nama;Tanggal;Jam", ...d.map((t, i) => `${i + 1};${10 + ORANG.indexOf(t.nama)};${t.nama};${t.tgl.split("-").reverse().join("-")};${jam(t.m)}`)].join("\n");
  writeFileSync(catat("log-02", "csv", jawaban(d), "titik koma, tanggal-jam terpisah, tanpa status"), isi + "\n");
}
// 3. Excel: Nama Karyawan, Waktu (yyyy-mm-dd hh:mm:ss teks), Status Masuk/Keluar.
{
  const d = tempelan();
  const wb = new ExcelJS.Workbook();
  wb.created = wb.modified = new Date(Date.UTC(2026, 10, 5));
  const ws = wb.addWorksheet("Log");
  ws.addRow(["Nama Karyawan", "Waktu", "Status"]);
  for (const t of d) ws.addRow([t.nama, `${t.tgl} ${hh(t.m)}:${String(Math.floor(acak() * 60)).padStart(2, "0")}`, t.s === "in" ? "Masuk" : "Keluar"]);
  await wb.xlsx.writeFile(catat("log-03", "xlsx", jawaban(d), "Excel, waktu dengan detik, status Masuk/Keluar"));
}
writeFileSync(join(AKAR, "logmesin-indeks.json"), JSON.stringify({ dibuat: "deterministik, M-12", jumlah: indeks.length, berkas: indeks }, null, 1) + "\n");
console.log("korpus log mesin:", indeks.map((x) => x.berkas).join(", "));
