import { describe, expect, it } from "vitest";
import { hasilUlangPutusan } from "./putusan";

describe("putusan: kiriman ulang (Q-16)", () => {
  it("menampilkan keputusan yang tersimpan, bukan yang baru diklik", () => {
    expect(hasilUlangPutusan("ditolak")).toEqual({ status: "ditolak", pesan: "Sudah ditolak sebelumnya. Tidak ada yang dicatat dua kali." });
    expect(hasilUlangPutusan("diterima")).toMatchObject({ status: "diterima" });
  });
  it("status lain (kedaluwarsa, otomatis) menjadi galat yang menyuruh muat ulang", () => {
    expect(hasilUlangPutusan("kedaluwarsa")).toHaveProperty("galat");
    expect(hasilUlangPutusan("otomatis")).toHaveProperty("galat");
  });
});
