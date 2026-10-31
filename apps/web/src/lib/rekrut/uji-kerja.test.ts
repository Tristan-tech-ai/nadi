import { describe, expect, it } from "vitest";
import { bacaAngka, buatUji, nilaiUji, TOPI_UJI } from "./uji-kerja";

const angkaRp = (s: string) => [...s.matchAll(/Rp([\d.]+)/g)].map((m) => Number(m[1].replace(/\./g, "")));

describe("buatUji", () => {
  it("minimal 6 templat, mencakup semua topi paket fnb dan toko", () => {
    expect(TOPI_UJI.length).toBeGreaterThanOrEqual(6);
    for (const k of ["kasir", "pelayan", "koki", "barista", "gudang", "pramuniaga", "sales"]) expect(TOPI_UJI).toContain(k);
    expect(buatUji("tukang_sulap", 1)).toBeNull();
  });
  it("benih sama = soal sama; benih beda = angka beda", () => {
    expect(buatUji("kasir", 42)).toEqual(buatUji("kasir", 42));
    expect(buatUji("kasir", 42)).not.toEqual(buatUji("kasir", 43));
  });
  it("jawaban selalu bilangan bulat, positif kecuali selisih gudang, untuk 200 benih", () => {
    for (let b = 1; b <= 200; b++) {
      for (const k of TOPI_UJI) {
        for (const s of buatUji(k, b)!) {
          expect(Number.isInteger(s.jawaban), `${k} ${b} ${s.teks}`).toBe(true);
          if (k !== "gudang") expect(s.jawaban, `${k} ${b}`).toBeGreaterThan(0);
        }
      }
    }
  });
  it("kasir: kembalian = bayar dikurangi jumlah harga x jumlah barang di teks soal", () => {
    for (let b = 1; b <= 50; b++) {
      const [s] = buatUji("kasir", b, 1)!;
      const qty = [...s.teks.matchAll(/(\d+) x /g)].map((m) => Number(m[1]));
      const rp = angkaRp(s.teks);
      const total = qty.reduce((t, q, i) => t + q * rp[i], 0);
      expect(s.jawaban).toBe(rp[3] - total);
    }
  });
  it("gudang: selisih = fisik - (awal + masuk - terjual)", () => {
    for (let b = 1; b <= 50; b++) {
      const [s] = buatUji("gudang", b, 1)!;
      const m = s.teks.match(/awal minggu (\d+) buah, masuk (\d+), terjual (\d+)\. Saat dihitung di rak ada (\d+)\./)!;
      const [awal, masuk, keluar, fisik] = m.slice(1).map(Number);
      expect(s.jawaban).toBe(fisik - (awal + masuk - keluar));
    }
  });
});

describe("bacaAngka dan nilaiUji", () => {
  it("membaca isian rupiah, titik ribuan, minus, dan satuan", () => {
    expect(bacaAngka("Rp12.500")).toBe(12500);
    expect(bacaAngka("12500")).toBe(12500);
    expect(bacaAngka(" -3 ")).toBe(-3);
    expect(bacaAngka("270 ml")).toBe(270);
    expect(bacaAngka("dua belas")).toBeNull();
    expect(bacaAngka("12.50")).toBeNull();
  });
  it("menghitung jawaban benar persis", () => {
    const soal = buatUji("barista", 3)!;
    const h = nilaiUji(soal, [String(soal[0].jawaban), "salah", `${soal[2].jawaban} ml`]);
    expect(h).toEqual({ benar: 2, dari: 3, per: [true, false, true] });
  });
});
