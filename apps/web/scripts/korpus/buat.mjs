// Pembuat korpus contoh sintetis untuk Lempar Saja dan ekstraktor (F0-10). Deterministik: seed tetap, hasil sama setiap kali.
// Semua nama, nomor, dan angka karangan. NIK memakai kode provinsi 99 (tidak ada) dan setiap KTP bertanda CONTOH.
// Pemakaian (dari apps/web): node scripts/korpus/buat.mjs   -> menulis ../../fixtures/korpus/{jenis}/{id}.{png,pdf,xlsx,csv} + {id}.json + indeks.json
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import ExcelJS from "exceljs";

const AKAR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "fixtures", "korpus");

// --- acak deterministik (mulberry32)
function mulberry32(a) {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const acak = mulberry32(20261031);
const pilih = (a) => a[Math.floor(acak() * a.length)];
const antara = (a, b) => a + Math.floor(acak() * (b - a + 1));
const bulatkan = (n, ke = 500) => Math.round(n / ke) * ke;

const DEPAN = ["Made", "Ketut", "Nyoman", "Wayan", "Putu", "Komang", "Sari", "Dewi", "Budi", "Agus", "Rina", "Andi", "Siti", "Rudi", "Lestari", "Yudi", "Fitri", "Hendra", "Wulan", "Bayu", "Indah", "Dimas", "Ratna", "Eka", "Novi"];
const BELAKANG = ["Arsana", "Wirawan", "Pratama", "Santoso", "Lestari", "Saputra", "Wijaya", "Kurniawan", "Hidayat", "Rahmawati", "Sudarma", "Astuti", "Permana", "Utami", "Gunawan"];
const orang = () => `${pilih(DEPAN)} ${pilih(BELAKANG)}`;
const PEMASOK = [
  { nama: "UD Sumber Rejeki", alamat: "Jl. Gatot Subroto Barat No. 18, Denpasar", tata: "a" },
  { nama: "CV Tani Makmur", alamat: "Jl. By Pass Ngurah Rai No. 210, Kuta", tata: "b" },
];
const BARANG = [["Beras premium 5 kg", 78000], ["Minyak goreng 2 L", 36500], ["Gula pasir 1 kg", 17500], ["Telur ayam 1 kg", 29000], ["Kopi bubuk 250 g", 24000], ["Susu kental manis", 12500], ["Tepung terigu 1 kg", 13500], ["Bawang merah 1 kg", 42000], ["Cabai rawit 500 g", 31000], ["Air mineral 1 dus", 46000], ["Teh celup 25", 9500], ["Kecap manis 600 ml", 23500]];
const rp = (n) => "Rp" + new Intl.NumberFormat("id-ID").format(n);
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const ROMAWI = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const tgl = (d) => `${d.getUTCDate()} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
const iso = (d) => d.toISOString().slice(0, 10);
const hari = (y, m, d) => new Date(Date.UTC(y, m - 1, d));

const indeks = [];
function catat(jenis, id, ext, bidang, catatan) {
  const dir = join(AKAR, jenis);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${id}.json`), JSON.stringify({ jenis, berkas: `${id}.${ext}`, bidang, catatan }, null, 1) + "\n");
  indeks.push({ jenis, berkas: `${jenis}/${id}.${ext}`, jawaban: `${jenis}/${id}.json` });
  return join(dir, `${id}.${ext}`);
}

const gayaDasar = "body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#222;background:#fff}*{box-sizing:border-box}table{border-collapse:collapse;width:100%}";

async function gambar(page, html, path, lebar = 640) {
  await page.setViewportSize({ width: lebar, height: 400 });
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>${gayaDasar}</style>${html}`);
  await page.screenshot({ path, fullPage: true });
}
async function pdf(page, html, path) {
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>${gayaDasar}@page{size:A4;margin:18mm}</style>${html}`);
  await page.pdf({ path, format: "A4", printBackground: true });
}

// ---------- nota pemasok (2 tata letak x 4) ----------
async function nota(page) {
  for (let i = 1; i <= 8; i++) {
    const p = PEMASOK[(i - 1) % 2];
    const tanggal = hari(2026, 10, antara(1, 28));
    const no = `${p.tata === "a" ? "NT" : "INV-TM"}-${String(antara(1000, 9999))}`;
    const baris = Array.from({ length: antara(3, 7) }, () => { const [n, h] = pilih(BARANG); const q = antara(1, 12); return { nama: n, qty: q, harga: h, jumlah: q * h }; });
    const total = baris.reduce((a, b) => a + b.jumlah, 0);
    const html = p.tata === "a"
      ? `<div style="padding:22px;width:380px;font-family:'Courier New',monospace"><div style="text-align:center;font-weight:bold;font-size:18px">${p.nama}</div><div style="text-align:center;font-size:12px">${p.alamat}</div><hr style="border:0;border-top:1px dashed #333"><div style="font-size:13px">No: ${no}<br>Tgl: ${tanggal.getUTCDate()}/${tanggal.getUTCMonth() + 1}/${tanggal.getUTCFullYear()}</div><hr style="border:0;border-top:1px dashed #333"><table style="font-size:13px">${baris.map((b) => `<tr><td colspan=2>${b.nama}</td></tr><tr><td>${b.qty} x ${new Intl.NumberFormat("id-ID").format(b.harga)}</td><td style="text-align:right">${new Intl.NumberFormat("id-ID").format(b.jumlah)}</td></tr>`).join("")}</table><hr style="border:0;border-top:1px dashed #333"><div style="display:flex;justify-content:space-between;font-weight:bold"><span>TOTAL</span><span>${new Intl.NumberFormat("id-ID").format(total)}</span></div><div style="text-align:center;font-size:12px;margin-top:10px">Terima kasih. Barang yang sudah dibeli tidak dapat dikembalikan.</div></div>`
      : `<div style="padding:26px;width:600px"><div style="display:flex;justify-content:space-between;border-bottom:3px solid #2a6b3f;padding-bottom:8px"><div><div style="font-size:22px;font-weight:bold;color:#2a6b3f">${p.nama}</div><div style="font-size:12px">${p.alamat}</div></div><div style="text-align:right;font-size:13px"><b>NOTA PENJUALAN</b><br>${no}<br>${tgl(tanggal)}</div></div><table style="margin-top:14px;font-size:13px"><tr style="background:#eef5ef"><th style="text-align:left;padding:6px">Barang</th><th>Qty</th><th style="text-align:right">Harga</th><th style="text-align:right;padding:6px">Jumlah</th></tr>${baris.map((b) => `<tr><td style="padding:6px;border-bottom:1px solid #ddd">${b.nama}</td><td style="text-align:center;border-bottom:1px solid #ddd">${b.qty}</td><td style="text-align:right;border-bottom:1px solid #ddd">${rp(b.harga)}</td><td style="text-align:right;padding:6px;border-bottom:1px solid #ddd">${rp(b.jumlah)}</td></tr>`).join("")}<tr><td colspan=3 style="text-align:right;padding:6px;font-weight:bold">Total</td><td style="text-align:right;padding:6px;font-weight:bold">${rp(total)}</td></tr></table><div style="font-size:12px;margin-top:10px">Pembayaran tempo 14 hari ke BCA 0000000000 a.n. ${p.nama} (nomor contoh).</div></div>`;
    const path = catat("nota", `nota-${String(i).padStart(2, "0")}`, "png", { pemasok: p.nama, nomor: no, tanggal: iso(tanggal), baris, total }, `tata letak ${p.tata}`);
    await gambar(page, html, path, p.tata === "a" ? 420 : 660);
  }
}

// ---------- invoice (PDF, 2 tata letak x 3) ----------
async function invoice(page) {
  const penjual = [{ nama: "PT Kopi Kintamani Lestari", npwp: "0000.0000.0000.0001" }, { nama: "CV Laundry Bersih Jaya", npwp: "0000.0000.0000.0002" }];
  for (let i = 1; i <= 6; i++) {
    const pj = penjual[(i - 1) % 2];
    const tanggal = hari(2026, 10, antara(1, 25));
    const tempo = new Date(tanggal.getTime() + 14 * 864e5);
    const no = `INV/${2026}/${ROMAWI[9]}/${String(i * 7).padStart(4, "0")}`;
    const pembeli = pilih(["Warung Bu Made", "Kafe Senja Sanur", "Villa Asri Ubud", "Toko Sinar Jaya"]);
    const baris = Array.from({ length: antara(2, 5) }, () => { const q = antara(1, 20); const h = bulatkan(antara(15000, 250000), 1000); return { nama: pilih(["Biji kopi arabika 1 kg", "Jasa cuci linen per kg", "Gula aren 1 kg", "Setrika seprai", "Kopi robusta 1 kg", "Antar jemput cucian"]), qty: q, harga: h, jumlah: q * h }; });
    const subtotal = baris.reduce((a, b) => a + b.jumlah, 0);
    const html = `<div style="font-size:13px"><div style="display:flex;justify-content:space-between"><div><div style="font-size:20px;font-weight:bold">${pj.nama}</div><div>NPWP ${pj.npwp} (contoh)</div></div><div style="text-align:right"><div style="font-size:26px;letter-spacing:2px">INVOICE</div><div>No. ${no}</div><div>Tanggal ${tgl(tanggal)}</div><div>Jatuh tempo ${tgl(tempo)}</div></div></div><div style="margin:18px 0">Kepada: <b>${pembeli}</b></div><table><tr style="border-bottom:2px solid #000"><th style="text-align:left">Uraian</th><th>Qty</th><th style="text-align:right">Harga satuan</th><th style="text-align:right">Jumlah</th></tr>${baris.map((b) => `<tr style="border-bottom:1px solid #ccc"><td style="padding:5px 0">${b.nama}</td><td style="text-align:center">${b.qty}</td><td style="text-align:right">${rp(b.harga)}</td><td style="text-align:right">${rp(b.jumlah)}</td></tr>`).join("")}<tr><td colspan=3 style="text-align:right;padding-top:8px"><b>Total tagihan</b></td><td style="text-align:right;padding-top:8px"><b>${rp(subtotal)}</b></td></tr></table><p style="margin-top:24px">Transfer ke rekening contoh BRI 0000-00-000000-00-0. Dokumen ini bukan faktur pajak.</p></div>`;
    const path = catat("invoice", `invoice-${String(i).padStart(2, "0")}`, "pdf", { penjual: pj.nama, nomor: no, tanggal: iso(tanggal), jatuh_tempo: iso(tempo), pembeli, baris, total: subtotal }, "bukan faktur pajak");
    await pdf(page, html, path);
  }
}

// ---------- slip gaji (PDF x 6) ----------
async function slip(page) {
  for (let i = 1; i <= 6; i++) {
    const nama = orang();
    const pokok = bulatkan(antara(2900000, 6500000), 50000);
    const tunj = { transport: bulatkan(antara(200000, 600000), 50000), makan: bulatkan(antara(300000, 700000), 50000) };
    const lembur = i % 3 === 0 ? bulatkan(antara(100000, 450000), 5000) : 0;
    const potongan = { bpjs_kesehatan: Math.round(pokok * 0.01), jht: Math.round(pokok * 0.02), jp: Math.round(pokok * 0.01), pph21: bulatkan(pokok * 0.0075, 100), kasbon: i % 4 === 0 ? 250000 : 0 };
    const bruto = pokok + tunj.transport + tunj.makan + lembur;
    const totalPot = Object.values(potongan).reduce((a, b) => a + b, 0);
    const neto = bruto - totalPot;
    const baris = (o) => Object.entries(o).filter(([, v]) => v).map(([k, v]) => `<tr><td>${k.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase())}</td><td style="text-align:right">${rp(v)}</td></tr>`).join("");
    const html = `<div style="font-size:13px;border:1px solid #333;padding:18px"><div style="display:flex;justify-content:space-between"><b style="font-size:16px">Warung Bu Made</b><b>SLIP GAJI ${BULAN[9].toUpperCase()} 2026</b></div><div style="margin:10px 0">Nama: ${nama}<br>ID karyawan: K-${String(100 + i)}<br>Jabatan: ${pilih(["Kasir", "Pelayan", "Koki", "Barista", "Gudang"])}</div><div style="display:flex;gap:24px"><table style="flex:1"><tr><th colspan=2 style="text-align:left;border-bottom:1px solid #333">Pendapatan</th></tr><tr><td>Gaji pokok</td><td style="text-align:right">${rp(pokok)}</td></tr>${baris(tunj)}${lembur ? `<tr><td>Lembur</td><td style="text-align:right">${rp(lembur)}</td></tr>` : ""}<tr><td><b>Total</b></td><td style="text-align:right"><b>${rp(bruto)}</b></td></tr></table><table style="flex:1"><tr><th colspan=2 style="text-align:left;border-bottom:1px solid #333">Potongan</th></tr>${baris(potongan)}<tr><td><b>Total</b></td><td style="text-align:right"><b>${rp(totalPot)}</b></td></tr></table></div><div style="margin-top:14px;font-size:15px"><b>Diterima: ${rp(neto)}</b></div><div style="font-size:11px;margin-top:8px">Angka potongan adalah nilai contoh, bukan perhitungan resmi.</div></div>`;
    const path = catat("slip_gaji", `slip-${String(i).padStart(2, "0")}`, "pdf", { nama, periode: "2026-10", gaji_pokok: pokok, tunjangan: tunj, lembur, potongan, bruto, neto }, "potongan nilai contoh");
    await pdf(page, html, path);
  }
}

// ---------- KTP (PNG x 4, bertanda CONTOH, NIK provinsi 99) ----------
async function ktp(page) {
  for (let i = 1; i <= 4; i++) {
    const nama = orang().toUpperCase();
    const lahir = hari(antara(1975, 2004), antara(1, 12), antara(1, 28));
    const pr = i % 2 === 0;
    const nik = `99${String(antara(1, 30)).padStart(2, "0")}${String(antara(1, 20)).padStart(2, "0")}${String(lahir.getUTCDate() + (pr ? 40 : 0)).padStart(2, "0")}${String(lahir.getUTCMonth() + 1).padStart(2, "0")}${String(lahir.getUTCFullYear()).slice(2)}${String(antara(1, 9999)).padStart(4, "0")}`;
    const html = `<div style="position:relative;width:640px;height:400px;background:#cfe3f5;padding:16px;font-size:14px;font-family:Arial"><div style="text-align:center;font-weight:bold">PROVINSI CONTOH<br>KABUPATEN CONTOH</div><div style="margin-top:10px;line-height:1.55">NIK : <b style="font-size:18px">${nik}</b><br>Nama : ${nama}<br>Tempat/Tgl Lahir : DENPASAR, ${String(lahir.getUTCDate()).padStart(2, "0")}-${String(lahir.getUTCMonth() + 1).padStart(2, "0")}-${lahir.getUTCFullYear()}<br>Jenis Kelamin : ${pr ? "PEREMPUAN" : "LAKI-LAKI"}<br>Alamat : JL. CONTOH NO. ${antara(1, 99)}<br>Pekerjaan : KARYAWAN SWASTA<br>Berlaku Hingga : SEUMUR HIDUP</div><div style="position:absolute;right:28px;top:90px;width:120px;height:150px;background:#aac5df;border:1px solid #789"></div><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:110px;font-weight:bold;color:rgba(200,0,0,.28);transform:rotate(-18deg)">CONTOH</div></div>`;
    const path = catat("ktp", `ktp-${String(i).padStart(2, "0")}`, "png", { nik, nama, tanggal_lahir: iso(lahir), jenis_kelamin: pr ? "P" : "L" }, "sintetis: kode provinsi 99 tidak ada, bertanda CONTOH");
    await gambar(page, html, path, 640);
  }
}

// ---------- CV (PDF x 4) ----------
async function cv(page) {
  const posisi = ["Kasir", "Barista", "Admin keuangan", "Staf gudang"];
  for (let i = 1; i <= 4; i++) {
    const nama = orang();
    const pengalaman = Array.from({ length: antara(1, 3) }, () => ({ tempat: pilih(["Kafe Senja Sanur", "Minimarket Sinar", "Hotel Melati Kuta", "Toko Bangunan Jaya"]), peran: pilih(["Kasir", "Pelayan", "Barista", "Admin", "Gudang"]), tahun: `${antara(2018, 2022)}-${antara(2023, 2026)}` }));
    const keahlian = Array.from(new Set(Array.from({ length: 4 }, () => pilih(["Mengoperasikan kasir", "Latte art", "Microsoft Excel", "Stok opname", "Melayani pelanggan", "Bahasa Inggris dasar", "Pembukuan sederhana"]))));
    const html = `<div style="font-size:13px"><h1 style="margin:0">${nama}</h1><div>${nama.split(" ")[0].toLowerCase()}@contoh.id · 0812-0000-${String(antara(1000, 9999))} · Denpasar</div><h3>Melamar sebagai ${posisi[i - 1]}</h3><h3>Pengalaman</h3><ul>${pengalaman.map((p) => `<li>${p.peran}, ${p.tempat} (${p.tahun})</li>`).join("")}</ul><h3>Keahlian</h3><ul>${keahlian.map((k) => `<li>${k}</li>`).join("")}</ul><h3>Pendidikan</h3><p>SMK ${pilih(["Pariwisata", "Akuntansi", "Tata Boga"])} (lulus ${antara(2015, 2024)})</p></div>`;
    const path = catat("cv", `cv-${String(i).padStart(2, "0")}`, "pdf", { nama, posisi: posisi[i - 1], pengalaman, keahlian }, "");
    await pdf(page, html, path);
  }
}

// ---------- surat bernomor (PDF x 4) ----------
async function surat(page) {
  const jenis = [["SK", "Surat Keputusan Mutasi", "HRD"], ["ST", "Surat Tugas", "OPS"], ["SP", "Surat Peringatan Pertama", "HRD"], ["SPH", "Surat Penawaran Harga", "MKT"]];
  for (let i = 1; i <= 4; i++) {
    const [kode, judul, unit] = jenis[i - 1];
    const tanggal = hari(2026, 10, antara(1, 28));
    const nomor = `${String(antara(1, 120)).padStart(3, "0")}/${kode}/${unit}/${ROMAWI[tanggal.getUTCMonth()]}/${tanggal.getUTCFullYear()}`;
    const nama = orang();
    const isi = { SK: `menetapkan pemindahan Saudara ${nama} dari Outlet Sanur ke Outlet Ubud terhitung mulai 1 November 2026.`, ST: `menugaskan Saudara ${nama} untuk mengikuti pelatihan keamanan pangan di Denpasar pada 5 November 2026.`, SP: `memberikan peringatan pertama kepada Saudara ${nama} karena tidak hadir tanpa keterangan selama 3 hari.`, SPH: `menawarkan paket katering 50 porsi seharga ${rp(1750000)} untuk acara Bapak/Ibu.` }[kode];
    const html = `<div style="font-size:14px;line-height:1.6"><div style="text-align:center;border-bottom:3px double #000;padding-bottom:6px"><b style="font-size:18px">WARUNG BU MADE</b><br>Jl. Danau Tamblingan No. 7, Sanur (alamat contoh)</div><p style="text-align:center;margin-top:18px"><b><u>${judul.toUpperCase()}</u></b><br>Nomor: ${nomor}</p><p>Dengan ini pimpinan Warung Bu Made ${isi}</p><p>Demikian surat ini dibuat untuk dipergunakan sebagaimana mestinya.</p><p style="margin-top:30px">Sanur, ${tgl(tanggal)}<br><br><br>${orang()}<br>Pemilik</p></div>`;
    const path = catat("surat", `surat-${String(i).padStart(2, "0")}`, "pdf", { nomor, jenis: judul, tanggal: iso(tanggal), pihak: nama }, "pola nomor urut/kode/unit/bulan romawi/tahun");
    await pdf(page, html, path);
  }
}

// ---------- surat sakit (PNG x 2) ----------
async function suratSakit(page) {
  for (let i = 1; i <= 2; i++) {
    const nama = orang();
    const mulai = hari(2026, 10, antara(1, 26));
    const lama = antara(1, 3);
    const html = `<div style="padding:24px;width:560px;font-family:Georgia,serif;font-size:14px;line-height:1.6"><b>Klinik Pratama Sehat Selalu (contoh)</b><br><small>Jl. Contoh No. 1, Denpasar</small><h3 style="text-align:center">SURAT KETERANGAN SAKIT</h3>Yang bertanda tangan di bawah ini menerangkan bahwa <b>${nama}</b> perlu beristirahat selama <b>${lama} hari</b> mulai ${tgl(mulai)} karena sakit.<br><br>dr. ${orang()}</div>`;
    const path = catat("surat_sakit", `sakit-${String(i).padStart(2, "0")}`, "png", { nama, mulai: iso(mulai), lama_hari: lama }, "");
    await gambar(page, html, path, 600);
  }
}

// ---------- Excel: rekap absen x3 dan data karyawan x2 ----------
async function excel() {
  const karyawan = Array.from({ length: 30 }, (_, i) => ({ id: `K-${String(101 + i)}`, nama: orang(), jabatan: pilih(["Kasir", "Pelayan", "Koki", "Barista", "Gudang", "Admin"]), telepon: `0812-0000-${String(1000 + i)}`, mulai: iso(hari(antara(2019, 2026), antara(1, 12), antara(1, 28))), gaji_pokok: bulatkan(antara(2900000, 6500000), 50000) }));
  for (const [id, jumlah, judulKolom] of [["karyawan-30", 30, ["ID", "Nama Lengkap", "Jabatan", "No. HP", "Tgl Masuk", "Gaji Pokok"]], ["karyawan-8-kolom-acak", 8, ["Nama", "Posisi", "Mulai kerja", "WA", "Gapok", "Kode"]]]) {
    const wb = new ExcelJS.Workbook();
    wb.created = wb.modified = new Date(Date.UTC(2026, 9, 31)); // cap waktu tetap agar berkas sama setiap dibuat
    const ws = wb.addWorksheet("Karyawan");
    ws.addRow(judulKolom);
    const data = karyawan.slice(0, jumlah);
    for (const k of data) ws.addRow(judulKolom[0] === "ID" ? [k.id, k.nama, k.jabatan, k.telepon, k.mulai, k.gaji_pokok] : [k.nama, k.jabatan, k.mulai, k.telepon, k.gaji_pokok, k.id]);
    const path = catat("excel_karyawan", id, "xlsx", { baris: data }, judulKolom[0] === "ID" ? "kolom rapi" : "urutan dan nama kolom tidak baku, untuk uji pemetaan kolom");
    await wb.xlsx.writeFile(path);
  }
  for (let r = 1; r <= 3; r++) {
    const wb = new ExcelJS.Workbook();
    wb.created = wb.modified = new Date(Date.UTC(2026, 9, 31)); // cap waktu tetap agar berkas sama setiap dibuat
    const ws = wb.addWorksheet("Absen Oktober");
    ws.addRow(["Nama", "Tanggal", "Masuk", "Pulang", "Keterangan"]);
    const rekap = [];
    for (const k of karyawan.slice(r * 5, r * 5 + 5)) {
      for (let d = 1; d <= 10; d++) {
        const ket = acak() < 0.08 ? "Izin" : acak() < 0.05 ? "Sakit" : "";
        const masuk = ket ? "" : `0${antara(7, 8)}.${String(antara(0, 59)).padStart(2, "0")}`;
        const pulang = ket ? "" : `${antara(16, 18)}.${String(antara(0, 59)).padStart(2, "0")}`;
        ws.addRow([k.nama, `${d}/10/2026`, masuk, pulang, ket]);
        rekap.push({ nama: k.nama, tanggal: iso(hari(2026, 10, d)), masuk, pulang, keterangan: ket });
      }
    }
    const path = catat("absen", `absen-${String(r).padStart(2, "0")}`, "xlsx", { baris: rekap }, "jam memakai titik (format EYD)");
    await wb.xlsx.writeFile(path);
  }
}

// ---------- mutasi bank CSV x3 ----------
function mutasi() {
  for (let m = 1; m <= 3; m++) {
    let saldo = bulatkan(antara(5000000, 25000000), 1000);
    const baris = [];
    for (let i = 0; i < 15; i++) {
      const d = hari(2026, 10, antara(1, 28));
      const kredit = acak() < 0.55;
      const jumlah = bulatkan(antara(50000, 3500000), 500);
      saldo += kredit ? jumlah : -jumlah;
      const ket = kredit ? pilih([`TRSF E-BANKING CR ${pilih(["WARUNG", "KAFE SENJA", "VILLA ASRI"])} INV/2026/X/${String(antara(7, 42)).padStart(4, "0")}`, "QRIS SETTLEMENT", `SETORAN TUNAI`]) : pilih(["TRSF E-BANKING DB UD SUMBER REJEKI", "BIAYA ADM", "TRSF E-BANKING DB GAJI OKTOBER", "PEMBAYARAN LISTRIK PLN"]);
      baris.push({ tanggal: iso(d), keterangan: ket, cabang: "0000", jumlah, arah: kredit ? "CR" : "DB", saldo });
    }
    baris.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    const csv = ["Tanggal,Keterangan,Cabang,Jumlah,DB/CR,Saldo", ...baris.map((b) => `${b.tanggal.split("-").reverse().join("/")},"${b.keterangan}",${b.cabang},${b.jumlah.toFixed(2)},${b.arah},${b.saldo.toFixed(2)}`)].join("\n");
    const path = catat("mutasi", `mutasi-${String(m).padStart(2, "0")}`, "csv", { baris }, "kolom meniru ekspor umum, bukan spesifikasi resmi bank; saldo pada baris tidak berurutan setelah diurutkan tanggal");
    writeFileSync(path, csv + "\n");
  }
}

rmSync(AKAR, { recursive: true, force: true });
mkdirSync(AKAR, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
await nota(page);
await invoice(page);
await slip(page);
await ktp(page);
await cv(page);
await surat(page);
await suratSakit(page);
await browser.close();
await excel();
mutasi();
writeFileSync(join(AKAR, "indeks.json"), JSON.stringify({ dibuat: "deterministik, seed 20261031", jumlah: indeks.length, berkas: indeks }, null, 1) + "\n");
writeFileSync(join(AKAR, "README.md"), `# Korpus contoh sintetis\n\nDibuat ulang dengan \`node scripts/korpus/buat.mjs\` dari apps/web. Semua isi karangan: nama, nomor, dan angka tidak mewakili orang atau usaha sungguhan. KTP memakai kode provinsi 99 (tidak ada) dan bertanda CONTOH. Potongan pajak/BPJS di slip gaji adalah nilai contoh, bukan perhitungan resmi. Kolom mutasi bank meniru ekspor umum; format resmi bank tidak terdokumentasi publik.\n\nSetiap berkas punya jawaban benar di \`{id}.json\`; daftar lengkap di \`indeks.json\` (${indeks.length} berkas).\n`);
console.log(`korpus: ${indeks.length} berkas di ${AKAR}`);
