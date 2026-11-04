// Pitch deck Nadi (B-04, ditulis ulang D-22 assertion-evidence: judul = kalimat klaim <= 2 baris, isi = bukti visual, tanpa poin). Semua angka dari docs/bisnis (B-01..B-03), docs/quality, docs/research; layar asli dari produksi.
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
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.4, w: 12.1, h: 1.0, fontSize: 30, bold: true, color: C.text1, valign: "top", align: "left", margin: 0 }, text: "" } },
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

// 2. Masalah: bagan harga resmi (docs/bisnis/harga-pesaing.md, 3 Nov 2026) sebagai bukti.
pres.addSection({ title: "Masalah dan solusi" });
s = isi("Usaha 10 orang membayar Rp222.400 sebulan dan tetap mengetik ulang", "Masalah dan solusi");
s.addChart(pres.charts.BAR, [{ name: "Harga per bulan", labels: ["Nadi Usaha", "Gadjian + Kledo, 10 orang", "majoo Starter, per outlet", "Moka POS, per outlet", "Mekari Jurnal Essentials"], values: [149000, 222400, 249000, 299000, 299250] }], {
  x: 0.6, y: 1.75, w: 7.6, h: 4.6, barDir: "bar", chartColors: ["E9A825"], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "\"Rp\"#,##0",
  showTitle: true, title: "Harga resmi per bulan, 3 Nov 2026", titleFontSize: 14, titleColor: "1C1B18", titleFontFace: "+mj-lt", dataLabelFontFace: "+mn-lt", catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt",
  catAxisLabelColor: "5B574F", valAxisLabelColor: "5B574F", valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false, dataLabelColor: "1C1B18", objectName: "Grafik harga pesaing",
});
kartu(s, 8.6, 1.75, 4.1, 4.6, "Ketik ulang");
teks(s, "Nota pemasok, absen, izin sakit di chat, slip gaji, dan tagihan pelanggan tetap dipindahkan dari kertas ke layar oleh pemilik sendiri, karena tiap aplikasi hanya memegang satu bagian.", { x: 8.9, y: 2.05, w: 3.5, h: 4.0, fontSize: 16 });

// 3. Solusi
s = isi("Satu foto nota menjadi usulan jurnal yang tinggal disetujui pemilik", "Masalah dan solusi");
gambar(s, path.join(POTONG, "nota.png"), 0.6, 1.55, 3.9, 1052, 866, "Nota uji yang dibaca Nadi");
gambar(s, path.join(POTONG, "kartu.png"), 4.8, 2.1, 3.9, 1052, 568, "Usulan dari nota");
teks(s, "Usulan menyebut bukti dan keyakinannya. Keputusan otomatis selalu punya alasan tertulis dan bisa dibatalkan.", { x: 9.1, y: 1.6, w: 3.6, h: 3.0, fontSize: 16 });

// 4. Produk sudah berjalan
pres.addSection({ title: "Produk" });
s = isi("Gaji, absen, tagihan, kamera, dan rekrut sudah berjalan di produksi", "Produk");
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
s = isi("Biaya AI dan server Rp6.896 per usaha sebulan berkat aturan pasti", "Produk");
angka(s, 0.6, 1.7, 3.8, "Rp6.896", "biaya AI dan server per usaha berbayar per bulan (model biaya H-01)", "Biaya per usaha");
angka(s, 4.7, 1.7, 3.8, "0 token", "untuk tata letak berkas yang sudah dikenal: aturan baca ditulis sekali lalu dipakai ulang", "Ekstraktor");
angka(s, 8.8, 1.7, 3.9, "94,4%", "keadaan meja benar oleh agen kamera lokal 2 MB, tanpa model (korpus uji)", "Agen Mata");
kartu(s, 0.6, 4.0, 12.1, 2.4, "Tangga kecerdasan");
teks(s, "Tangga kecerdasan: aturan pasti dari teks resmi dulu, lalu ekstraktor terkompilasi, baru model kecil, dan model besar hanya bila keyakinan rendah. Model tidak pernah menyetujui uang atau menghapus data.", { x: 0.9, y: 4.3, w: 11.5, h: 1.9, fontSize: 16 });

// 6. Paket
pres.addSection({ title: "Bisnis" });
s = isi("Paket Usaha Rp149.000 lebih murah dari gabungan gaji dan buku pesaing", "Bisnis");
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
s = isi("Biaya akuisisi kembali 3 sampai 26 kali pada asumsi sekarang", "Bisnis");
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
s = isi("Rp2,1 juta cukup untuk 100 usaha pertama; 10.000 usaha butuh Rp2,4 miliar", "Bisnis");
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
s = isi("Uji internal sudah terukur; data pengguna berbayar belum ada", "Bukti dan langkah");
const bukti = [
  ["100%", "tata letak nota uji terbaca tanpa model (5 dari 5)"],
  ["91,7%", "mutasi bank cocok otomatis ke invoice, 0 salah lunas (korpus)"],
  ["98,8%", "meja terbaca dari 2 contoh per kelas (eksperimen V-JEPA 2, korpus sintetis)"],
];
bukti.forEach(([a, b], i) => angka(s, 0.6 + i * 4.1, 1.7, 3.8, a, b, `Bukti ${i + 1}`));
teks(s, "Belum ada pengguna berbayar, data retensi, atau konversi Gratis ke berbayar. 100 usaha pertama di jalur Hemat akan menghasilkan angka itu.", { x: 0.6, y: 4.3, w: 7.0, h: 2.0, fontSize: 16 });
gambar(s, path.join(LAYAR, "peta.png"), 8.8, 3.5, 2.6, 1264, 1412, "Peta warung langsung");

// 10. Langkah
s = isi("Langkah berikutnya mengukur 100 usaha nyata sebelum mencari dana", "Bukti dan langkah");
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
