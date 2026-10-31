import { describe, expect, it } from "vitest";
import { JENIS_LEMBUR } from "./lembur";
import { jenisCocokPola, kalimatDampak, perluLembarDampak, pesanTersimpan, polaSah, POLA_KERJA } from "./pola-kerja";
import type { JenisHariLembur } from "./bpjs-lembur";

describe("pola kerja (Q-22)", () => {
  it("hanya 6_hari dan 5_hari yang sah", () => {
    expect(polaSah("6_hari")).toBe(true);
    expect(polaSah("5_hari")).toBe(true);
    for (const x of ["7_hari", "", null, undefined, 6]) expect(polaSah(x)).toBe(false);
  });

  it("jenis lembur yang cocok sama dengan aturan catat_lembur", () => {
    const cocok = (p: "6_hari" | "5_hari") => (Object.keys(JENIS_LEMBUR) as JenisHariLembur[]).filter((j) => jenisCocokPola(p, j));
    expect(cocok("6_hari")).toEqual(["hari_kerja", "libur_pola_6_hari", "libur_pola_6_hari_jatuh_hari_kerja_terpendek"]);
    expect(cocok("5_hari")).toEqual(["hari_kerja", "libur_pola_5_hari"]);
  });

  it("lembar dampak hanya bila pola berubah dan ada data", () => {
    expect(perluLembarDampak("6_hari", "5_hari", { lemburLibur: 3, slip: 0 })).toBe(true);
    expect(perluLembarDampak("6_hari", "5_hari", { lemburLibur: 0, slip: 2 })).toBe(true);
    expect(perluLembarDampak("6_hari", "5_hari", { lemburLibur: 0, slip: 0 })).toBe(false);
    expect(perluLembarDampak("5_hari", "5_hari", { lemburLibur: 9, slip: 9 })).toBe(false);
  });

  it("kalimat dampak memakai jumlah nyata dan pola baru", () => {
    expect(kalimatDampak("5_hari", 12)).toEqual([
      "Lembur hari libur yang sudah tercatat (12 baris) tidak berubah.",
      "Mulai sekarang, lembur hari libur dicatat dengan aturan pola 5 hari.",
      "Slip yang sudah disetujui tidak berubah. Slip draf bulan ini dihitung ulang saat kamu menyiapkannya lagi.",
    ]);
    expect(kalimatDampak("6_hari", 0)[0]).toBe("Belum ada lembur hari libur yang tercatat.");
    expect(kalimatDampak("6_hari", 0)[1]).toContain("pola 6 hari");
  });

  it("teks pilihan dan pesan tersimpan sesuai rancangan", () => {
    expect(POLA_KERJA["6_hari"].keterangan).toBe("Libur 1 hari seminggu. Upah sehari = upah sebulan dibagi 25.");
    expect(POLA_KERJA["5_hari"].keterangan).toBe("Libur 2 hari seminggu. Upah sehari = upah sebulan dibagi 21.");
    expect(pesanTersimpan("5_hari")).toBe("Tersimpan. Usahamu bekerja 5 hari seminggu.");
  });
});
