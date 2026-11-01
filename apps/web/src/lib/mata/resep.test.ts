import { describe, expect, it } from "vitest";
import { akurasi, dalamPoligon, jangkar, langkahStatus, medianAntrean, orangDiZona, statusAwal, type Deteksi, type Zona } from "./resep";

const meja: Zona = { id: "m1", nama: "Meja 1", jenis: "meja", poligon: [[0.1, 0.5], [0.4, 0.5], [0.4, 0.9], [0.1, 0.9]] };
const orang = (xmin: number, ymin: number, xmax: number, ymax: number, score = 0.9, label = "person"): Deteksi =>
  ({ label, score, box: { xmin, ymin, xmax, ymax } });

describe("resep Mata", () => {
  it("titik jangkar orang: tengah mendatar, tiga perempat ke bawah", () => {
    const [x, y] = jangkar({ xmin: 0.2, ymin: 0.2, xmax: 0.4, ymax: 0.6 });
    expect(x).toBeCloseTo(0.3, 10);
    expect(y).toBeCloseTo(0.5, 10);
  });

  it("titik di dalam/luar poligon, termasuk poligon cekung", () => {
    expect(dalamPoligon([0.2, 0.7], meja.poligon)).toBe(true);
    expect(dalamPoligon([0.5, 0.7], meja.poligon)).toBe(false);
    const L: [number, number][] = [[0, 0], [1, 0], [1, 0.4], [0.4, 0.4], [0.4, 1], [0, 1]];
    expect(dalamPoligon([0.2, 0.8], L)).toBe(true);
    expect(dalamPoligon([0.8, 0.8], L)).toBe(false);
  });

  it("menghitung hanya orang berskor cukup yang jangkarnya di zona", () => {
    const d = [orang(0.15, 0.4, 0.35, 0.8), orang(0.6, 0.4, 0.8, 0.8), orang(0.15, 0.4, 0.35, 0.8, 0.3), orang(0.15, 0.4, 0.35, 0.8, 0.9, "chair")];
    expect(orangDiZona(d, meja, 0.5)).toBe(1);
  });

  it("histeresis: butuh 2 cuplikan berturut untuk terisi dan 3 untuk kosong; orang lewat sekali tidak mengubah status", () => {
    let s = statusAwal();
    const urutan = [false, true, false, true, true, true, false, true, false, false, false, false];
    const keluar: string[] = [];
    for (const ada of urutan) {
      const r = langkahStatus(s, ada, { masuk: 2, keluar: 3 });
      s = r.status;
      keluar.push(s.nilai + (r.berubah ? "*" : ""));
    }
    expect(keluar).toEqual(["kosong", "kosong", "kosong", "kosong", "terisi*", "terisi", "terisi", "terisi", "terisi", "terisi", "kosong*", "kosong"]);
  });

  it("antrean memakai median cuplikan terakhir", () => {
    expect(medianAntrean([2, 3, 9, 3, 2])).toBe(3);
    expect(medianAntrean([])).toBe(0);
    expect(medianAntrean([1, 4])).toBe(3);
  });

  it("akurasi = persen cuplikan berstatus sama dengan jawaban", () => {
    expect(akurasi(["kosong", "terisi", "terisi", "kosong"], ["kosong", "terisi", "kosong", "kosong"])).toBe(0.75);
    expect(() => akurasi(["kosong"], [])).toThrow();
  });
});
