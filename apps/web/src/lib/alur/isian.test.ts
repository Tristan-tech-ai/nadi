import { describe, expect, it } from "vitest";
import { kunciDari, uraiIsian } from "./isian";

describe("uraiIsian", () => {
  it("membaca teks, angka, tanggal, pilihan, dan tanda wajib", () => {
    expect(uraiIsian("*Alat\n*Tingkat: pilih ringan, parah\nPerkiraan biaya: angka\nTanggal rusak: tanggal")).toEqual({
      bidang: [
        { kunci: "alat", label: "Alat", jenis: "teks", wajib: true },
        { kunci: "tingkat", label: "Tingkat", jenis: "pilihan", wajib: true, pilihan: ["ringan", "parah"] },
        { kunci: "perkiraan_biaya", label: "Perkiraan biaya", jenis: "angka", wajib: false },
        { kunci: "tanggal_rusak", label: "Tanggal rusak", jenis: "tanggal", wajib: false },
      ],
    });
  });
  it("titik dua biasa di label tetap teks", () => {
    expect(uraiIsian("Catatan: tulis singkat")).toEqual({ bidang: [{ kunci: "catatan_tulis_singkat", label: "Catatan: tulis singkat", jenis: "teks", wajib: false }] });
  });
  it("galat: kosong, lebih dari 20, pilihan kurang dari 2", () => {
    expect(uraiIsian("  \n ")).toEqual({ galat: "kosong" });
    expect(uraiIsian(Array.from({ length: 21 }, (_, i) => `Isian ${i}`).join("\n"))).toEqual({ galat: "terlalu_banyak" });
    expect(uraiIsian("Alat\nTingkat: pilih parah")).toEqual({ galat: "pilihan_kurang", baris: 2 });
  });
});

describe("kunciDari", () => {
  it("unik, aman, tidak memakai nama cadangan", () => {
    const d = new Set<string>();
    expect(kunciDari("Alat", d)).toBe("alat");
    expect(kunciDari("ALAT!", d)).toBe("alat_2");
    expect(kunciDari("2 Nomor", d)).toBe("isian_2_nomor");
    expect(kunciDari("Jenis", d)).toBe("jenis_isian");
    expect(kunciDari("Kafé", d)).toBe("kafe");
  });
});
