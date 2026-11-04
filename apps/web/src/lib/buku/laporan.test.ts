import { describe, expect, it } from "vitest";
import { angkaIsian, bacaJenis, bacaRentang, barisSaldoAwal, csvLaporan, type Laporan } from "./laporan";

const K = new Proxy({}, { get: (_, p) => String(p) }) as Record<string, string>;

describe("laporan keuangan (M-01)", () => {
  it("rentang bawaan awal tahun sampai hari ini, rusak diganti, terbalik ditukar", () => {
    expect(bacaRentang(undefined, undefined, "2026-11-04")).toEqual({ dari: "2026-01-01", sampai: "2026-11-04" });
    expect(bacaRentang("2026-13-40", "x", "2026-11-04")).toEqual({ dari: "2026-01-01", sampai: "2026-11-04" });
    expect(bacaRentang("2026-06-30", "2026-02-01", "2026-11-04")).toEqual({ dari: "2026-02-01", sampai: "2026-06-30" });
  });
  it("jenis tidak dikenal jadi neraca", () => {
    expect(bacaJenis("arus_kas")).toBe("arus_kas");
    expect(bacaJenis("hapus")).toBe("neraca");
  });
  it("saldo awal: positif di sisi normal, negatif di sisi lawan, nol dibuang", () => {
    expect(barisSaldoAwal([
      { kode: "1-100", saldo_normal: "debit", nilai: 2000000 },
      { kode: "2-100", saldo_normal: "kredit", nilai: 1000000 },
      { kode: "3-200", saldo_normal: "debit", nilai: 0 },
      { kode: "1-200", saldo_normal: "debit", nilai: -5000 },
    ])).toEqual([{ akun: "1-100", debit: 2000000 }, { akun: "2-100", kredit: 1000000 }, { akun: "1-200", kredit: 5000 }]);
  });
  it("angka isian menerima titik ribuan dan Rp, menolak koma desimal", () => {
    expect(angkaIsian("Rp1.250.000")).toBe(1250000);
    expect(angkaIsian("-500.000")).toBe(-500000);
    expect(angkaIsian("")).toBe(0);
    expect(angkaIsian("12,5")).toBeNull();
    expect(angkaIsian("1.25")).toBeNull();
  });
  it("CSV neraca berisi baris akun, laba belum ditutup, dan total yang sama", () => {
    const L = {
      dari: "2025-02-01", sampai: "2025-12-31",
      neraca: { baris: [{ kode: "1-100", nama: "Kas; utama", golongan: "aset", saldo: 8700000 }, { kode: "2-100", nama: "Utang", golongan: "kewajiban", saldo: 3700000 },
        { kode: "3-100", nama: "Modal", golongan: "modal", saldo: 3900000 }], aset: 8700000, kewajiban: 3700000, modal: 3900000, laba_belum_ditutup: 1100000, seimbang: true },
      laba_rugi: { baris: [], pendapatan: 0, beban: 0, laba: 0 },
      arus_kas: { laba: 0, operasi: 0, investasi: 0, pendanaan: 0, kas_awal: 0, kas_akhir: 0, cocok: true },
      neraca_saldo: [],
    } as unknown as Laporan;
    const csv = csvLaporan("neraca", { laporan: L }, K).split("\r\n");
    expect(csv[0]).toBe("kode;akun;golongan;saldo");
    expect(csv[1]).toBe('1-100;"Kas; utama";aset;8700000');
    expect(csv.at(-3)).toBe(";totalAset;;8700000");
    expect(csv.at(-2)).toBe(";totalKewajibanModal;;8700000");
  });
});
