import { describe, expect, it } from "vitest";
import { hariKerjaSampai, hitungHak, type MasukHak } from "./hak";

const dasar: MasukHak = {
  gaji: { pokok: 4_000_000, tunjangan_tetap: 500_000 }, pola: "6_hari", pembagi: { pola_6_hari: 25, pola_5_hari: 21 },
  tanggalEfektif: "2026-11-14", jatahCuti: 12, cutiTerpakai: 3, alasan: "mundur",
};

describe("serah/hak", () => {
  it("hari kerja dari tanggal 1 sampai tanggal efektif menurut pola", () => {
    // November 2026: tanggal 1 dan 8 hari Minggu, 7 dan 14 hari Sabtu.
    expect(hariKerjaSampai("2026-11-14", "6_hari")).toBe(12);
    expect(hariKerjaSampai("2026-11-14", "5_hari")).toBe(10);
    expect(hariKerjaSampai("2026-11-01", "6_hari")).toBe(0);
  });

  it("upah sehari = (pokok + tunjangan tetap) / 25 pola 6 hari (PP 36/2021 Pasal 17)", () => {
    const h = hitungHak(dasar, {});
    expect(h.upahSebulan).toBe(4_500_000);
    expect(h.upahHarian).toBe(180_000);
    expect(h.hariKerja).toBe(12);
    // gaji akhir prorata 12/25 lewat susunSlip: pokok 1.920.000 + tunjangan 240.000
    expect(h.gajiAkhir?.bruto).toBe(2_160_000);
    expect(h.gajiAkhir?.komponen.find((k) => k.kode === "pokok")?.nilai).toBe(1_920_000);
    expect(h.cuti).toEqual({ jatah: 12, terpakai: 3, sisa: 9, nilai: 1_620_000 });
    expect(h.pesangon).toBe("tidak_berlaku");
  });

  it("pola 5 hari memakai pembagi 21", () => {
    const h = hitungHak({ ...dasar, pola: "5_hari" }, {});
    expect(h.upahHarian).toBe(214_286);
    expect(h.hariKerja).toBe(10);
    expect(h.gajiAkhir?.bruto).toBe(Math.round(4_000_000 * 10 / 21) + Math.round(500_000 * 10 / 21));
  });

  it("gaji akhir tidak lebih dari sebulan penuh", () => {
    const h = hitungHak({ ...dasar, tanggalEfektif: "2026-11-30" }, {});
    expect(h.hariKerja).toBe(25);
    expect(h.gajiAkhir?.bruto).toBe(4_500_000);
  });

  it("jatah cuti belum diatur: tidak dihitung (bukan 0); sisa tidak negatif", () => {
    expect(hitungHak({ ...dasar, jatahCuti: null }, {}).cuti).toBeNull();
    expect(hitungHak({ ...dasar, cutiTerpakai: 20 }, {}).cuti).toEqual({ jatah: 12, terpakai: 20, sisa: 0, nilai: 0 });
  });

  it("tanpa data gaji atau tanpa pembagi terverifikasi: tidak ada angka karangan", () => {
    const tanpaGaji = hitungHak({ ...dasar, gaji: null }, {});
    expect(tanpaGaji.gajiAkhir).toBeNull();
    expect(tanpaGaji.upahHarian).toBeNull();
    expect(tanpaGaji.cuti?.nilai).toBeNull();
    expect(hitungHak({ ...dasar, pembagi: null }, {}).upahHarian).toBeNull();
  });

  it("pesangon: mengundurkan diri tidak berhak (PP 35/2021 Pasal 50), alasan lain belum dihitung", () => {
    expect(hitungHak({ ...dasar, alasan: "kontrak_selesai" }, {}).pesangon).toBe("belum_dihitung");
    expect(hitungHak({ ...dasar, alasan: "lainnya" }, {}).pesangon).toBe("belum_dihitung");
  });
});
