import { describe, expect, it } from "vitest";
import { CONTOH_PROYEK_AGENSI as M } from "./skema";
import { terapkanUbah } from "./ubah";

describe("ubah draf lewat jalur (X-07)", () => {
  it("set, tambah, hapus pada salinan; manifest asli tidak berubah", () => {
    const b = terapkanUbah(M, [
      { op: "set", jalur: "koleksi/0/bidang/0/label", nilai: "Judul proyek" },
      { op: "tambah", jalur: "koleksi/0/bidang", nilai: { kode: "catatan", label: "Catatan", tipe: "teks_panjang" } },
      { op: "hapus", jalur: "laporan" },
    ]) as typeof M;
    expect(b.koleksi[0].bidang[0].label).toBe("Judul proyek");
    expect(b.koleksi[0].bidang.at(-1)?.kode).toBe("catatan");
    expect(b.laporan).toBeUndefined();
    expect(M.koleksi[0].bidang[0].label).toBe("Nama proyek");
  });
  it("menolak prototype pollution, jalur tak ada, indeks di luar, dan terlalu banyak operasi", () => {
    expect(() => terapkanUbah(M, [{ op: "set", jalur: "__proto__/polusi", nilai: 1 }])).toThrow(/jalur tidak sah/);
    expect(() => terapkanUbah(M, [{ op: "set", jalur: "koleksi/0/constructor/prototype", nilai: 1 }])).toThrow(/jalur tidak sah/);
    expect(({} as Record<string, unknown>).polusi).toBeUndefined();
    expect(() => terapkanUbah(M, [{ op: "set", jalur: "tidak/ada/x", nilai: 1 }])).toThrow(/tidak ada/);
    expect(() => terapkanUbah(M, [{ op: "hapus", jalur: "koleksi/9" }])).toThrow(/di luar daftar/);
    expect(() => terapkanUbah(M, Array.from({ length: 101 }, () => ({ op: "hapus", jalur: "laporan" })))).toThrow(/paling banyak/);
    expect(() => terapkanUbah(M, [{ op: "jalankan", jalur: "kode" }])).toThrow(/op harus/);
  });
});
