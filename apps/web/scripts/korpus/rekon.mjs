// Korpus rekonsiliasi kas dan bank (M-05). Sintetis dan berbenih: dijalankan ulang menghasilkan berkas yang sama.
// Tiga format CSV rekening yang berbeda (pemisah, nama kolom, tanggal, angka) supaya pengurai dan pencocok diuji bersama.
// Tiap kasus: konteks (invoice terbuka, tagihan pemasok terbuka, jurnal kas tercatat, aturan pengguna), CSV mutasi, dan
// jawaban per baris ({jenis, target} atau null bila memang tidak ada pasangannya).
// Jalankan dari apps/web: node scripts/korpus/rekon.mjs
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
const PELANGGAN = ["Kafe Senja", "Villa Asri", "CV Maju Jaya", "Toko Berkah", "Rina Wulandari", "Hendra Gunawan", "Hotel Melati", "Katering Sari Rasa", "Apotek Sehat", "Bengkel Jaya Motor"];
const PEMASOK = ["UD Sumber Rejeki", "CV Tani Makmur", "Toko Plastik Abadi", "PT Susu Segar", "UD Beras Pulen", "CV Gas Lancar", "Toko Kemasan Rapi"];
const geser = (t, n) => { const d = new Date(`${t}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

const FORMAT = [
  { // A: koma, DB/CR satu kolom, dd/mm/yyyy, 1240000.00
    judul: "Tanggal,Keterangan,Cabang,Jumlah,DB/CR,Saldo",
    baris: (m, saldo) => [m.tanggal.split("-").reverse().join("/"), `"${m.keterangan}"`, "0000", `${m.jumlah}.00`, m.arah, `${saldo}.00`].join(","),
  },
  { // B: titik koma, Debet/Kredit terpisah, dd-mm-yyyy, 1.240.000,00
    judul: "Tanggal;Uraian;Debet;Kredit;Saldo",
    baris: (m, saldo) => { const rp = (n) => `${n.toLocaleString("de-DE")},00`; return [m.tanggal.split("-").reverse().join("-"), m.keterangan, m.arah === "DB" ? rp(m.jumlah) : "", m.arah === "CR" ? rp(m.jumlah) : "", rp(saldo)].join(";"); },
  },
  { // C: koma dengan kutip, Debit/Credit, yyyy-mm-dd, "1,240,000.00"
    judul: "Tgl Transaksi,Deskripsi,Debit,Credit,Saldo",
    baris: (m, saldo) => { const rp = (n) => `"${n.toLocaleString("en-US")}.00"`; return [m.tanggal, `"${m.keterangan}"`, m.arah === "DB" ? rp(m.jumlah) : "", m.arah === "CR" ? rp(m.jumlah) : "", rp(saldo)].join(","); },
  },
];

function kasus(k) {
  const acak = mulberry32(20261104 + k);
  const pilih = (n) => Math.floor(acak() * n);
  const dipakai = new Set();
  const nominal = (min, maks, kelip = 500) => { let v; do v = (min + pilih(maks - min)) * kelip; while (dipakai.has(v)); dipakai.add(v); return v; };
  const awal = "2026-10-01";
  const pelanggan = [...PELANGGAN].sort(() => acak() - 0.5);
  const pemasok = [...PEMASOK].sort(() => acak() - 0.5);
  const invoice = Array.from({ length: 9 }, (_, i) => {
    const tanggal = geser(awal, pilih(8));
    return { id: `r${k}-i${i}`, nomor: `${String(k * 30 + i + 1).padStart(3, "0")}/INV/X/2026`, pelanggan: pelanggan[i], total: nominal(400, 9000), tanggal, jatuh_tempo: geser(tanggal, 14) };
  });
  invoice[8].total = invoice[7].total; // nominal kembar tanpa petunjuk lain: tidak boleh ditebak
  const tagihan = Array.from({ length: 6 }, (_, i) => {
    const tanggal = geser(awal, pilih(6));
    return { id: `r${k}-t${i}`, pemasok: pemasok[i], nomor_pemasok: `${["FK", "INV", "NT"][i % 3]}-${100 + k * 10 + i}`, sisa: nominal(300, 6000), tanggal, jatuh_tempo: geser(tanggal, 30) };
  });
  const jurnal = [
    { id: `r${k}-j0`, tanggal: geser(awal, 3), keterangan: "Setoran modal pemilik", jumlah: nominal(4000, 9000, 1000), arah: "CR" },
    { id: `r${k}-j1`, tanggal: geser(awal, 9), keterangan: "Gaji Oktober Sari", jumlah: nominal(3000, 4500, 1000), arah: "DB" },
    { id: `r${k}-j2`, tanggal: geser(awal, 9), keterangan: "Gaji Oktober Made", jumlah: nominal(3000, 4500, 1000), arah: "DB" },
    { id: `r${k}-j3`, tanggal: geser(awal, 12), keterangan: "Pindah dana dari Kas", jumlah: nominal(1000, 3000, 1000), arah: "CR" },
    { id: `r${k}-j4`, tanggal: geser(awal, 15), keterangan: "Sewa ruko Oktober", jumlah: nominal(2000, 6000, 1000), arah: "DB" },
    { id: `r${k}-j5`, tanggal: geser(awal, 2), keterangan: "Pinjaman dari saudara", jumlah: nominal(1000, 2000, 1000), arah: "CR" }, // tidak muncul di mutasi
  ];
  const aturan = [
    { id: `r${k}-a0`, kata: "PLN", arah: "DB", akun_kode: "6-300" },
    { id: `r${k}-a1`, kata: "BIAYA ADM", arah: "DB", akun_kode: "6-910" },
    { id: `r${k}-a2`, kata: "BUNGA", arah: "CR", akun_kode: "4-900" },
    { id: `r${k}-a3`, kata: "PAJAK BUNGA", arah: "DB", akun_kode: "6-910" },
    { id: `r${k}-a4`, kata: "TELKOM", arah: "DB", akun_kode: "6-300" },
  ];
  const mutasi = [];
  const tambah = (tanggal, keterangan, jumlah, arah, jawab) => mutasi.push({ tanggal, keterangan, jumlah, arah, jawab });
  // Invoice: nomor disebut (3 gaya, satu dengan potongan biaya transfer), nama + nominal, nominal unik, dan kembar (tidak boleh ditebak).
  const gaya = [(n) => `TRSF E-BANKING CR ${n}`, (n) => `BIFAST CR PEMBAYARAN ${n.replaceAll("/", " ")}`, (n) => `TRANSFER DR 0123987654 INV ${n.replaceAll("/", "")}`];
  for (let i = 0; i < 3; i++) tambah(geser(invoice[i].tanggal, 2 + pilih(10)), gaya[i](invoice[i].nomor), invoice[i].total - (i === 2 ? 2500 : 0), "CR", { jenis: "invoice", target: invoice[i].id });
  for (let i = 3; i < 5; i++) tambah(geser(invoice[i].tanggal, 3 + pilih(9)), `TRSF E-BANKING CR ${invoice[i].pelanggan.toUpperCase()}`, invoice[i].total, "CR", { jenis: "invoice", target: invoice[i].id });
  tambah(geser(invoice[5].tanggal, 4), "TRSF E-BANKING CR 0987123456", invoice[5].total, "CR", { jenis: "invoice", target: invoice[5].id });
  tambah(geser(invoice[7].tanggal, 5), "TRSF E-BANKING CR 0811223344", invoice[7].total, "CR", { jenis: "invoice", target: invoice[7].id }); // kembar: wajib ragu
  // Tagihan pemasok: nomor tagihan disebut, nama pemasok + nominal, nominal unik.
  for (let i = 0; i < 2; i++) tambah(geser(tagihan[i].tanggal, 5 + pilih(10)), `TRSF E-BANKING DB BAYAR ${tagihan[i].nomor_pemasok}`, tagihan[i].sisa, "DB", { jenis: "tagihan_beli", target: tagihan[i].id });
  for (let i = 2; i < 4; i++) tambah(geser(tagihan[i].tanggal, 5 + pilih(10)), `TRSF E-BANKING DB ${tagihan[i].pemasok.toUpperCase()}`, tagihan[i].sisa, "DB", { jenis: "tagihan_beli", target: tagihan[i].id });
  tambah(geser(tagihan[4].tanggal, 7), "TRF BIFAST DB 5566778899", tagihan[4].sisa, "DB", { jenis: "tagihan_beli", target: tagihan[4].id });
  // Jurnal yang sudah dicatat tangan: tanggal bank sama atau 1-2 hari kemudian; dua gaji sama tanggal dibedakan nama.
  tambah(geser(jurnal[0].tanggal, 0), "SETORAN TUNAI", jurnal[0].jumlah, "CR", { jenis: "jurnal", target: jurnal[0].id });
  tambah(geser(jurnal[1].tanggal, 1), "TRSF E-BANKING DB SARI GAJI", jurnal[1].jumlah, "DB", { jenis: "jurnal", target: jurnal[1].id });
  tambah(geser(jurnal[2].tanggal, 1), "TRSF E-BANKING DB MADE GAJI", jurnal[2].jumlah, "DB", { jenis: "jurnal", target: jurnal[2].id });
  tambah(geser(jurnal[3].tanggal, 0), "SETORAN TUNAI CABANG", jurnal[3].jumlah, "CR", { jenis: "jurnal", target: jurnal[3].id });
  tambah(geser(jurnal[4].tanggal, 2), "TRSF E-BANKING DB 7788990011", jurnal[4].jumlah, "DB", { jenis: "jurnal", target: jurnal[4].id });
  // Aturan pengguna.
  tambah(geser(awal, 6), "PEMBAYARAN LISTRIK PLN", nominal(400, 1600), "DB", { jenis: "akun", target: "6-300" });
  tambah(geser(awal, 6), "PEMBAYARAN TELKOM INDIHOME", nominal(300, 900), "DB", { jenis: "akun", target: "6-300" });
  tambah(geser(awal, 30), "BIAYA ADM", 6500 + k * 1000, "DB", { jenis: "akun", target: "6-910" });
  tambah(geser(awal, 30), "BUNGA", 1200 + k * 37, "CR", { jenis: "akun", target: "4-900" });
  tambah(geser(awal, 30), "PAJAK BUNGA", 240 + k * 7, "DB", { jenis: "akun", target: "6-910" });
  // Tanpa pasangan: nominal mirip jurnal tetapi jauh tanggalnya, QRIS, tarik tunai, transfer tak dikenal.
  tambah(geser(jurnal[5].tanggal, 14), "SETORAN TUNAI", jurnal[5].jumlah, "CR", null);
  tambah(geser(awal, 11), "QRIS SETTLEMENT", nominal(100, 3000), "CR", null);
  tambah(geser(awal, 13), "TARIK TUNAI ATM", 500000 + k * 50000, "DB", null);
  tambah(geser(awal, 17), "TRSF E-BANKING CR 0855443322", nominal(200, 4000), "CR", null);
  tambah(geser(awal, 18), "TRSF E-BANKING DB 0866554433", nominal(200, 4000), "DB", null);
  mutasi.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  return { invoice, tagihan, jurnal, aturan, mutasi };
}

const keluar = join(process.cwd(), "..", "..", "fixtures", "korpus", "rekon");
mkdirSync(keluar, { recursive: true });
for (const k of [1, 2, 3]) {
  const c = kasus(k);
  const f = FORMAT[k - 1];
  let saldo = 25_000_000;
  const csv = [f.judul, ...c.mutasi.map((m) => { saldo += m.arah === "CR" ? m.jumlah : -m.jumlah; return f.baris(m, saldo); })].join("\n") + "\n";
  writeFileSync(join(keluar, `bank-${"abc"[k - 1]}.csv`), csv);
  writeFileSync(join(keluar, `bank-${"abc"[k - 1]}.json`), JSON.stringify({ invoice: c.invoice, tagihan: c.tagihan, jurnal: c.jurnal, aturan: c.aturan,
    jawaban: c.mutasi.map((m) => m.jawab) }, null, 1) + "\n");
}
console.log("korpus rekon ditulis ke", keluar);
