// Korpus pencocokan mutasi bank ke invoice (F4-06, docs/research/cocok-mutasi.md). Sintetis dan berbenih: dijalankan ulang
// menghasilkan berkas yang sama. Tiap kasus: 14 invoice terbuka, mutasi rekening, dan jawaban (invoice yang dibayar tiap baris
// mutasi atau null). Jalankan dari apps/web: node scripts/korpus/cocok.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const PELANGGAN = ["Kafe Senja", "Villa Asri", "CV Maju Jaya", "Toko Berkah", "Rina Wulandari", "Hendra Gunawan", "UD Sumber Rejeki",
  "Warung Bu Tini", "Hotel Melati", "Katering Sari Rasa", "PT Laut Biru", "Sanggar Tari Lestari", "Apotek Sehat", "Bengkel Jaya Motor"];
const geser = (t, n) => { const d = new Date(`${t}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

function kasus(k) {
  const acak = mulberry32(20261101 + k);
  const pilih = (n) => Math.floor(acak() * n);
  const nama = [...PELANGGAN].sort(() => acak() - 0.5);
  const dipakai = new Set();
  const invoice = Array.from({ length: 14 }, (_, i) => {
    let total;
    do total = (300 + pilih(9700)) * 500; while (dipakai.has(total));
    dipakai.add(total);
    const tanggal = geser("2026-10-01", pilih(10));
    return { id: `k${k}-i${i}`, nomor: `${String(k * 20 + i + 1).padStart(3, "0")}/INV/X/2026`, pelanggan: nama[i], total, tanggal, jatuh_tempo: geser(tanggal, 14) };
  });
  invoice[12].total = invoice[11].total; // nominal kembar: tanpa petunjuk lain tidak boleh ditebak
  const mutasi = [];
  const jawaban = [];
  const bayar = (i, keterangan, jumlah = invoice[i].total, tunda = 1 + pilih(18)) => {
    mutasi.push({ tanggal: geser(invoice[i].tanggal, tunda), keterangan, jumlah, arah: "CR" });
    jawaban.push(invoice[i].id);
  };
  const nomorGaya = [(n) => `TRSF E-BANKING CR ${n}`, (n) => `TRF BIFAST PEMBAYARAN ${n.replaceAll("/", " ")}`, (n) => `TRANSFER DR 0123987654 INV ${n.replaceAll("/", "")}`,
    (n) => `SETORAN KLIRING ${n.toLowerCase()}`, (n) => `TRSF E-BANKING CR BAYAR NO ${n.replaceAll("/", "-")}`];
  for (let i = 0; i < 5; i++) bayar(i, nomorGaya[i](invoice[i].nomor));
  bayar(5, `TRF BIFAST ${invoice[5].nomor}`, invoice[5].total - 2500); // dipotong biaya transfer
  for (let i = 6; i < 9; i++) bayar(i, `TRSF E-BANKING CR ${invoice[i].pelanggan.toUpperCase()}`);
  for (let i = 9; i < 11; i++) bayar(i, `TRSF E-BANKING CR 01234${pilih(90000) + 10000}`);
  bayar(11, "TRSF E-BANKING CR 0987654321"); // kembar dengan invoice 12: harus dipilih pemilik
  // Gangguan: bukan pembayaran invoice.
  const lain = (keterangan, jumlah, arah) => { mutasi.push({ tanggal: geser("2026-10-05", pilih(20)), keterangan, jumlah, arah }); jawaban.push(null); };
  lain("PEMBAYARAN LISTRIK PLN", invoice[3].total, "DB");
  lain("TRSF E-BANKING DB UD SUMBER REJEKI", 559500, "DB");
  lain("BIAYA ADM", 12500, "DB");
  lain("QRIS SETTLEMENT", 1233000 + pilih(100) * 500, "CR");
  lain("SETORAN TUNAI", 2846000, "CR");
  lain(`TRSF E-BANKING CR ${invoice[13].nomor}`, invoice[13].total - 50000, "CR"); // bayar sebagian: belum didukung
  lain(`TRSF E-BANKING CR ${invoice[1].pelanggan.toUpperCase()} DP`, invoice[1].total, "CR"); // invoice 1 sudah dibayar baris lain
  const urut = mutasi.map((m, i) => ({ m, j: jawaban[i] })).sort((a, b) => a.m.tanggal.localeCompare(b.m.tanggal) || a.m.keterangan.localeCompare(b.m.keterangan));
  return { invoice, mutasi: urut.map((x) => x.m), jawaban: urut.map((x) => x.j) };
}

const folder = join(process.cwd(), "..", "..", "fixtures", "korpus", "cocok");
mkdirSync(folder, { recursive: true });
for (let k = 1; k <= 3; k++) writeFileSync(join(folder, `kasus-0${k}.json`), `${JSON.stringify(kasus(k), null, 1)}\n`);
console.log(`3 kasus ditulis ke ${folder}`);
