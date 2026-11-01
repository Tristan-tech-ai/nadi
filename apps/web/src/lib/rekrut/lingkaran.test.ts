import { describe, expect, it } from "vitest";
import { buatUji } from "./uji-kerja";
import { laporanLingkaran, peringkat, spearman, type BarisLingkaran } from "./lingkaran";

describe("peringkat dan spearman", () => {
  it("peringkat rata-rata untuk nilai sama", () => {
    expect(peringkat([10, 20, 20, 30])).toEqual([1, 2.5, 2.5, 4]);
  });
  it("monoton naik tidak linear = 1, terbalik = -1", () => {
    expect(spearman([1, 2, 3, 4, 5], [1, 4, 9, 16, 100])).toBeCloseTo(1, 10);
    expect(spearman([1, 2, 3, 4, 5], [5, 4, 3, 2, 1])).toBeCloseTo(-1, 10);
  });
  it("dengan nilai sama: Pearson atas peringkat", () => {
    // peringkat x [1,2.5,2.5,4], y [1,2,3,4] -> r = 0.9486832981
    expect(spearman([10, 20, 20, 30], [1, 2, 3, 4])).toBeCloseTo(0.9486832981, 8);
  });
  it("tanpa variasi atau kurang dari 3 data = null", () => {
    expect(spearman([5, 5, 5], [1, 2, 3])).toBeNull();
    expect(spearman([1, 2], [1, 2])).toBeNull();
  });
});

const baris = (i: number, skor: number, poin: number, tepat: number | null = null, uji: BarisLingkaran["uji"] = null): BarisLingkaran => ({
  lamaran: `l${i}`, minggu: 12, poinPerMinggu: poin, persenTepat: tepat, wawancara: [{ pertanyaan: "Ceritakan saat melayani tamu yang marah", skor }], uji,
});

describe("laporanLingkaran", () => {
  it("kurang dari 10 orang: belum cukup data, tanpa angka", () => {
    const h = laporanLingkaran(Array.from({ length: 9 }, (_, i) => baris(i, i * 10, i)));
    const s = h.sinyal.find((x) => x.ukuran === "poin")!;
    expect(s).toMatchObject({ n: 9, r: null, tingkat: "belum_cukup" });
    expect(s.kalimat).toMatch(/Belum cukup data: 9 orang/);
  });
  it("12 orang searah: kuat, dengan peringatan sampel kecil; persen tepat hanya dari yang bertenggat", () => {
    const h = laporanLingkaran(Array.from({ length: 12 }, (_, i) => baris(i, i * 5, i * 2, i < 4 ? 50 + i : null)));
    const poin = h.sinyal.find((x) => x.ukuran === "poin")!;
    expect(poin).toMatchObject({ n: 12, tingkat: "awal" });
    expect(poin.r).toBeCloseTo(1, 10);
    expect(poin.kalimat).toMatch(/kuat/);
    expect(poin.kalimat).toMatch(/petunjuk awal/);
    expect(poin.kalimat).toContain("1,00");
    expect(h.sinyal.find((x) => x.ukuran === "tepat")).toMatchObject({ n: 4, tingkat: "belum_cukup" });
  });
  it("30 orang: tanpa peringatan sampel, arah terbalik disebut", () => {
    const h = laporanLingkaran(Array.from({ length: 30 }, (_, i) => baris(i, i, 100 - i)));
    const poin = h.sinyal.find((x) => x.ukuran === "poin")!;
    expect(poin.tingkat).toBe("cukup");
    expect(poin.kalimat).toMatch(/justru/);
    expect(poin.kalimat).not.toMatch(/petunjuk awal/);
  });
  it("uji kerja dinilai ulang dari benih: jawaban benar semua = 100, salah semua = 0", () => {
    const soal = buatUji("kasir", 7)!;
    const benar = { topiKode: "kasir", benih: 7, jawaban: soal.map((s) => String(s.jawaban)) };
    const salah = { topiKode: "kasir", benih: 7, jawaban: soal.map(() => "1") };
    const h = laporanLingkaran(Array.from({ length: 10 }, (_, i) => baris(i, 50, i < 5 ? 1 : 9, null, i < 5 ? salah : benar)));
    const uji = h.sinyal.find((x) => x.sinyal === "Uji kerja hitungan" && x.ukuran === "poin")!;
    expect(uji).toMatchObject({ n: 10, tingkat: "awal" });
    expect(uji.r!).toBeGreaterThan(0.8);
  });
  it("tanpa nilai wawancara: sinyal tidak muncul; jumlah orang dicatat", () => {
    const h = laporanLingkaran([{ ...baris(1, 0, 1), wawancara: [{ pertanyaan: "x", skor: null }] }]);
    expect(h.orang).toBe(1);
    expect(h.sinyal.filter((s) => s.sinyal === "x")).toEqual([]);
  });
});
