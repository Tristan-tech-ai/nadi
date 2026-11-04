// Pitch deck Nadi (B-04). Semua angka dari docs/bisnis (B-01..B-03), docs/quality, docs/research; layar asli dari produksi.
// Jalankan: NODE_PATH=<npm root -g> node docs/bisnis/buat-deck.cjs <jalur apply_theme.js>
const path = require("path");
const pptxgen = require("pptxgenjs");
const { applyTheme } = require(process.argv[2]);

const AKAR = path.join(__dirname, "..", "..");
const LAYAR = path.join(AKAR, "docs", "promo", "film", "assets", "layar");
const POTONG = path.join(AKAR, "docs", "promo", "film", "assets", "potong");
const KELUAR = path.join(__dirname, "pitch-deck.pptx");

const THEME = {
  name: "Nadi kertas kerja",
  headFontFace: "Arial",
  bodyFontFace: "Arial",
  colors: { dk1: "1C1B18", lt1: "F6F2EA", dk2: "5B574F", lt2: "EFE9DD", accent1: "E9A825", accent2: "23704A", accent3: "B4372A", accent4: "2D5B86", accent5: "DDD5C6", accent6: "141311", hlink: "2D5B86", folHlink: "5B574F" },
};

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13,333 x 7,5 in
pres.title = "Nadi: pitch deck";
pres.author = "Nadi";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;

pres.defineSlideMaster({
  title: "Sampul",
  background: { color: "141311" },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.7, y: 1.6, w: 7.2, h: 2.6, fontSize: 44, bold: true, color: "ECE7DD", valign: "top", align: "left", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.7, y: 4.5, w: 7.2, h: 1.6, fontSize: 18, color: "A8A196", valign: "top", align: "left", margin: 0 }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "Isi",
  background: { color: THEME.colors.lt1 },
  margin: [0.5, 0.6, 0.6, 0.6],
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.45, w: 12.1, h: 0.9, fontSize: 34, bold: true, color: C.text1, valign: "top", align: "left", margin: 0 }, text: "" } },
    { text: { text: "nadi", options: { x: 0.6, y: 6.95, w: 2, h: 0.35, fontSize: 12, bold: true, color: C.text2, margin: 0 } } },
  ],
  slideNumber: { x: 12.2, y: 6.95, w: 0.5, h: 0.35, fontSize: 12, color: C.text2, align: "right" },
});

const isi = (judul, bagian) => {
  const s = pres.addSlide({ masterName: "Isi", sectionTitle: bagian });
  s.addText(judul, { placeholder: "title" });
  return s;
};
const teks = (s, t, o) => s.addText(t, { isTextBox: true, margin: 0, fontSize: 16, color: C.text2, valign: "top", paraSpaceAfter: 6, ...o });
const kartu = (s, x, y, w, h, nama) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: C.background2 }, line: { color: "DDD5C6", width: 1 }, objectName: nama });
const angka = (s, x, y, w, besar, kecil, nama) => {
  s.addText(besar, { isTextBox: true, x, y, w, h: 0.9, fontSize: 40, bold: true, color: C.text1, margin: 0, objectName: nama });
  s.addText(kecil, { isTextBox: true, x, y: y + 0.9, w, h: 0.8, fontSize: 14, color: C.text2, margin: 0, valign: "top" });
};
const gambar = (s, berkas, x, y, w, lebarPx, tinggiPx, alt) =>
  s.addImage({ path: berkas, x, y, w, h: (w * tinggiPx) / lebarPx, altText: alt, objectName: alt });
const sorot = (t) => ({ text: t, options: { highlight: "E9A825" } });

// 1. Sampul
pres.addSection({ title: "Pembuka" });
let s = pres.addSlide({ masterName: "Sampul", sectionTitle: "Pembuka" });
s.addText([{ text: "Lempar nota, slip, atau Excel apa saja. " }, { text: "Nadi yang merapikan.", options: { color: "F0B53D" } }], { placeholder: "title" });
s.addText("Sistem kerja untuk usaha kecil Indonesia: nota, absen, izin, gaji, tagihan, dan pembukuan berubah jadi usulan yang tinggal disetujui.", { placeholder: "body" });
gambar(s, path.join(POTONG, "kartu.png"), 8.4, 2.3, 4.3, 1052, 568, "Kartu usulan Nadi");
s.addNotes("Nadi dibangun dan berjalan di produksi: nadi-swart.vercel.app. Semua layar di deck ini tangkapan layar asli dengan data sintetis.");

// 2. Masalah
pres.addSection({ title: "Masalah dan solusi" });
s = isi("Banyak aplikasi, tetap mengetik ulang", "Masalah dan solusi");
teks(s, [
  { text: "Pemilik warung memegang nota pemasok, absen, izin sakit di chat, slip gaji, dan tagihan pelanggan sekaligus.", options: { breakLine: true } },
  { text: "Aplikasi yang ada dijual per bagian: kasir per outlet, gaji per karyawan, akuntansi per paket.", options: { breakLine: true } },
  { text: "Semuanya masih butuh orang yang memindahkan angka dari kertas ke layar." },
], { x: 0.6, y: 1.6, w: 5.8, h: 3.2, fontSize: 18 });
kartu(s, 7.0, 1.6, 5.7, 4.6, "Harga pesaing");
angka(s, 7.4, 1.9, 5.0, "Rp222.400/bln", "gaji Gadjian Standar + akuntansi Kledo Pro untuk 10 orang, harga resmi 3 Nov 2026", "Angka gabungan");
teks(s, [
  { text: "majoo Starter Rp249.000 per outlet per bulan, tiap modul tambahan Rp499.000", options: { bullet: true, breakLine: true } },
  { text: "Moka POS mulai Rp299.000 per outlet per bulan", options: { bullet: true, breakLine: true } },
  { text: "Mekari Jurnal Essentials Rp299.250 per bulan", options: { bullet: true } },
], { x: 7.4, y: 3.8, w: 5.0, h: 2.2, fontSize: 14 });
s.addText("Sumber: halaman harga resmi tiap produk, diakses 3 Nov 2026 (docs/bisnis/harga-pesaing.md).", { isTextBox: true, x: 0.6, y: 6.4, w: 12, h: 0.35, fontSize: 11, color: C.text2, margin: 0 });

// 3. Solusi
s = isi("Foto saja, Nadi yang menyiapkan", "Masalah dan solusi");
gambar(s, path.join(POTONG, "nota.png"), 0.6, 1.55, 3.9, 1052, 866, "Nota uji yang dibaca Nadi");
gambar(s, path.join(POTONG, "kartu.png"), 4.8, 2.1, 3.9, 1052, 568, "Usulan dari nota");
teks(s, [
  { text: "Lempar Saja", options: { bold: true, color: C.text1, breakLine: true } },
  { text: "Foto nota, slip, KTP, CV, surat dokter, Excel, atau mutasi bank.", options: { breakLine: true } },
  { text: "Feed keputusan", options: { bold: true, color: C.text1, breakLine: true } },
  { text: "Setiap usulan menyebut bukti dan keyakinannya. Pemilik menyetujui atau menolak dari HP.", options: { breakLine: true } },
  { text: "Tercatat dan bisa dibatalkan", options: { bold: true, color: C.text1, breakLine: true } },
  { text: "Keputusan otomatis selalu punya alasan tertulis dan jalan membatalkan." },
], { x: 9.1, y: 1.6, w: 3.6, h: 5.0, fontSize: 15 });

// 4. Produk sudah berjalan
pres.addSection({ title: "Produk" });
s = isi("Sudah berjalan di produksi, bukan rancangan", "Produk");
const modul = [
  ["Gaji", "PPh 21 TER, BPJS, lembur PP 35/2021, slip lewat tautan"],
  ["Absen dan izin", "QR berganti 15 detik, cek wajah di perangkat, izin otopilot"],
  ["Tagihan", "Invoice dengan QRIS milik usaha, pengingat H-3 sampai H+14"],
  ["Mata dan Peta", "Kamera membaca meja dan antrean, peta warung langsung"],
  ["Sarapan data", "Tiap pagi hanya temuan yang berdampak rupiah"],
  ["Rekrut", "Lowongan, penjaga bias, wawancara suara, uji kerja"],
];
modul.forEach(([a, b], i) => {
  const x = 0.6 + (i % 2) * 3.55, y = 1.6 + Math.floor(i / 2) * 1.6;
  kartu(s, x, y, 3.35, 1.4, `Modul ${a}`);
  s.addText([{ text: a, options: { bold: true, color: C.text1, fontSize: 16, breakLine: true } }, { text: b, options: { fontSize: 13, color: C.text2 } }], { isTextBox: true, x: x + 0.2, y: y + 0.15, w: 2.95, h: 1.15, margin: 0, valign: "top" });
});
gambar(s, path.join(LAYAR, "sarapan.png"), 7.9, 1.6, 4.8, 1264, 598, "Sarapan data");
gambar(s, path.join(LAYAR, "feed-kartu.png"), 7.9, 4.2, 4.8, 1264, 356, "Kartu Feed");

// 5. Hemat AI
s = isi("AI dipakai seperlunya, jadi biaya per usaha kecil", "Produk");
angka(s, 0.6, 1.7, 3.8, "Rp6.896", "biaya AI dan server per usaha berbayar per bulan (model biaya H-01)", "Biaya per usaha");
angka(s, 4.7, 1.7, 3.8, "0 token", "untuk tata letak berkas yang sudah dikenal: aturan baca ditulis sekali lalu dipakai ulang", "Ekstraktor");
angka(s, 8.8, 1.7, 3.9, "94,4%", "keadaan meja benar oleh agen kamera lokal 2 MB, tanpa model (korpus uji)", "Agen Mata");
kartu(s, 0.6, 4.0, 12.1, 2.4, "Tangga kecerdasan");
teks(s, [
  { text: "Tangga kecerdasan", options: { bold: true, color: C.text1, breakLine: true } },
  { text: "Aturan pasti dulu (pajak, BPJS, lembur dari teks resmi bertanggal), lalu ekstraktor terkompilasi, baru model kecil, dan model besar hanya bila keyakinan rendah.", options: { breakLine: true } },
  { text: "Keluaran model diperlakukan sebagai masukan tak tepercaya: model tidak pernah menyetujui uang atau menghapus data." },
], { x: 0.9, y: 4.25, w: 11.5, h: 2.0, fontSize: 15 });

// 6. Paket
pres.addSection({ title: "Bisnis" });
s = isi("Harga per usaha, naik pelan per orang", "Bisnis");
const kepala = { bold: true, color: C.text1, fill: { color: C.background2 } };
s.addTable([
  [{ text: "Paket", options: kepala }, { text: "Harga dasar/bln", options: kepala }, { text: "Orang termasuk", options: kepala }, { text: "Isi utama", options: kepala }],
  ["Gratis", "Rp0", "5", "Lempar 100 berkas, Feed, absen QR, izin, invoice + QRIS"],
  ["Usaha", "Rp149.000", "15 (+Rp5.000/orang)", "gaji + PPh 21 + BPJS, izin otopilot, jadwal, Sarapan data, Ruang Akuntan"],
  ["Tumbuh", "Rp349.000", "50 (+Rp5.000/orang)", "banyak cabang, Mata + Peta, rekrut, MCP, Kompas Pajak"],
  ["Perusahaan", "mulai Rp1.500.000", "150 (+Rp4.000/orang)", "SSO, audit, dukungan prioritas, kontrak tahunan"],
], { x: 0.6, y: 1.6, w: 12.1, colW: [1.8, 2.2, 2.4, 5.7], fontSize: 14, color: C.text2, border: { type: "solid", color: "DDD5C6", pt: 1 }, rowH: 0.62, valign: "middle", objectName: "Tabel paket" });
teks(s, "Usaha Rp149.000 berada di bawah gabungan gaji + akuntansi untuk 10 orang (Rp222.400). Selama masa uji semua paket gratis dan belum ada tagihan.", { x: 0.6, y: 5.3, w: 12.1, h: 0.9, fontSize: 15 });

// 7. Ekonomi unit
s = isi("Ekonomi unit pada tiga skenario", "Bisnis");
s.addChart(pres.charts.BAR, [{ name: "LTV/CAC", labels: ["Hemat", "Wajar", "Agresif"], values: [25.6, 9.7, 3.1] }], {
  x: 0.6, y: 1.5, w: 6.4, h: 4.8, barDir: "col", chartColors: ["E9A825"], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0\"x\"",
  showTitle: true, title: "LTV dibanding CAC", titleFontSize: 14, titleColor: "1C1B18", titleFontFace: "+mj-lt", dataLabelFontFace: "+mn-lt", catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt",
  catAxisLabelColor: "5B574F", valAxisLabelColor: "5B574F", valGridLine: { color: "DDD5C6", size: 1 }, catGridLine: { style: "none" }, showLegend: false, dataLabelColor: "1C1B18", objectName: "Grafik LTV CAC",
});
s.addTable([
  [{ text: "", options: kepala }, { text: "Hemat", options: kepala }, { text: "Wajar", options: kepala }, { text: "Agresif", options: kepala }],
  ["Margin kotor", "48,9%", "71,9%", "79,6%"],
  ["CAC (asumsi)", "Rp150.000", "Rp350.000", "Rp750.000"],
  ["Churn bulanan (asumsi)", "3%", "5%", "8%"],
  ["Masa balik CAC", "1,3 bln", "2,1 bln", "4,0 bln"],
], { x: 7.3, y: 1.6, w: 5.4, colW: [2.1, 1.1, 1.1, 1.1], fontSize: 13, color: C.text2, border: { type: "solid", color: "DDD5C6", pt: 1 }, rowH: 0.55, objectName: "Tabel ekonomi unit" });
teks(s, "ARPU berbayar Rp236.018. CAC dan churn masih asumsi karena belum ada pelanggan berbayar; angka ini yang paling dulu harus diganti data nyata.", { x: 7.3, y: 4.6, w: 5.4, h: 1.6, fontSize: 14 });

// 8. Modal
s = isi("Modal ditentukan tim dan CAC, bukan server", "Bisnis");
s.addTable([
  [{ text: "", options: kepala }, { text: "Hemat (100 usaha)", options: kepala }, { text: "Wajar (1.000)", options: kepala }, { text: "Agresif (10.000)", options: kepala }],
  ["Bulan sampai target", "18", "24", "30"],
  ["Biaya tetap per bulan", "Rp866.660", "Rp27.055.540", "Rp160.483.260"],
  ["Bulan pertama arus kas positif", "3", "7", "10"],
  ["Modal maksimum terpakai", "Rp1.422.693", "Rp111.780.133", "Rp1.595.504.640"],
  ["Modal dihimpun (x1,5)", "Rp2.134.040", "Rp167.670.199", "Rp2.393.256.960"],
], { x: 0.6, y: 1.6, w: 12.1, colW: [3.7, 2.8, 2.8, 2.8], fontSize: 14, color: C.text2, border: { type: "solid", color: "DDD5C6", pt: 1 }, rowH: 0.58, objectName: "Tabel modal" });
teks(s, "Simulasi 36 bulan, docs/bisnis/model.xlsx. Biaya tetap dari halaman harga resmi Supabase dan Vercel (3 Nov 2026); biaya tim adalah asumsi.", { x: 0.6, y: 5.4, w: 12.1, h: 0.8, fontSize: 14 });

// 9. Bukti
pres.addSection({ title: "Bukti dan langkah" });
s = isi("Bukti yang ada sekarang: uji, bukan pengguna", "Bukti dan langkah");
const bukti = [
  ["100%", "tata letak nota uji terbaca tanpa model (5 dari 5)"],
  ["91,7%", "mutasi bank cocok otomatis ke invoice, 0 salah lunas (korpus)"],
  ["98,8%", "meja terbaca dari 2 contoh per kelas (eksperimen V-JEPA 2, korpus sintetis)"],
];
bukti.forEach(([a, b], i) => angka(s, 0.6 + i * 4.1, 1.7, 3.8, a, b, `Bukti ${i + 1}`));
teks(s, [
  { text: "Yang belum ada", options: { bold: true, color: C.text1, breakLine: true } },
  { text: "Pengguna berbayar, data retensi, dan konversi Gratis ke berbayar. Langkah berikutnya adalah 100 usaha pertama di jalur Hemat untuk menghasilkan angka itu." },
], { x: 0.6, y: 4.3, w: 7.0, h: 2.0, fontSize: 15 });
gambar(s, path.join(LAYAR, "peta.png"), 8.8, 3.5, 2.6, 1264, 1412, "Peta warung langsung");

// 10. Langkah
s = isi("Rencana: data nyata dulu, dana kemudian", "Bukti dan langkah");
const langkah = [
  ["1", "Jalur Hemat", "100 usaha lewat paket Gratis, mitra akuntan, dan lomba; modal sekitar Rp1,4 jt sebelum impas"],
  ["2", "Ukur", "churn, konversi, dan CAC nyata menggantikan asumsi model"],
  ["3", "Pra-seed", "bila retensi terbukti: Rp1,6-2,4 M untuk jalur Agresif (10.000 usaha dalam 30 bulan)"],
];
langkah.forEach(([n, a, b], i) => {
  const y = 1.7 + i * 1.5;
  s.addShape(pres.shapes.OVAL, { x: 0.6, y, w: 0.8, h: 0.8, fill: { color: C.accent1 }, line: { type: "none" }, objectName: `Nomor ${n}` });
  s.addText(n, { isTextBox: true, x: 0.6, y, w: 0.8, h: 0.8, align: "center", valign: "middle", fontSize: 22, bold: true, color: C.text1, margin: 0 });
  s.addText([{ text: a, options: { bold: true, color: C.text1, fontSize: 18, breakLine: true } }, { text: b, options: { fontSize: 15, color: C.text2 } }], { isTextBox: true, x: 1.7, y: y - 0.05, w: 6.6, h: 1.2, margin: 0, valign: "top" });
});
gambar(s, path.join(LAYAR, "tagihan.png"), 9.4, 1.5, 3.0, 944, 1544, "Halaman tagihan dengan QRIS");

// 11. Penutup
s = pres.addSlide({ masterName: "Sampul", sectionTitle: "Bukti dan langkah" });
s.addText([{ text: "Coba usaha contohnya. " }, { text: "Tanpa daftar.", options: { color: "F0B53D" } }], { placeholder: "title" });
s.addText("nadi-swart.vercel.app/demo", { placeholder: "body" });
gambar(s, path.join(LAYAR, "sarapan.png"), 8.4, 2.0, 4.3, 1264, 598, "Sarapan data di usaha contoh");

(async () => {
  await pres.writeFile({ fileName: KELUAR });
  await applyTheme(KELUAR, THEME);
  console.log("ok", KELUAR);
})();
