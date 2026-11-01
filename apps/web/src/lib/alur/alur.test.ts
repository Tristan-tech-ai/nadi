import { describe, expect, it } from "vitest";
import { formatHari, jalurTeks, kalimatPenyimpangan, labelLangkah, ringkasAlur, sisiBerurut, type Alur } from "./alur";

const alur: Alur = {
  jenis: "invoice", hari: 90, kasus: 20, selesai: 18, sesuai: 12, siklus_hari: 13.2, kertas: ["terbit", "lunas"],
  langkah: [{ langkah: "terbit", kasus: 20 }, { langkah: "lunas", kasus: 17 }],
  sisi: [
    { dari: "pengingat_1", ke: "lunas", jumlah: 4, median_hari: 2.2 },
    { dari: "terbit", ke: "pengingat_1", jumlah: 10, median_hari: 11 },
    { dari: "terbit", ke: "lunas", jumlah: 10, median_hari: 7.5 },
  ],
  varian: [{ jalur: ["terbit", "lunas"], jumlah: 10, selesai: true }],
  penyimpangan: [
    { kode: "lunas_terlambat", jumlah: 5, dari: 17 },
    { kode: "terlambat_tanpa_pengingat", jumlah: 0, dari: 6 },
    { kode: "batal_setelah_pengingat", jumlah: 1, dari: 1 },
  ],
};

describe("alur nyata", () => {
  it("memberi label langkah dalam bahasa sehari-hari", () => {
    expect(labelLangkah("terbit")).toBe("Invoice terbit");
    expect(labelLangkah("pengingat_3")).toBe("Pengingat ke-3");
    expect(labelLangkah("ditawari")).toBe("Ditawari kerja");
    expect(labelLangkah("aneh")).toBe("aneh");
  });

  it("menulis jalur dengan panah, tanpa tanda pisah", () => {
    const t = jalurTeks(["masuk", "ditinjau", "ditolak"]);
    expect(t).toBe("Lamaran masuk → Ditinjau → Ditolak");
    expect(t).not.toMatch(new RegExp("[\\u2013\\u2014]"));
  });

  it("format hari memakai koma desimal dan kalimat untuk hari yang sama", () => {
    expect(formatHari(2.2)).toBe("2,2 hari");
    expect(formatHari(14)).toBe("14 hari");
    expect(formatHari(0.3)).toBe("di hari yang sama");
    expect(formatHari(null)).toBe("belum ada");
  });

  it("penyimpangan nol tidak menjadi kalimat; yang ada menyebut angka", () => {
    expect(kalimatPenyimpangan({ kode: "terlambat_tanpa_pengingat", jumlah: 0, dari: 6 })).toBeNull();
    expect(kalimatPenyimpangan({ kode: "lunas_terlambat", jumlah: 5, dari: 17 })).toBe("5 dari 17 invoice lunas lewat jatuh tempo.");
    expect(kalimatPenyimpangan({ kode: "menggantung", jumlah: 2, dari: 4 })).toBe("2 pelamar menunggu lebih dari 14 hari tanpa kabar.");
    expect(kalimatPenyimpangan({ kode: "kode_baru", jumlah: 3, dari: 3 })).toBeNull();
  });

  it("sisi diurutkan mengikuti urutan alur, bukan abjad atau jumlah", () => {
    expect(sisiBerurut(alur).map((s) => `${s.dari}>${s.ke}`)).toEqual(["terbit>pengingat_1", "terbit>lunas", "pengingat_1>lunas"]);
  });

  it("ringkasan menyebut kasus, selesai, dan yang sesuai kertas", () => {
    expect(ringkasAlur(alur)).toBe("20 invoice dalam 90 hari terakhir. 12 dari 18 yang selesai mengikuti alur kertas.");
    expect(ringkasAlur({ ...alur, kasus: 0, selesai: 0, sesuai: 0 })).toBeNull();
  });
});
