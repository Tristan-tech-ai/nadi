import { describe, expect, it } from "vitest";
import { teksMasaKerja } from "@/lib/gaji/pesangon";
import { susunSlip } from "@/lib/gaji/susun";
import { labelKomponen, masaKerjaTeks, TEKS_ALAT, teksPeringatan } from "./teks";

// L-08: alat gratis bahasa Inggris. Angka tetap dari rumus aplikasi; yang diuji hanya teks.
describe("teks alat dua bahasa", () => {
  it("setiap peringatan susunSlip tanpa aturan punya padanan bahasa Inggris, dan bahasa Indonesia tidak berubah", () => {
    const tanpaAturan = susunSlip({ pokok: 4_000_000, tunjangan_tetap: 0, ptkp: "", risiko_jkk: "sangat_rendah" }, {}, 12, undefined, [{ tanggal: "2026-12-10", jenis: "hari_kerja", jam: 2 }]);
    const semua = tanpaAturan.peringatan;
    expect(semua.length).toBeGreaterThanOrEqual(5);
    for (const p of semua) {
      expect(teksPeringatan(p, "id")).toBe(p);
      const en = teksPeringatan(p, "en");
      expect(en, p).not.toBe(p);
      expect(en, p).not.toMatch(/\b(belum|dihitung|diperiksa|tidak)\b/);
    }
  });

  it("peringatan lembur di atas batas membawa tanggal dan jam", () => {
    expect(teksPeringatan("Lembur 2026-11-03 (5 jam) melebihi batas PP 35/2021; tidak dihitung.", "en")).toBe("Overtime on 2026-11-03 (5 h) is over the PP 35/2021 limit; it is not counted.");
    expect(teksPeringatan("Pesan baru yang belum dikenal", "en")).toBe("Pesan baru yang belum dikenal");
  });

  it("label komponen slip: Indonesia apa adanya, Inggris dari kode", () => {
    for (const kode of ["pokok", "tunjangan_tetap", "pph21", "bpjs_kes", "jht", "jp", "bpjs_kes_pk", "jht_pk", "jp_pk", "jkk", "jkm", "komisi", "insentif_beban"]) {
      expect(labelKomponen(kode, "Label asli", "id")).toBe("Label asli");
      expect(labelKomponen(kode, "Label asli", "en")).not.toBe("Label asli");
    }
    expect(labelKomponen("lembur", "Lembur 3 jam", "en")).toBe("Overtime 3 h");
  });

  it("masa kerja: Indonesia sama dengan teksMasaKerja aplikasi", () => {
    for (const b of [0, 1, 11, 12, 13, 25, 60]) expect(masaKerjaTeks(b, "id")).toBe(teksMasaKerja(b));
    expect(masaKerjaTeks(0, "en")).toBe("less than 1 month");
    expect(masaKerjaTeks(13, "en")).toBe("1 year 1 month");
    expect(masaKerjaTeks(26, "en")).toBe("2 years 2 months");
  });

  it("kedua kamus punya kunci yang sama", () => {
    expect(Object.keys(TEKS_ALAT.en).sort()).toEqual(Object.keys(TEKS_ALAT.id).sort());
    expect(Object.keys(TEKS_ALAT.en.jenis).sort()).toEqual(Object.keys(TEKS_ALAT.id.jenis).sort());
  });
});
