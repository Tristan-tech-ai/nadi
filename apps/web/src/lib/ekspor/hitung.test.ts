import { describe, expect, it } from "vitest";
import { angkaDesimal, angkaKurs, formatBerat, formatIdrEn, formatKurs, formatUsd, rupiahDariSen, totalEkspor } from "./hitung";

describe("ekspor/hitung", () => {
  it("angka desimal menerima titik atau koma sebagai pemisah desimal", () => {
    expect(angkaDesimal("7.35")).toBe(7.35);
    expect(angkaDesimal("7,35")).toBe(7.35);
    expect(angkaDesimal("1,224.50")).toBe(1224.5);
    expect(angkaDesimal("1.224,50")).toBe(1224.5);
    expect(angkaDesimal(" 1200 ")).toBe(1200);
    expect(Number.isNaN(angkaDesimal(""))).toBe(true);
    expect(Number.isNaN(angkaDesimal("abc"))).toBe(true);
  });

  it("kurs ditulis gaya Indonesia: titik ribuan, koma desimal", () => {
    expect(angkaKurs("16.287,50")).toBe(16287.5);
    expect(angkaKurs("16287")).toBe(16287);
    expect(angkaKurs("Rp16.287")).toBe(16287);
  });

  it("total sama dengan buat_invoice_ekspor: nilai baris dibulatkan sen, rupiah = USD x kurs dibulatkan", () => {
    const t = totalEkspor([
      { jumlah: 1200, harga: 7.35, bersih: 1200, kotor: 1224.5, koli: 20 },
      { jumlah: 3, harga: 0.35, bersih: 3, kotor: 3.2, koli: 1 },
    ]);
    expect(t.sen).toBe(882105);
    expect(t.bersih).toBe(1203);
    expect(t.kotor).toBe(1227.7);
    expect(t.koli).toBe(21);
    expect(rupiahDariSen(t.sen, 16287.5)).toBe(143672852);
  });

  it("baris tidak lengkap tidak menambah total", () => {
    expect(totalEkspor([{ jumlah: Number.NaN, harga: 5, bersih: 1, kotor: 1, koli: 1 }]).sen).toBe(0);
  });

  it("format dokumen Inggris", () => {
    expect(formatUsd(882105)).toBe("USD 8,821.05");
    expect(formatIdrEn(143672852)).toBe("IDR 143,672,852");
    expect(formatBerat(1227.7)).toBe("1,227.700");
    expect(formatBerat(1227.7, "id")).toBe("1.227,700");
    expect(formatKurs(16287.5)).toBe("Rp16.287,5");
    expect(formatKurs(16287.5, "en")).toBe("Rp16,287.5");
  });
});
