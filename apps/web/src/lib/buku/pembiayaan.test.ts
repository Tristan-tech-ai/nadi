import { describe, expect, it } from "vitest";
import { rentang12Bulan, riwayatInvoice } from "./pembiayaan";

describe("rentang12Bulan", () => {
  it("12 bulan sampai hari ini, melewati pergantian tahun", () => {
    const r = rentang12Bulan("2026-02-10");
    expect(r.dari).toBe("2025-03-01");
    expect(r.sampai).toBe("2026-02-10");
    expect(r.bulan).toHaveLength(12);
    expect(r.bulan[0]).toEqual({ bulan: "2025-03", dari: "2025-03-01", sampai: "2025-03-31" });
    expect(r.bulan[10]).toEqual({ bulan: "2026-01", dari: "2026-01-01", sampai: "2026-01-31" });
    expect(r.bulan[11]).toEqual({ bulan: "2026-02", dari: "2026-02-01", sampai: "2026-02-10" });
  });
  it("Februari kabisat dan Desember", () => {
    const r = rentang12Bulan("2028-12-31");
    expect(r.dari).toBe("2028-01-01");
    expect(r.bulan.find((b) => b.bulan === "2028-02")?.sampai).toBe("2028-02-29");
    expect(r.bulan[11].sampai).toBe("2028-12-31");
  });
});

describe("riwayatInvoice", () => {
  const { bulan } = rentang12Bulan("2026-11-06");
  it("menghitung per bulan terbit, batal diabaikan, rata-rata hari bayar", () => {
    const r = riwayatInvoice([
      { tanggal: "2026-11-01", total: 1_000_000, status: "lunas", lunas_tanggal: "2026-11-05" },
      { tanggal: "2026-11-02", total: 500_000, status: "terbit", lunas_tanggal: null },
      { tanggal: "2026-10-20", total: 250_000, status: "lunas", lunas_tanggal: "2026-11-01" },
      { tanggal: "2026-10-21", total: 999_999, status: "batal", lunas_tanggal: null },
      { tanggal: "2025-10-31", total: 777, status: "lunas", lunas_tanggal: "2025-11-01" },
    ], bulan);
    const nov = r.baris.find((b) => b.bulan === "2026-11")!;
    const okt = r.baris.find((b) => b.bulan === "2026-10")!;
    expect(nov).toEqual({ bulan: "2026-11", terbit: 2, nilai: 1_500_000, lunas: 1, nilaiLunas: 1_000_000 });
    expect(okt).toEqual({ bulan: "2026-10", terbit: 1, nilai: 250_000, lunas: 1, nilaiLunas: 250_000 });
    expect(r.baris).toHaveLength(12);
    // (4 + 12) / 2 = 8; invoice di luar rentang tidak ikut.
    expect(r.rataHariBayar).toBe(8);
    expect(r.tepat).toBe(2);
  });
  it("tanpa invoice lunas: rata-rata kosong", () => {
    expect(riwayatInvoice([], bulan).rataHariBayar).toBeNull();
  });
});
