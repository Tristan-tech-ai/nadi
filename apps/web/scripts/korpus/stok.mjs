// Korpus M-02B untuk Lempar: daftar produk (Excel) dan hasil hitung stok (Excel dan foto lembar hitung). Sintetis dan berbenih;
// indeks sendiri (fixtures/korpus/stok-indeks.json) agar korpus lama tidak berubah. Jalankan dari apps/web: node scripts/korpus/stok.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import ExcelJS from "exceljs";

const AKAR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "fixtures", "korpus");
const indeks = [];
function catat(jenis, id, ext, bidang, catatan) {
  const dir = join(AKAR, jenis);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${id}.json`), JSON.stringify({ jenis, berkas: `${id}.${ext}`, bidang, catatan }, null, 1) + "\n");
  indeks.push({ jenis, berkas: `${jenis}/${id}.${ext}`, jawaban: `${jenis}/${id}.json` });
  return join(dir, `${id}.${ext}`);
}
const buku = () => { const wb = new ExcelJS.Workbook(); wb.created = wb.modified = new Date(Date.UTC(2026, 10, 5)); return wb; };

const PRODUK = [
  ["GL-01", "Gula Pasir 1 kg", "pcs", 16500, 40], ["MG-02", "Minyak Goreng 2 L", "pcs", 38000, 24], ["TR-01", "Tepung Terigu 1 kg", "pcs", 13000, 30],
  ["BR-05", "Beras Pulen 5 kg", "karung", 74000, 12], ["KP-20", "Kopi Bubuk 200 g", "bks", 18500, 36], ["TH-25", "Teh Celup isi 25", "kotak", 9000, 48],
  ["SB-01", "Sabun Cuci Piring 800 ml", "pcs", 14500, 20], ["TL-30", "Telur Ayam 1 tray", "tray", 56000, 8], ["MI-01", "Mi Instan Goreng", "dus", 115000, 6],
  ["AQ-15", "Air Mineral 1,5 L", "pcs", 6500, 60], ["KC-01", "Kecap Manis 520 ml", "pcs", 23000, 18], ["SS-01", "Susu Kental Manis", "kaleng", 12500, 30],
];

async function main() {
  // 1. Daftar produk: kolom Kode, Nama Barang, Satuan, Harga Jual (Rp), Stok.
  {
    const wb = buku();
    const ws = wb.addWorksheet("Produk");
    ws.addRow(["Kode", "Nama Barang", "Satuan", "Harga Jual (Rp)", "Stok"]);
    for (const p of PRODUK) ws.addRow(p);
    const path = catat("produk", "produk-01", "xlsx", { baris: PRODUK.map(([kode, nama, satuan, harga_jual, stok]) => ({ kode, nama, satuan, harga_jual, stok })) }, "daftar barang toko kelontong");
    await wb.xlsx.writeFile(path);
  }
  // 2. Hitung stok Excel: tanpa kode, nama sesuai daftar, kolom "Hitung fisik".
  const hitung = PRODUK.slice(0, 8).map(([, nama], i) => ({ kode: "", nama, jumlah: [37, 24, 28, 11, 33, 50, 19, 7][i] }));
  {
    const wb = buku();
    const ws = wb.addWorksheet("Opname");
    ws.addRow(["Stok opname Toko Berkah", "", "Tanggal 2026-11-03"]);
    ws.addRow(["No", "Barang", "Hitung fisik"]);
    hitung.forEach((h, i) => ws.addRow([i + 1, h.nama, h.jumlah]));
    const path = catat("opname", "opname-01", "xlsx", { gudang: "Toko Berkah", tanggal: "2026-11-03", baris: hitung }, "tanpa kode, judul di baris pertama");
    await wb.xlsx.writeFile(path);
  }
  // 3. Foto lembar hitung: kode dan jumlah ditulis tangan (huruf tulisan), garis buku.
  const foto = PRODUK.slice(4, 10).map(([kode, nama], i) => ({ kode, nama, jumlah: [31, 47, 18, 8, 5, 55][i] }));
  {
    const b = await chromium.launch();
    const page = await b.newPage({ viewport: { width: 620, height: 600 }, deviceScaleFactor: 2 });
    const baris = foto.map((f) => `<tr><td>${f.kode}</td><td>${f.nama}</td><td class="t">${f.jumlah}</td></tr>`).join("");
    await page.setContent(`<html><body style="margin:0;background:#f3efe4"><div style="padding:22px 26px;width:580px;font-family:Arial,sans-serif;color:#222;transform:rotate(-1.2deg)">
      <div style="font-size:18px;font-weight:700">LEMBAR HITUNG STOK - Gudang Belakang</div><div style="font-size:14px">Tanggal: 04/11/2026 &nbsp; Petugas: Rina</div>
      <table style="border-collapse:collapse;width:100%;margin-top:12px;font-size:15px">
      <tr style="border-bottom:2px solid #333"><th style="text-align:left">Kode</th><th style="text-align:left">Barang</th><th style="text-align:right">Fisik</th></tr>${baris}</table>
      <style>td{border-bottom:1px solid #9bb;padding:7px 4px} .t{text-align:right;font-family:'Comic Sans MS','Segoe Print',cursive;font-size:19px;color:#1b3a8a}</style></div></body></html>`);
    const path = catat("opname", "opname-02", "png", { gudang: "Gudang Belakang", tanggal: "2026-11-04", baris: foto }, "foto lembar hitung, angka tulisan tangan");
    await page.screenshot({ path, fullPage: true });
    await b.close();
  }
  writeFileSync(join(AKAR, "stok-indeks.json"), JSON.stringify({ dibuat: "deterministik, M-02B", jumlah: indeks.length, berkas: indeks }, null, 1) + "\n");
  console.log("korpus stok:", indeks.map((x) => x.berkas).join(", "));
}
await main();
