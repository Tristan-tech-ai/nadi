// M-10B: berkas unggah payroll CIMB Niaga OCTO Biz (menu File Upload, CSV comma delimited).
// Sumber resmi (dibaca 5 Nov 2026, https://www.cimbniaga.co.id/id/business/layanan/cash-management/file-format-transaction-domestic-bank-list-octo-biz):
// - OCTO-Biz-Format-File-Upload_Payroll-CIMB-Niaga-Account.xlsx dan ..._Payroll-SKN.xlsx: spesifikasi kolom, panjang, tipe.
// - Excel-File-Format-Payroll-CIMB-Niaga-Account.xlsx dan ...-SKN.xlsx: contoh isi (salinannya di fixtures/korpus/transfer/resmi).
// - File-Format-Payroll-Bulk-Payment.pdf: simpan sebagai CSV (Comma delimited), periksa di Notepad, unggah di File Upload.
// Baris 1 = header (rekening sumber, nama, IDR, total, keterangan, jumlah baris, tanggal YYYYMMDD, email), lalu satu baris per
// penerima. Inhouse = rekening CIMB Niaga; SKN = bank lain dengan nama bank dari daftar Domestic Bank SKN & RTGS.
// Nadi hanya menyusun berkas; pemilik sendiri yang mengunggah dan menyetujui transfer di OCTO Biz.
import daftar from "./bank-skn.json";

export type Jalur = "inhouse" | "skn";
export type Sumber = { rekening: string; nama: string; tanggal: string; keterangan?: string; email?: string };
export type Penerima = { rekening: string; nama: string; jumlah: number; keterangan?: string; bank?: string; wni?: boolean; penduduk?: boolean; jenis?: 1 | 2 | 3 };

export const BANK_SKN: string[] = daftar.bank.map((b) => b.nama);

/** Batas panjang per kolom dari spesifikasi resmi. */
const BATAS = { sumberRek: 20, sumberNama: 35, keterangan: 80, email: 250, rekInhouse: 20, namaInhouse: 35, rekSkn: 20, namaSkn: 40, bank: 40, rincian: 500 } as const;

/** Teks aman untuk CSV tanpa tanda kutip: koma, tanda kutip, dan baris baru dibuang; spasi dirapikan. */
const bersih = (x: string, n: number) => x.replace(/[",\r\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);

export function berkasPayroll(jalur: Jalur, sumber: Sumber, penerima: Penerima[]): string {
  const galat = periksaMasukan(jalur, sumber, penerima);
  if (galat.length) throw new Error(galat.join(" "));
  const total = penerima.reduce((s, p) => s + p.jumlah, 0);
  const kepala = [
    sumber.rekening,
    bersih(sumber.nama, BATAS.sumberNama).toUpperCase(),
    "IDR",
    String(total),
    // Spesifikasi: keterangan opsional "harus diisi dengan spasi jika dikosongkan".
    bersih(sumber.keterangan ?? "", BATAS.keterangan) || " ",
    String(penerima.length),
    sumber.tanggal.replaceAll("-", ""),
    bersih(sumber.email ?? "", BATAS.email),
  ];
  const baris = penerima.map((p) => {
    const ket = bersih(p.keterangan ?? "", BATAS.keterangan) || " ";
    if (jalur === "inhouse") return [p.rekening, bersih(p.nama, BATAS.namaInhouse).toUpperCase(), "IDR", String(p.jumlah), ket, "", ""];
    return [p.rekening, bersih(p.nama, BATAS.namaSkn).toUpperCase(), "IDR", String(p.jumlah), ket, p.bank ?? "", p.wni === false ? "N" : "Y", p.penduduk === false ? "N" : "Y", "", String(p.jenis ?? 1), ""];
  });
  return [kepala, ...baris].map((r) => r.join(",")).join("\r\n") + "\r\n";
}

function periksaMasukan(jalur: Jalur, s: Sumber, p: Penerima[]): string[] {
  const g: string[] = [];
  if (!/^\d{6,20}$/.test(s.rekening)) g.push("Rekening sumber harus 6 sampai 20 angka.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.tanggal)) g.push("Tanggal transfer harus YYYY-MM-DD.");
  if (!p.length) g.push("Belum ada penerima.");
  if (p.length > 99_999) g.push("Paling banyak 99.999 baris.");
  p.forEach((x, i) => {
    const n = `Baris ${i + 1} (${x.nama}):`;
    if (!/^\d{6,20}$/.test(x.rekening)) g.push(`${n} rekening harus angka.`);
    if (!Number.isInteger(x.jumlah) || x.jumlah <= 0) g.push(`${n} jumlah harus rupiah bulat lebih dari 0.`);
    if (jalur === "skn" && !BANK_SKN.includes(x.bank ?? "")) g.push(`${n} nama bank tidak ada di daftar SKN CIMB Niaga.`);
  });
  return g;
}

export type HasilPeriksa = { ok: boolean; galat: string[]; peringatan: string[]; total: number; baris: number };

/**
 * Pemeriksa berkas sesuai spesifikasi resmi (dipakai tes dan gerbang): jumlah kolom per jalur, angka, panjang, total header =
 * jumlah baris, jumlah baris = kolom 6 header, tanggal YYYYMMDD, Y/N, jenis penerima 1-3. Nama bank di luar daftar menjadi
 * peringatan, karena contoh resmi CIMB sendiri memakai beberapa nama yang tidak persis sama dengan daftarnya.
 */
export function periksaPayroll(jalur: Jalur, csv: string): HasilPeriksa {
  const galat: string[] = [];
  const peringatan: string[] = [];
  // Akhir baris LF (Linux/Mac) dan CRLF (Excel Windows) sama-sama sah; BOM UTF-8 di awal berkas dibuang.
  const baris = csv.replace(/^﻿/, "").replace(/(\r?\n)+$/, "").split(/\r?\n/).map((l) => l.split(","));
  const [h, ...d] = baris;
  if (!h || h.length < 7 || h.length > 8) return { ok: false, galat: ["Header harus 7 atau 8 kolom."], peringatan, total: 0, baris: 0 };
  if (!/^\d{1,20}$/.test(h[0])) galat.push("Header: rekening sumber harus angka (maks 20).");
  if (!h[1] || h[1].length > BATAS.sumberNama) galat.push("Header: nama 1 sampai 35 karakter.");
  if (h[2] !== "IDR") galat.push("Header: mata uang harus IDR.");
  if (!/^\d{1,15}(\.\d{1,2})?$/.test(h[3])) galat.push("Header: total harus angka (15,2).");
  if (h[4].length > BATAS.keterangan) galat.push("Header: keterangan maks 80.");
  if (!/^\d{1,5}$/.test(h[5])) galat.push("Header: jumlah baris harus angka (maks 5).");
  if (!/^\d{8}$/.test(h[6]) || Number.isNaN(Date.parse(`${h[6].slice(0, 4)}-${h[6].slice(4, 6)}-${h[6].slice(6, 8)}`))) galat.push("Header: tanggal harus YYYYMMDD.");
  const kolom = jalur === "inhouse" ? 7 : 11;
  let total = 0;
  d.forEach((r, i) => {
    const n = `Baris ${i + 2}:`;
    if (r.length !== kolom) { galat.push(`${n} harus ${kolom} kolom, ada ${r.length}.`); return; }
    if (!/^\d{1,20}$/.test(r[0])) galat.push(`${n} rekening harus angka.`);
    const batasNama = jalur === "inhouse" ? BATAS.namaInhouse : BATAS.namaSkn;
    if (!r[1] || r[1].length > batasNama) galat.push(`${n} nama 1 sampai ${batasNama} karakter.`);
    if (r[2] !== "IDR") galat.push(`${n} mata uang harus IDR.`);
    if (!/^\d{1,15}(\.\d{1,2})?$/.test(r[3])) galat.push(`${n} jumlah harus angka (15,2).`);
    else total += Number(r[3]);
    if (r[4].length > BATAS.keterangan) galat.push(`${n} keterangan maks 80.`);
    if (jalur === "inhouse") {
      if (r[5].length > BATAS.email) galat.push(`${n} email maks 250.`);
      if (r[6].length > BATAS.rincian) galat.push(`${n} rincian maks 500.`);
    } else {
      if (!r[5] || r[5].length > BATAS.bank) galat.push(`${n} nama bank wajib (maks 40).`);
      else if (!BANK_SKN.includes(r[5])) peringatan.push(`${n} nama bank "${r[5]}" tidak persis sama dengan daftar SKN.`);
      if (!/^[YN]$/i.test(r[6]) || !/^[YN]$/i.test(r[7])) galat.push(`${n} kewarganegaraan dan kependudukan harus Y atau N.`);
      if (r[8].length > BATAS.email) galat.push(`${n} email maks 250.`);
      if (!/^[123]$/.test(r[9])) galat.push(`${n} jenis penerima 1, 2, atau 3.`);
      if (r[10].length > BATAS.rincian) galat.push(`${n} rincian maks 500.`);
    }
  });
  if (Number(h[5]) !== d.length) galat.push(`Header menyebut ${h[5]} baris, isi ${d.length}.`);
  if (Math.round(Number(h[3]) * 100) !== Math.round(total * 100)) galat.push(`Total header ${h[3]} tidak sama dengan jumlah baris ${total}.`);
  return { ok: galat.length === 0, galat, peringatan, total, baris: d.length };
}
