import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { periksaDenah } from "./denah";

// T-01D: zona usulan model untuk kamera baru diperiksa kode tetap sebelum menjadi draf.
const kotak = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const SAH = [
  { nama: "Pintu", jenis: "pintu", poligon: kotak(0, 0.85, 0.3, 1) },
  { nama: "Kasir", jenis: "kasir", poligon: kotak(0.6, 0.6, 0.95, 0.95) },
  { nama: "Rak depan", jenis: "rak", poligon: kotak(0.1, 0.1, 0.5, 0.4) },
];

describe("pengawas denah kamera", () => {
  test("denah wajar lolos", () => expect(periksaDenah(SAH)).toEqual({ lulus: true, alasan: [] }));
  test("tanpa pintu ditolak", () => expect(periksaDenah(SAH.slice(1)).alasan).toContain("denah wajib punya satu zona pintu"));
  test("titik di luar bingkai ditolak", () => {
    expect(periksaDenah([...SAH, { nama: "Luar", jenis: "rak", poligon: kotak(0.9, 0.1, 1.2, 0.3) }]).lulus).toBe(false);
  });
  test("zona bertumpuk ditolak", () => {
    expect(periksaDenah([...SAH, { nama: "Antrean", jenis: "antrean", poligon: kotak(0.55, 0.55, 0.9, 0.9) }]).alasan.some((a) => a.includes("bertumpuk"))).toBe(true);
  });
  test("poligon memotong diri, jenis karangan, nama mirip skrip, dan zona sangat kecil ditolak", () => {
    const h = periksaDenah([
      SAH[0],
      { nama: "Pita", jenis: "rak", poligon: [[0.1, 0.1], [0.4, 0.4], [0.4, 0.1], [0.1, 0.4]] },
      { nama: "VIP", jenis: "vip", poligon: kotak(0.6, 0.1, 0.8, 0.3) },
      { nama: "<script>fetch()</script>", jenis: "rak", poligon: kotak(0.1, 0.5, 0.3, 0.7) },
      { nama: "Titik", jenis: "rak", poligon: kotak(0.5, 0.5, 0.52, 0.52) },
    ]);
    expect(h.lulus).toBe(false);
    expect(h.alasan.join("|")).toMatch(/memotong dirinya/);
    expect(h.alasan.join("|")).toMatch(/jenis tidak dikenal/);
    expect(h.alasan.join("|")).toMatch(/menyerupai skrip/);
    expect(h.alasan.join("|")).toMatch(/terlalu kecil/);
  });
  test("bukan larik atau terlalu banyak zona ditolak", () => {
    expect(periksaDenah({ zona: SAH }).lulus).toBe(false);
    expect(periksaDenah(Array.from({ length: 13 }, () => SAH[0])).lulus).toBe(false);
  });
  test("salinan di Edge Function identik", () => {
    const a = readFileSync(join(__dirname, "denah.ts"), "utf8");
    const b = readFileSync(join(__dirname, "..", "..", "..", "..", "..", "supabase", "functions", "usul-denah", "denah.ts"), "utf8");
    expect(b).toBe(a);
  });
});
