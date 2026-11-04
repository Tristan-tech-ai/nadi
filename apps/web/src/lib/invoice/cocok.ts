// Pencocokan mutasi bank ke invoice terbuka (F4-06, docs/research/cocok-mutasi.md). Tanpa model: tiga aturan yang bisa
// dijelaskan, urut dari yang paling kuat; bila ragu, tidak menebak dan menampilkan kandidat untuk dipilih pemilik.

export type Mutasi = { tanggal: string; keterangan: string; jumlah: number; arah: "CR" | "DB" };
export type InvoiceTerbuka = { id: string; nomor: string; pelanggan: string; total: number; tanggal: string; jatuh_tempo: string };
export type HasilCocok = { indeks: number; invoice?: string; alasan?: string; kandidat: string[] };

/** Toleransi kekurangan bila nomor invoice disebut (biaya transfer yang dipotong); keputusan rancangan, bukan aturan bank. */
export const TOLERANSI_POTONG = 10_000;
const JENDELA_HARI = 90;
const ALASAN = { 1: "nomor invoice disebut", 2: "nama pelanggan dan nominal sama", 3: "nominal sama, satu-satunya tagihan sebesar itu" } as const;

export const huruf = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
const kata = (s: string) => s.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
const tambahHari = (t: string, n: number) => { const d = new Date(`${t}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const TRANSFER = /\b(TRSF|TRF|TRANSFER|BIFAST|BI-FAST|KLIRING|RTGS|SKN)\b/;

export function namaDisebut(pelanggan: string, keterangan: string): boolean {
  const k = kata(keterangan);
  const n = kata(pelanggan).filter((w) => w.length >= 3);
  return n.length > 0 && n.every((w) => k.some((x) => x.startsWith(w)));
}

export function cocokkan(mutasi: readonly Mutasi[], invoice: readonly InvoiceTerbuka[]): HasilCocok[] {
  const klaim: { indeks: number; invoice: string; kuat: 1 | 2 | 3 }[] = [];
  const hasil: HasilCocok[] = mutasi.map((m, indeks) => {
    if (m.arah !== "CR") return { indeks, kandidat: [] };
    const dalam = invoice.filter((v) => v.tanggal <= m.tanggal && m.tanggal <= tambahHari(v.jatuh_tempo, JENDELA_HARI));
    const ket = huruf(m.keterangan);
    const disebut = dalam.filter((v) => ket.includes(huruf(v.nomor)));
    const samaNominal = dalam.filter((v) => v.total === m.jumlah);
    const nomor = disebut.filter((v) => v.total - m.jumlah >= 0 && v.total - m.jumlah <= TOLERANSI_POTONG);
    const nama = samaNominal.filter((v) => namaDisebut(v.pelanggan, m.keterangan));
    const adaNomorLain = invoice.some((v) => ket.includes(huruf(v.nomor)));
    if (nomor.length === 1) klaim.push({ indeks, invoice: nomor[0].id, kuat: 1 });
    else if (nama.length === 1) klaim.push({ indeks, invoice: nama[0].id, kuat: 2 });
    else if (samaNominal.length === 1 && !adaNomorLain && TRANSFER.test(m.keterangan.toUpperCase())) klaim.push({ indeks, invoice: samaNominal[0].id, kuat: 3 });
    const kandidat = [...new Set([...nomor, ...nama, ...samaNominal].map((v) => v.id))];
    return { indeks, kandidat };
  });
  // Satu invoice satu baris: klaim terkuat menang; dua klaim sama kuat untuk invoice yang sama dilepas ke pilihan pemilik.
  const perInvoice = new Map<string, typeof klaim>();
  for (const k of klaim) perInvoice.set(k.invoice, [...(perInvoice.get(k.invoice) ?? []), k]);
  for (const [id, ks] of perInvoice) {
    const kuat = Math.min(...ks.map((k) => k.kuat));
    const menang = ks.filter((k) => k.kuat === kuat);
    if (menang.length === 1) Object.assign(hasil[menang[0].indeks], { invoice: id, alasan: ALASAN[menang[0].kuat] });
  }
  return hasil;
}

// Pengurai CSV mutasi: format bank tidak terdokumentasi publik, jadi beberapa nama kolom umum diterima.
const KOLOM: Record<string, string[]> = {
  tanggal: ["tanggal", "tgl", "date", "tanggal transaksi", "tgl transaksi"],
  keterangan: ["keterangan", "uraian", "deskripsi", "description", "berita", "keterangan transaksi"],
  jumlah: ["jumlah", "nominal", "amount", "mutasi"],
  arah: ["db/cr", "d/k", "jenis", "type", "tipe", "cr/db"],
  debit: ["debit", "debet"],
  kredit: ["kredit", "credit"],
};

function pecah(baris: string, pemisah: string): string[] {
  const hasil: string[] = [];
  let kini = "";
  let kutip = false;
  for (let i = 0; i < baris.length; i++) {
    const c = baris[i];
    if (c === '"') {
      if (kutip && baris[i + 1] === '"') { kini += '"'; i++; } else kutip = !kutip;
    } else if (c === pemisah && !kutip) { hasil.push(kini.trim()); kini = ""; } else kini += c;
  }
  hasil.push(kini.trim());
  return hasil;
}

/** "1.250.000,00" | "1250000.00" | "1,250,000.00" -> 1250000; kosong -> null. */
export function angkaMutasi(s: string): number | null {
  const t = s.replace(/[^\d.,-]/g, "");
  if (!/\d/.test(t)) return null;
  let n: string;
  if (t.includes(".") && t.includes(",")) n = t.lastIndexOf(",") > t.lastIndexOf(".") ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  else if (t.includes(",")) n = /^-?\d{1,3}(,\d{3})+$/.test(t) ? t.replace(/,/g, "") : t.replace(",", ".");
  else n = /^-?\d{1,3}(\.\d{3}){2,}$/.test(t) || /^-?\d{1,3}\.\d{3}$/.test(t) ? t.replace(/\./g, "") : t;
  const v = Math.round(Math.abs(Number(n)));
  return Number.isFinite(v) ? v : null;
}

function tanggalMutasi(s: string): string | null {
  const t = s.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(t);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

export function uraiMutasiCsv(teks: string): { baris: Mutasi[] } | { galat: string } {
  const garis = teks.replace(/^﻿/, "").split(/\r?\n/).filter((g) => g.trim());
  if (garis.length < 2) return { galat: "Berkas kosong atau hanya berisi judul kolom." };
  const pemisah = (garis[0].match(/;/g)?.length ?? 0) > (garis[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const judul = pecah(garis[0], pemisah).map((j) => j.toLowerCase().trim());
  const cari = (k: string) => judul.findIndex((j) => KOLOM[k].includes(j));
  const i = { tanggal: cari("tanggal"), keterangan: cari("keterangan"), jumlah: cari("jumlah"), arah: cari("arah"), debit: cari("debit"), kredit: cari("kredit") };
  if (i.tanggal < 0 || i.keterangan < 0 || (i.jumlah < 0 && (i.debit < 0 || i.kredit < 0))) {
    return { galat: "Kolom tanggal, keterangan, dan jumlah tidak ditemukan. Unggah CSV mutasi dari internet banking." };
  }
  const baris: Mutasi[] = [];
  for (const g of garis.slice(1)) {
    const s = pecah(g, pemisah);
    const tanggal = tanggalMutasi(s[i.tanggal] ?? "");
    if (!tanggal) continue;
    let jumlah: number | null;
    let arah: "CR" | "DB";
    if (i.jumlah >= 0) {
      jumlah = angkaMutasi(s[i.jumlah] ?? "");
      const a = (i.arah >= 0 ? s[i.arah] : "").toUpperCase();
      arah = /^(CR|K|KREDIT|CREDIT|C)$/.test(a) ? "CR" : /^(DB|D|DEBIT|DEBET)$/.test(a) ? "DB" : (s[i.jumlah] ?? "").trim().startsWith("-") ? "DB" : "CR";
    } else {
      const k = angkaMutasi(s[i.kredit] ?? "");
      jumlah = k ?? angkaMutasi(s[i.debit] ?? "");
      arah = k ? "CR" : "DB";
    }
    if (!jumlah) continue;
    baris.push({ tanggal, keterangan: (s[i.keterangan] ?? "").trim(), jumlah, arah });
  }
  return baris.length ? { baris } : { galat: "Tidak ada baris mutasi yang terbaca. Periksa format tanggal dan jumlahnya." };
}
