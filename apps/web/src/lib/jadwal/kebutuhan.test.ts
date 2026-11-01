import { describe, expect, it } from "vitest";
import { kunciBaris, ringkasSimpan, usulkan, type DataUsulan } from "./kebutuhan";

// F3-06C: data_usulan_jadwal -> slot susunJadwal -> baris usulan bertanggal, kekurangan dalam kalimat, simpan sebagian.
const K = "topi-kasir";
const data = (o: Partial<DataUsulan> = {}): DataUsulan => ({
  mulai: "2026-11-02",
  pola: "6_hari",
  kebutuhan: Array.from({ length: 7 }, (_, h) => ({ id: `k${h}`, topi: K, topi_nama: "Kasir", hari: h, mulai: "07:00", selesai: "15:00", istirahat: 60, butuh: 1 })),
  orang: [
    { id: "o-budi", nama: "Budi", topi: [K], malam_lalu: 0, hari_terisi: [] },
    { id: "o-sari", nama: "Sari", topi: [K], malam_lalu: 0, hari_terisi: [] },
    { id: "o-tono", nama: "Tono", topi: ["topi-lain"], malam_lalu: 0, hari_terisi: [] },
  ],
  ...o,
});

describe("usulkan", () => {
  it("7 kebutuhan harian jadi 7 baris bertanggal, hanya orang bertopi, tanpa kekurangan", () => {
    const h = usulkan(data());
    expect(h.baris).toHaveLength(7);
    expect(h.kurang).toEqual([]);
    expect(h.baris.map((b) => b.tanggal)).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"]);
    expect(h.baris.every((b) => b.nama !== "Tono" && b.istirahat === 60 && b.topi === K)).toBe(true);
    expect(h.baris[0]).toMatchObject({ mulai: "07:00", selesai: "15:00", topi_nama: "Kasir" });
  });
  it("hari yang sudah terisi tidak dipakai lagi untuk orang itu", () => {
    const d = data();
    d.orang[0].hari_terisi = [2];
    expect(usulkan(d).baris.find((b) => b.hari === 2)?.nama).toBe("Sari");
  });
  it("kekurangan dilaporkan dalam kalimat, tidak dipaksa", () => {
    const d = data({ kebutuhan: [{ id: "k5", topi: K, topi_nama: "Kasir", hari: 5, mulai: "16:00", selesai: "22:00", istirahat: 0, butuh: 3 }] });
    const h = usulkan(d);
    expect(h.baris).toHaveLength(2);
    expect(h.kurang).toEqual(["Sabtu 16.00-22.00: kurang 1 kasir. Semua yang memakai topi ini sudah penuh jam atau hari kerjanya, atau sudah dijadwalkan hari itu."]);
  });
  it("tanpa kebutuhan: tanpa baris", () => {
    expect(usulkan(data({ kebutuhan: [] }))).toEqual({ baris: [], kurang: [] });
  });
});

describe("kunciBaris", () => {
  it("deterministik, berbentuk uuid, berbeda untuk orang atau tanggal lain", () => {
    const a = kunciBaris("o-budi", "2026-11-02", "07:00");
    expect(a).toBe(kunciBaris("o-budi", "2026-11-02", "07:00"));
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toBe(kunciBaris("o-sari", "2026-11-02", "07:00"));
    expect(a).not.toBe(kunciBaris("o-budi", "2026-11-03", "07:00"));
  });
});

describe("ringkasSimpan", () => {
  it("sebagian tersimpan: jumlah dan alasan per baris yang gagal", () => {
    expect(ringkasSimpan([
      { nama: "Budi", tanggal: "2026-11-02", mulai: "07:00", selesai: "15:00" },
      { nama: "Sari", tanggal: "2026-11-03", mulai: "07:00", selesai: "15:00", galat: "Bertabrakan dengan shift lain orang ini." },
    ])).toEqual({ pesan: "1 shift tersimpan.", gagal: ["Sari 3 Nov 2026 07.00-15.00: Bertabrakan dengan shift lain orang ini."] });
  });
  it("semua tersimpan", () => {
    expect(ringkasSimpan([{ nama: "Budi", tanggal: "2026-11-02", mulai: "07:00", selesai: "15:00" }])).toEqual({ pesan: "1 shift tersimpan.", gagal: [] });
  });
});
