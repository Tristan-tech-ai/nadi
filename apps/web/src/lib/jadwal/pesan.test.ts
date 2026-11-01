import { describe, expect, it } from "vitest";
import { jamDesimal, rapikanPesanBatas, teksPeringatanTukar } from "./pesan";

describe("pesan jadwal", () => {
  it("menit ke jam berdesimal koma", () => {
    expect(jamDesimal(180)).toBe("3");
    expect(jamDesimal(150)).toBe("2,5");
    expect(jamDesimal(100)).toBe("1,7");
  });
  it("pesan batas dari database memakai koma, jam dinding tetap titik", () => {
    expect(rapikanPesanBatas("Lembur paling lama 4 jam sehari (PP 35/2021 Pasal 26). Hari ini jadi 4.5 jam.")).toBe("Lembur paling lama 4 jam sehari (PP 35/2021 Pasal 26). Hari ini jadi 4,5 jam.");
    expect(rapikanPesanBatas("Shift 07.00-15.00 jadi 18.0 jam")).toBe("Shift 07.00-15.00 jadi 18,0 jam");
  });
});

describe("teksPeringatanTukar", () => {
  it("tiga peringatan jadi kalimat untuk staf, lembur berdesimal koma", () => {
    expect(teksPeringatanTukar(["lembur", "lewat_40_minggu", "kurang_libur"], 150)).toEqual([
      "Kamu jadi lembur 2,5 jam hari itu. Lembur hanya bila kamu setuju.",
      "Jam kerjamu minggu itu jadi lebih dari 40 jam.",
      "Hari liburmu minggu itu jadi kurang.",
    ]);
  });
});
