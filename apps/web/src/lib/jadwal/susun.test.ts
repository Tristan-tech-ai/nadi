import { describe, expect, it } from "vitest";
import { malamKah, periksa, selisihMalam, susunJadwal, type OrangJadwal, type Slot } from "./susun";

// F3-06 penyusun jadwal (docs/research/solver-shift.md): tiga skenario sintetis. Penyusun hanya mengusulkan; batas keras juga dijaga
// simpan_shift di database.
const hariSlot = (topi: string, jam: [string, string][], butuh = 1): Slot[] =>
  Array.from({ length: 7 }, (_, h) => jam.map(([m, s], i) => ({ id: `${topi}-${h}-${i}`, hari: h, mulai: m, selesai: s, topi, butuh }))).flat();
const orang = (n: number, topi: string, awal = 0): OrangJadwal[] => Array.from({ length: n }, (_, i) => ({ id: `${topi}${i + awal}`, topi: [topi] }));

describe("skenario 1: warung kecil (4 kasir, 2 shift 7 jam sehari, pola 6 hari)", () => {
  const slot = hariSlot("kasir", [["07:00", "14:00"], ["14:00", "21:00"]]);
  const o = orang(4, "kasir");
  const h = susunJadwal(slot, o, { pola: "6_hari" });
  it("semua slot terisi tanpa pelanggaran", () => {
    expect(h.kosong).toEqual([]);
    expect(h.penugasan).toHaveLength(14);
    expect(periksa(h, slot, o, { pola: "6_hari" })).toEqual([]);
  });
  it("tiap orang paling banyak 6 hari dan 40 jam, beban rata (3 atau 4 shift)", () => {
    const per = o.map((x) => h.penugasan.filter((p) => p.orang === x.id).length);
    expect(Math.max(...per) - Math.min(...per)).toBeLessThanOrEqual(1);
  });
  it("deterministik", () => {
    expect(susunJadwal(slot, o, { pola: "6_hari" })).toEqual(h);
  });
});

describe("skenario 2: kafe 24 jam 4 minggu (5 barista 3 shift 8 jam, 4 kasir 2 shift, pola 5 hari)", () => {
  const slot = [...hariSlot("barista", [["06:00", "14:00"], ["14:00", "22:00"], ["22:00", "06:00"]]), ...hariSlot("kasir", [["06:00", "14:00"], ["14:00", "22:00"]])];
  const o = [...orang(5, "barista"), ...orang(4, "kasir")];
  it("4 minggu: semua terisi, sah, selisih shift malam barista <= 1", () => {
    const malam: Record<string, number> = {};
    for (let m = 0; m < 4; m++) {
      const h = susunJadwal(slot, o, { pola: "5_hari", malamLalu: malam });
      expect(h.kosong).toEqual([]);
      expect(periksa(h, slot, o, { pola: "5_hari" })).toEqual([]);
      for (const p of h.penugasan) if (malamKah(p)) malam[p.orang] = (malam[p.orang] ?? 0) + 1;
    }
    expect(selisihMalam(malam, o.filter((x) => x.topi.includes("barista")).map((x) => x.id))).toBeLessThanOrEqual(1);
  });
  it("shift lewat tengah malam dikenali sebagai malam", () => {
    expect(malamKah({ mulai: "22:00", selesai: "06:00" })).toBe(true);
    expect(malamKah({ mulai: "06:00", selesai: "14:00" })).toBe(false);
  });
});

describe("skenario 3: kurang orang (3 orang, butuh 4 per hari)", () => {
  // Shift 5 jam: 7 hari x 5 jam = 35 jam masih di bawah 40, jadi yang membatasi memang hari libur (pola 6: paling banyak 6 hari).
  const slot = hariSlot("pelayan", [["08:00", "13:00"]], 4);
  const o = orang(3, "pelayan");
  const h = susunJadwal(slot, o, { pola: "6_hari" });
  it("tidak melanggar batas keras; kekurangan dilaporkan dengan alasan, bukan dipaksa lembur", () => {
    expect(periksa(h, slot, o, { pola: "6_hari" })).toEqual([]);
    expect(h.penugasan).toHaveLength(18);
    expect(h.kosong.reduce((n, k) => n + k.kurang, 0)).toBe(10);
    expect(h.kosong[0].alasan).toMatch(/pelayan/);
  });
  it("merah sengaja: tanpa cek hari libur, orang bekerja 7 hari dan pemeriksa menangkapnya", () => {
    const tanpa = susunJadwal(slot, o, { pola: "6_hari", cekLibur: false });
    expect(periksa(tanpa, slot, o, { pola: "6_hari" }).join(" ")).toMatch(/libur/);
  });
});
