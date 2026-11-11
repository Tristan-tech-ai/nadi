import { describe, expect, it } from "vitest";
import { uraiTemplate } from "./template";

describe("uraiTemplate (X-12)", () => {
  it("baris menjadi kerja dengan hari, butir, dan poin", () => {
    const r = uraiTemplate("Brief klien | 0 | Kumpulkan logo; Konfirmasi warna | 1\nDesain materi | 3\n\nLaporan bulanan");
    expect(r.galat).toEqual([]);
    expect(r.isi).toEqual([
      { judul: "Brief klien", hari: 0, butir: ["Kumpulkan logo", "Konfirmasi warna"], poin: 1 },
      { judul: "Desain materi", hari: 3 },
      { judul: "Laporan bulanan" },
    ]);
  });
  it("menolak judul pendek, hari di luar batas, dan isi kosong", () => {
    expect(uraiTemplate("ab | 1").galat).toEqual(["Baris 1: judul 3 sampai 300 huruf."]);
    expect(uraiTemplate("Desain | 400").galat).toEqual(["Baris 1: hari ke- harus 0 sampai 365."]);
    expect(uraiTemplate("Desain | 1 | x | 100").galat).toEqual(["Baris 1: poin 0 sampai 99."]);
    expect(uraiTemplate("  \n ").galat).toEqual(["Tulis minimal satu kerja."]);
  });
});
