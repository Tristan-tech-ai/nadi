// Korpus sintetis dokumen pabean (B-EKSIM3). Tata letak meniru elemen formulir resmi, bukan salinan dokumen nyata:
// PIB BC 2.0 (Lampiran PER-44/BC/2011, salinan di pajak.go.id) dan PEB BC 3.0 (Lampiran PER-07/BC/2020, jdih.kemenkeu.go.id).
// SPPB berisi elemen identitas umum (nomor, tanggal, nomor PIB, importir). Semua nama, nomor, dan angka karangan; setiap berkas
// bertanda CONTOH. Terpisah dari buat.mjs agar korpus lama (dan sidik PDF-nya) tidak berubah.
// Pemakaian (dari apps/web): node scripts/korpus/pabean.mjs -> ../../fixtures/korpus/pabean/{id}.pdf + {id}.json + indeks.json
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const AKAR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "fixtures", "korpus", "pabean");
mkdirSync(AKAR, { recursive: true });
const rp = (n) => new Intl.NumberFormat("id-ID").format(n);
const us = (n) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const kurs = (n) => new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const tglId = (iso) => { const [y, m, d] = iso.split("-"); return `${d}-${m}-${y}`; };
const pct = (bp) => Math.round(bp);
const kali = (rp0, persen) => Math.round((rp0 * Math.round(persen * 100)) / 10000);

const gaya = "body{margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#111}table{border-collapse:collapse;width:100%}td,th{border:1px solid #444;padding:3px 5px;vertical-align:top;text-align:left}h1{font-size:15px;margin:0}.k{color:#555}.c{border:2px solid #b00;color:#b00;display:inline-block;padding:1px 6px;font-weight:bold;margin-bottom:4px}";
const indeks = [];

function pibData(i, d) {
  const cif = d.fob + d.freight + d.asuransi;
  const pabean = Math.round(cif * d.ndpbm);
  const bm = kali(pabean, d.bmPersen);
  const nilaiImpor = pabean + bm;
  const ppn = Math.round((nilaiImpor * 1200 * 11) / (10000 * 12));
  const pph = kali(nilaiImpor, d.pphPersen);
  return {
    nomor_pengajuan: d.pengajuan, nomor_daftar: d.daftar, tanggal_daftar: d.tanggal, pemasok: d.pemasok, negara_pemasok: d.negara, importir: d.importir,
    valuta: "USD", ndpbm: d.ndpbm, fob: d.fob, freight: d.freight, asuransi: d.asuransi, nilai_cif: Math.round(cif * 100) / 100, nilai_pabean_rp: pabean,
    baris: d.baris, bm, cukai: 0, ppn, ppnbm: 0, pph, total: bm + ppn + pph,
  };
}

function htmlPib(b, d) {
  return `<div class="c">CONTOH</div>
  <table><tr><td style="width:60%"><b>Kantor Pabean</b>: ${d.kantor}<br>Nomor Pengajuan: ${b.nomor_pengajuan}</td><td><h1>PEMBERITAHUAN IMPOR BARANG (PIB)</h1>BC 2.0 &nbsp; Halaman 1 dari 1</td></tr></table>
  <p>A. JENIS PIB: 1. Biasa &nbsp; B. JENIS IMPOR: 1. Untuk Dipakai &nbsp; C. CARA PEMBAYARAN: 1. Biasa/Tunai</p>
  <table>
   <tr><td><b>D. DATA PEMBERITAHUAN</b><br>PEMASOK<br>1. Nama, Alamat, Negara: ${b.pemasok}, ${d.alamatPemasok}, ${b.negara_pemasok}</td><td><b>F. DIISI OLEH BEA DAN CUKAI</b><br>No. &amp; Tgl. Pendaftaran: ${b.nomor_daftar} / ${tglId(b.tanggal_daftar)}</td></tr>
   <tr><td>IMPORTIR<br>2. Identitas: NPWP ${d.npwp}<br>3. Nama, Alamat: ${b.importir}, ${d.alamatImportir}<br>4. Status: Umum &nbsp; 5. API/APIT: ${d.api}</td><td>15. Invoice: No. ${d.invoice} Tgl. ${tglId(d.tglInvoice)}<br>17. BL/AWB: No. ${d.bl}</td></tr>
   <tr><td>9. Cara Pengangkutan: Laut<br>12. Pelabuhan Muat: ${d.muat}<br>14. Pelabuhan Bongkar: ${d.bongkar}</td><td>21. Valuta: USD &nbsp; 22. NDPBM: ${kurs(b.ndpbm)}<br>23. FOB: ${us(b.fob)}<br>24. Freight: ${us(b.freight)}<br>25. Asuransi LN/DN: ${us(b.asuransi)}<br>26. Nilai CIF: ${us(b.nilai_cif)} &nbsp; Rp. ${rp(b.nilai_pabean_rp)}</td></tr>
  </table>
  <table style="margin-top:6px"><tr><th>31. No</th><th>32. Pos Tarif / HS, Uraian barang</th><th>33. Negara Asal</th><th>34. Tarif BM / PPN / PPh</th><th>35. Jumlah &amp; Jenis Satuan</th></tr>
   ${b.baris.map((x, k) => `<tr><td>${k + 1}</td><td>${x.hs}<br>${x.uraian}</td><td>${b.negara_pemasok}</td><td>BM ${d.bmPersen}% / PPN 11% / PPh ${d.pphPersen}%</td><td>${rp(x.jumlah)} ${x.satuan}</td></tr>`).join("")}</table>
  <table style="margin-top:6px"><tr><th>Jenis Pungutan</th><th>Dibayar (Rp)</th><th>Ditanggung Pemerintah (Rp)</th><th>Ditangguhkan (Rp)</th><th>Dibebaskan (Rp)</th></tr>
   <tr><td>37. BM</td><td>${rp(b.bm)}</td><td>0</td><td>0</td><td>0</td></tr>
   <tr><td>38. Cukai</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
   <tr><td>39. PPN</td><td>${rp(b.ppn)}</td><td>0</td><td>0</td><td>0</td></tr>
   <tr><td>40. PPnBM</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
   <tr><td>41. PPh</td><td>${rp(b.pph)}</td><td>0</td><td>0</td><td>0</td></tr>
   <tr><td><b>42. TOTAL</b></td><td><b>${rp(b.total)}</b></td><td>0</td><td>0</td><td>0</td></tr></table>
  <p class="k">Dokumen contoh sintetis untuk uji Nadi, bukan dokumen pabean sungguhan.</p>`;
}

function htmlPeb(b, d) {
  return `<div class="c">CONTOH</div>
  <table><tr><td style="width:60%">BC 3.0 &nbsp; Nomor Pengajuan: ${b.nomor_pengajuan}<br>A. KANTOR PABEAN 1. Kantor Pabean Pemuatan: ${d.kantor}</td><td><h1>PEMBERITAHUAN EKSPOR BARANG</h1>H. KOLOM KHUSUS BEA DAN CUKAI<br>1. Nomor Pendaftaran: ${b.nomor_daftar} Tanggal: ${tglId(b.tanggal_daftar)}</td></tr></table>
  <table style="margin-top:6px">
   <tr><td>EKSPORTIR<br>1. Identitas: NPWP ${d.npwp}<br>2. Nama: ${b.eksportir}<br>3. Alamat: ${d.alamat}</td><td>PEMBELI<br>14. Nama: ${b.pembeli}<br>15. Alamat: ${d.alamatPembeli}<br>16. Negara: ${d.negaraPembeli}</td></tr>
   <tr><td>21. Pelabuhan Muat Asal: ${d.muat}<br>25. Pelabuhan Tujuan: ${d.tujuan}</td><td>26. Negara Tujuan Ekspor: ${b.negara_tujuan}<br>32. Cara Penyerahan Barang: FOB</td></tr>
   <tr><td>27. Nomor &amp; Tgl Invoice: ${d.invoice}<br>28. Nomor &amp; Tgl Packing List: ${d.pl}</td><td>34. Jenis Valuta: USD<br>35. Nilai Ekspor: ${us(b.nilai_fob)}<br>52. Nilai Tukar Mata Uang: ${kurs(b.nilai_tukar)}</td></tr>
  </table>
  <table style="margin-top:6px"><tr><th>44. No.</th><th>45. Pos Tarif/HS, Uraian barang</th><th>48. Jumlah &amp; Jenis Sat.</th><th>51. Jumlah Nilai FOB</th></tr>
   ${b.baris.map((x, k) => `<tr><td>${k + 1}</td><td>${x.hs}<br>${x.uraian}</td><td>${rp(x.jumlah)} ${x.satuan}</td><td>${us(x.fob)}</td></tr>`).join("")}</table>
  <p>53. Nilai Bea Keluar: Rp ${rp(b.bea_keluar)}</p>
  <p class="k">Dokumen contoh sintetis untuk uji Nadi, bukan dokumen pabean sungguhan.</p>`;
}

function htmlSppb(b, d) {
  return `<div class="c">CONTOH</div>
  <h1 style="text-align:center">SURAT PERSETUJUAN PENGELUARAN BARANG (SPPB)</h1>
  <p style="text-align:center">Kantor Pabean: ${d.kantor}<br>Nomor: ${b.nomor} &nbsp; Tanggal: ${tglId(b.tanggal)}</p>
  <table><tr><td style="width:35%">Nomor / Tanggal Pendaftaran PIB</td><td>${b.nomor_pib} / ${tglId(b.tanggal_pib)}</td></tr>
   <tr><td>Importir</td><td>${b.importir}, NPWP ${d.npwp}</td></tr><tr><td>BL/AWB</td><td>${d.bl}</td></tr><tr><td>Jumlah kemasan</td><td>${d.kemasan}</td></tr></table>
  <p>Barang impor tersebut di atas dapat dikeluarkan dari kawasan pabean.</p>
  <p class="k">Dokumen contoh sintetis untuk uji Nadi, bukan dokumen pabean sungguhan.</p>`;
}

const PIB = [
  { pengajuan: "000020-0A1B2C-20261104-000123", daftar: "314159", tanggal: "2026-11-04", pemasok: "Harbour Supply Pty Ltd", alamatPemasok: "18 Wharf Street, Fremantle", negara: "Australia",
    importir: "CV Kopi Uji Nusantara", alamatImportir: "Jl. Contoh Raya 1, Denpasar", npwp: "99.999.999.9-999.001", api: "API-U", invoice: "HS-INV-2207", tglInvoice: "2026-10-20", bl: "FRE-BNO-55120",
    muat: "Fremantle", bongkar: "Benoa", kantor: "KPPBC TMP Benoa (contoh)", ndpbm: 16287.5, fob: 10000, freight: 800, asuransi: 50, bmPersen: 5, pphPersen: 2.5,
    baris: [{ hs: "8438.80.11", uraian: "Mesin sangrai kopi kapasitas 5 kg", jumlah: 1, satuan: "UNIT" }, { hs: "8419.89.20", uraian: "Pendingin biji kopi", jumlah: 2, satuan: "UNIT" }] },
  { pengajuan: "000020-0A1B2C-20261028-000098", daftar: "271828", tanggal: "2026-10-28", pemasok: "Lotus Packaging Co., Ltd", alamatPemasok: "88 Industrial Road, Shenzhen", negara: "China",
    importir: "CV Kopi Uji Nusantara", alamatImportir: "Jl. Contoh Raya 1, Denpasar", npwp: "99.999.999.9-999.001", api: "-", invoice: "LP-26-0441", tglInvoice: "2026-10-10", bl: "SZX-SUB-77013",
    muat: "Shekou", bongkar: "Tanjung Perak", kantor: "KPU BC Tanjung Perak (contoh)", ndpbm: 16310.25, fob: 4250.4, freight: 610, asuransi: 21.25, bmPersen: 10, pphPersen: 7.5,
    baris: [{ hs: "4819.20.00", uraian: "Kotak lipat karton kemasan kopi", jumlah: 20000, satuan: "PCE" }, { hs: "3923.21.99", uraian: "Kantong plastik berkatup", jumlah: 15000, satuan: "PCE" }, { hs: "4821.10.90", uraian: "Label kertas tercetak", jumlah: 30000, satuan: "PCE" }] },
];
for (const [i, d] of PIB.entries()) {
  const id = `pib-${String(i + 1).padStart(2, "0")}`;
  const b = pibData(i, d);
  indeks.push({ jenis: "pib", id, bidang: b, html: htmlPib(b, d) });
}
{
  const b = { nomor_pengajuan: "000030-0A1B2C-20261102-000031", nomor_daftar: "161803", tanggal_daftar: "2026-11-02", eksportir: "CV Kopi Uji Nusantara", pembeli: "Harbour Roasters Pty Ltd",
    negara_tujuan: "AU Australia", valuta: "USD", nilai_fob: 8821.05, nilai_tukar: 16287.5, bea_keluar: 0,
    baris: [{ hs: "0901.11.10", uraian: "Kopi arabika biji mentah grade 1", jumlah: 1200, satuan: "KGM", fob: 8820 }, { hs: "0901.21.20", uraian: "Kopi sangrai contoh", jumlah: 3, satuan: "BG", fob: 1.05 }] };
  const d = { kantor: "KPPBC TMP Benoa (contoh)", npwp: "99.999.999.9-999.001", alamat: "Jl. Contoh Raya 1, Denpasar", alamatPembeli: "18 Wharf Street, Fremantle WA 6160", negaraPembeli: "AU",
    muat: "Benoa", tujuan: "Fremantle", invoice: "001/EXP/XI/2026, 02-11-2026", pl: "001/EXP/XI/2026, 02-11-2026" };
  const { baris, ...lain } = b;
  indeks.push({ jenis: "peb", id: "peb-01", bidang: { ...lain, baris: baris.map(({ fob, ...x }) => x) }, html: htmlPeb(b, d) });
}
{
  const b = { nomor: "089123/KPU.07/2026", tanggal: "2026-11-05", nomor_pib: "314159", tanggal_pib: "2026-11-04", importir: "CV Kopi Uji Nusantara" };
  indeks.push({ jenis: "sppb", id: "sppb-01", bidang: b, html: htmlSppb(b, { kantor: "KPPBC TMP Benoa (contoh)", npwp: "99.999.999.9-999.001", bl: "FRE-BNO-55120", kemasan: "3 PK (peti kemas)" }) });
}

const peramban = await chromium.launch();
const page = await peramban.newPage();
for (const x of indeks) {
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>${gaya}@page{size:A4;margin:12mm}</style>${x.html}`);
  await page.pdf({ path: join(AKAR, `${x.id}.pdf`), format: "A4", printBackground: true });
  writeFileSync(join(AKAR, `${x.id}.json`), JSON.stringify({ jenis: x.jenis, berkas: `${x.id}.pdf`, bidang: x.bidang }, null, 1) + "\n");
}
await peramban.close();
writeFileSync(join(AKAR, "indeks.json"), JSON.stringify({ dibuat: "B-EKSIM3, deterministik", berkas: indeks.map((x) => ({ jenis: x.jenis, berkas: `pabean/${x.id}.pdf`, jawaban: `pabean/${x.id}.json` })) }, null, 1) + "\n");
console.log("ditulis", indeks.length, "berkas ke", AKAR, pct(1));
