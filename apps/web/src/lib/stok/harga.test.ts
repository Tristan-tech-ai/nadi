import { describe, expect, it } from "vitest";
import { hargaUntuk, teksAtribut, uraiAtribut, uraiTingkat } from "./harga";

describe("harga bertingkat", () => {
  it("mengurai isian ramah dan mengurutkan", () => {
    expect(uraiTingkat("50:13.500, 10:14.000")).toEqual([{ min: 10, harga: 14000 }, { min: 50, harga: 13500 }]);
    expect(uraiTingkat("10 = Rp14.000; 24 = 13000")).toEqual([{ min: 10, harga: 14000 }, { min: 24, harga: 13000 }]);
    expect(uraiTingkat("")).toEqual([]);
  });
  it("menolak isian rusak, min 1 atau kurang, dan min ganda", () => {
    expect(uraiTingkat("sepuluh:14000")).toBeNull();
    expect(uraiTingkat("1:14000")).toBeNull();
    expect(uraiTingkat("10:14000, 10:13000")).toBeNull();
    expect(uraiTingkat("10:abc")).toBeNull();
  });
  it("memilih tingkat terbesar yang tercapai", () => {
    const t = [{ min: 10, harga: 14000 }, { min: 50, harga: 13500 }];
    expect(hargaUntuk(15000, t, 9)).toBe(15000);
    expect(hargaUntuk(15000, t, 10)).toBe(14000);
    expect(hargaUntuk(15000, t, 49)).toBe(14000);
    expect(hargaUntuk(15000, t, 120)).toBe(13500);
    expect(hargaUntuk(15000, [], 120)).toBe(15000);
  });
});

describe("atribut varian", () => {
  it("mengurai dan menulis ulang", () => {
    expect(uraiAtribut("Ukuran: 5 kg, warna: merah")).toEqual({ ukuran: "5 kg", warna: "merah" });
    expect(teksAtribut({ ukuran: "5 kg" })).toBe("ukuran 5 kg");
    expect(uraiAtribut("")).toEqual({});
  });
  it("menolak tanpa titik dua atau nilai kosong", () => {
    expect(uraiAtribut("5 kg")).toBeNull();
    expect(uraiAtribut("ukuran:")).toBeNull();
  });
});
