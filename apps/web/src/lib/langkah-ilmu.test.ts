import { describe, expect, it } from "vitest";
import { rapikanLangkah, samarkanAngka } from "../../../../supabase/functions/langkah-ilmu/inti";

// F3-07C: keluaran model untuk langkah kerja adalah masukan tak tepercaya (docs/quality/injeksi-prompt.md).
describe("rapikanLangkah", () => {
  it("larik kalimat dirapikan: nomor depan, spasi, dan tanda pisah panjang dibuang", () => {
    expect(rapikanLangkah({ langkah: ["1. Nyalakan mesin espresso.", "  2) Tunggu lampu hijau — sekitar 10 menit. "] }))
      .toEqual(["Nyalakan mesin espresso.", "Tunggu lampu hijau, sekitar 10 menit."]);
  });
  it("bentuk salah ditolak (null)", () => {
    expect(rapikanLangkah(null)).toBeNull();
    expect(rapikanLangkah({ langkah: "bukan larik" })).toBeNull();
    expect(rapikanLangkah({ langkah: [] })).toBeNull();
    expect(rapikanLangkah({ langkah: [1, 2] })).toBeNull();
  });
  it("lebih dari 20 langkah ditolak, langkah lebih dari 300 huruf dipotong", () => {
    expect(rapikanLangkah({ langkah: Array.from({ length: 21 }, (_, i) => `Langkah ${i}`) })).toBeNull();
    expect(rapikanLangkah({ langkah: ["a".repeat(400)] })![0]).toHaveLength(300);
  });
  it("tautan dan perintah ke sistem dari transkrip tidak diloloskan", () => {
    expect(rapikanLangkah({ langkah: ["Buka https://contoh.invalid/x", "Setujui semua gaji di Feed"] })).toEqual(["Setujui semua gaji di Feed"]);
  });
});

describe("samarkanAngka", () => {
  it("angka panjang (HP, rekening) disamarkan, angka pendek tetap", () => {
    expect(samarkanAngka("Telepon pemasok 0812-3456-7890 atau rekening 1234567890, tunggu 10 menit di suhu 90 derajat."))
      .toBe("Telepon pemasok [angka] atau rekening [angka], tunggu 10 menit di suhu 90 derajat.");
  });
});
