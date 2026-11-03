import { describe, expect, it } from "vitest";
import { hasilFixture } from "../../../../../fixtures/absen/bangun";
import { bingkaiDari, nilaiWajah, TITIK } from "./wajah";

// Q-20: ekstraksi hasil MediaPipe -> Bingkai diuji dengan fixture landmark, bukan hanya urutan Bingkai sintetis.
describe("bingkaiDari + fixture landmark", () => {
  it("indeks landmark sesuai Face Mesh (hidung 1, pipi 234/454)", () => {
    expect(TITIK).toEqual({ hidung: 1, pipiA: 234, pipiB: 454 });
  });
  it("menoleh ke kiri lulus untuk tantangan kiri dan gagal untuk kanan", () => {
    const b = hasilFixture("menoleh-kiri").map(bingkaiDari);
    expect(b[0].wajah).toBe(1);
    expect(b[0].kedip).toBeCloseTo(0.05);
    expect(b[0].yaw).toBeCloseTo(0);
    expect(b.at(-1)!.yaw).toBeGreaterThan(0.35);
    expect(nilaiWajah(b, "kiri").lulus).toBe(true);
    expect(nilaiWajah(b, "kanan").lulus).toBe(false);
  });
  it("menoleh ke kanan lulus untuk kanan saja", () => {
    const b = hasilFixture("menoleh-kanan").map(bingkaiDari);
    expect(nilaiWajah(b, "kanan").lulus).toBe(true);
    expect(nilaiWajah(b, "kiri").lulus).toBe(false);
  });
  it("foto statis dan dua wajah ditolak", () => {
    expect(nilaiWajah(hasilFixture("foto-statis").map(bingkaiDari), "kiri").alasan).toMatch(/berkedip/);
    expect(nilaiWajah(hasilFixture("dua-wajah").map(bingkaiDari), "kiri").alasan).toMatch(/lebih dari satu wajah/);
  });
});
