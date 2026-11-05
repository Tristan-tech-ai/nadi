import { expect, it } from "vitest";
import { uraiTanya } from "./urai";

// Uji buta M-22: 20 kalimat ditulis SETELAH pengurai jadi. Pengukuran pertama (belum disetel) 15/20, dicatat di
// docs/quality/eval-tanya.md; lima kesalahannya lalu dipakai memperbaiki pola, jadi set ini sekarang regresi, bukan buta lagi.
const HARI = "2026-11-06";
const BUTA: [string, string | null][] = [
  ["dapet berapa duit dari jualan hari ini", "pendapatan"],
  ["omzetnya kemarin gimana", null],
  ["total uang keluar bulan ini", "beban"],
  ["minggu lalu untung atau rugi", "laba"],
  ["sisa uang di rekening", "kas"],
  ["siapa aja yang masih ngutang ke kita", "piutang"],
  ["ada tagihan pelanggan yang udah lewat tempo?", "piutang_lewat"],
  ["kita masih punya kewajiban ke supplier berapa", "hutang"],
  ["berapa nota tagihan yang keluar minggu ini", "invoice_terbit"],
  ["jumlah orang yang kerja di sini", null],
  ["tadi pagi yang absen siapa", "hadir"],
  ["lemburan karyawan bulan oktober", "lembur"],
  ["upah bulan lalu total", "gaji"],
  ["minyak goreng tinggal berapa di gudang", null],
  ["stok telur ayam", "stok"],
  ["pemasukan 30 hari terakhir", "pendapatan"],
  ["profit this year", "laba"],
  ["how many employees", "karyawan"],
  ["berapa yang telat bayar tagihan bulan ini", "piutang_lewat"],
  ["laporan pajak bulan ini", null],
];

it("uji buta 20 kalimat: dicatat, minimal 70% niat benar", () => {
  const hasil = BUTA.map(([q, harap]) => ({ q, harap, dapat: uraiTanya(q, HARI)?.niat ?? null }));
  const benar = hasil.filter((h) => h.dapat === h.harap).length;
  console.log(`BUTA_TANYA benar ${benar}/${BUTA.length}`, JSON.stringify(hasil.filter((h) => h.dapat !== h.harap)));
  expect(benar / BUTA.length).toBeGreaterThanOrEqual(0.7);
});
