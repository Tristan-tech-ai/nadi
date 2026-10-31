import { describe, expect, it } from "vitest";
import { nilaiWajah, tantanganAcak, yawDariLandmark, type Bingkai } from "./wajah";

const b = (kedip: number, yaw: number, wajah = 1): Bingkai => ({ wajah, kedip, yaw });
const ulang = (n: number, x: Bingkai) => Array.from({ length: n }, () => x);

describe("cek wajah hidup", () => {
  it("orang sungguhan: lurus, kedip, lalu menoleh ke kiri sesuai permintaan, lulus", () => {
    const urutan = [...ulang(4, b(0.05, 0.02)), b(0.7, 0.01), b(0.8, 0), b(0.1, 0.03), b(0.05, 0.2), b(0.04, 0.45), b(0.05, 0.6)];
    expect(nilaiWajah(urutan, "kiri")).toEqual({ lulus: true, kedip: true, menoleh: "kiri", alasan: "" });
  });
  it("foto statis: tidak berkedip dan yaw tetap, ditolak", () => {
    expect(nilaiWajah(ulang(30, b(0.08, 0.05)), "kiri")).toMatchObject({ lulus: false, kedip: false });
  });
  it("foto yang diputar-putar: yaw hampir tidak berubah, ditolak walau 'kedip' palsu muncul", () => {
    const urutan = [...ulang(5, b(0.05, 0.03)), b(0.6, 0.05), b(0.05, 0.08), ...ulang(10, b(0.05, 0.1))];
    expect(nilaiWajah(urutan, "kanan")).toMatchObject({ lulus: false, kedip: true });
  });
  it("menoleh ke arah yang salah ditolak", () => {
    const urutan = [...ulang(4, b(0.05, 0)), b(0.7, 0), b(0.05, 0), b(0.05, 0.5), b(0.05, 0.6), b(0.05, 0.5)];
    expect(nilaiWajah(urutan, "kanan").lulus).toBe(false);
    expect(nilaiWajah(urutan, "kiri").lulus).toBe(true);
  });
  it("menoleh harus dimulai dari wajah lurus (bukan sudah miring sejak awal)", () => {
    const urutan = [...ulang(4, b(0.05, 0.6)), b(0.7, 0.6), b(0.05, 0.6), ...ulang(4, b(0.05, 0.6))];
    expect(nilaiWajah(urutan, "kiri").lulus).toBe(false);
  });
  it("dua wajah atau terlalu sedikit bingkai ditolak dengan pesan jelas", () => {
    expect(nilaiWajah([...ulang(10, b(0.05, 0)), b(0.05, 0, 2)], "kiri").alasan).toMatch(/lebih dari satu wajah/);
    expect(nilaiWajah(ulang(3, b(0.05, 0)), "kiri").alasan).toMatch(/belum terlihat jelas/);
  });
  it("yaw dari landmark: hidung di tengah 0, ke kanan gambar positif, terbatas -1..1", () => {
    expect(yawDariLandmark(0.5, 0.3, 0.7)).toBeCloseTo(0);
    expect(yawDariLandmark(0.6, 0.3, 0.7)).toBeCloseTo(0.5);
    expect(yawDariLandmark(0.6, 0.7, 0.3)).toBeCloseTo(0.5);
    expect(yawDariLandmark(0.9, 0.3, 0.7)).toBe(1);
    expect(yawDariLandmark(0.5, 0.5, 0.5)).toBe(0);
  });
  it("tantangan acak memilih kiri atau kanan", () => {
    expect(tantanganAcak(() => 0.1)).toBe("kiri");
    expect(tantanganAcak(() => 0.9)).toBe("kanan");
  });
});
