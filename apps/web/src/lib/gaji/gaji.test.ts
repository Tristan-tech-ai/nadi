import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { iuranBpjs, upahLembur, type AturanLembur, type TarifBpjs } from "./bpjs-lembur";
import { kategoriTer, pph17, pph21Bulanan, pph21MasaTerakhir, ptkpSetahun, tarifTer, type LapisanP17, type Ptkp, type TabelTer } from "./pph21";

// Aturan dan contoh dari teks resmi (docs/research/gaji.md, gaji-aturan.json): PMK 168/2023, PP 58/2023, PMK 105/2025,
// PMK 101/2016, UU 7/2021, PP 35/2021, Perpres 82/2018 jo. 64/2020, PP 44/2015/46/2015, artikel resmi BPJS TK.
type Contoh = { sumber: string; jenis: string; contoh_resmi: boolean; input: Record<string, unknown>; hasil: Record<string, unknown> };
const A = JSON.parse(readFileSync(join(__dirname, "../../../../../docs/research/gaji-aturan.json"), "utf8")) as {
  ter: TabelTer;
  kategori_ptkp: Record<string, string>;
  ptkp: Ptkp;
  pasal17: LapisanP17;
  lembur: AturanLembur;
  contoh: Contoh[];
};
const aturan = { ptkp: A.ptkp, pasal17: A.pasal17 };
const contoh = (awal: string) => {
  const c = A.contoh.find((x) => x.sumber.startsWith(awal));
  if (!c) throw new Error(`contoh tidak ada: ${awal}`);
  return c;
};

describe("tabel resmi", () => {
  it("TER A/B/C lengkap dan batasnya bersambung", () => {
    expect([A.ter.A.length, A.ter.B.length, A.ter.C.length]).toEqual([44, 40, 41]);
    for (const k of ["A", "B", "C"] as const) {
      const t = A.ter[k];
      for (let i = 1; i < t.length; i++) expect(t[i][0]).toBe(t[i - 1][1]);
      expect(t.at(-1)![1]).toBeNull();
    }
  });
  it("tiga baris TER A dicek manual ke teks Lampiran PP 58/2023", () => {
    expect(tarifTer(30_080_000, A.ter.A)).toBe(13);
    expect(tarifTer(32_400_000, A.ter.A)).toBe(13);
    expect(tarifTer(32_400_001, A.ter.A)).toBe(14);
    expect(tarifTer(50_000_000, A.ter.A)).toBe(18);
    expect(tarifTer(5_400_000, A.ter.A)).toBe(0);
    expect(tarifTer(0, A.ter.A)).toBe(0);
  });
  it("kategori dan PTKP", () => {
    expect(["TK/0", "K/0", "TK/2", "K/1", "K/3"].map((s) => kategoriTer(s, A.kategori_ptkp))).toEqual(["A", "A", "B", "B", "C"]);
    expect(ptkpSetahun("TK/0", A.ptkp)).toBe(54_000_000);
    expect(ptkpSetahun("K/0", A.ptkp)).toBe(58_500_000);
    expect(ptkpSetahun("K/1", A.ptkp)).toBe(63_000_000);
    expect(ptkpSetahun("K/3", A.ptkp)).toBe(67_500_000 + 4_500_000);
    expect(() => kategoriTer("X/9", A.kategori_ptkp)).toThrow();
  });
  it("Pasal 17 berlapis", () => {
    expect(pph17(382_860_000, A.pasal17)).toBe(64_715_000);
    expect(pph17(5_600_000, A.pasal17)).toBe(280_000);
    expect(pph17(0, A.pasal17)).toBe(0);
  });
});

describe("contoh resmi PPh 21", () => {
  it("PMK 168 Tuan A (K/0): TER bulanan dan Desember dengan zakat dan iuran pensiun", () => {
    const h = contoh("PMK 168/2023 Lampiran huruf B Bagian Kedua I.1 Tuan A").hasil as { pph_per_bulan: Record<string, number>; jumlah_jan_nov: number; desember: Record<string, number> };
    for (const [bruto, pph] of Object.entries(h.pph_per_bulan)) expect(pph21Bulanan(Number(bruto), "K/0", A.ter, A.kategori_ptkp).pph).toBe(pph);
    const bulan = [30_080_000, 35_080_000, 30_080_000, 30_080_000, 35_080_000, 30_080_000, 50_080_000, 30_080_000, 30_080_000, 30_080_000, 30_080_000];
    const janNov = bulan.reduce((s, b) => s + pph21Bulanan(b, "K/0", A.ter, A.kategori_ptkp).pph, 0);
    expect(janNov).toBe(h.jumlah_jan_nov);
    const d = pph21MasaTerakhir({ status: "K/0", brutoSetahun: h.desember.bruto_setahun, bulan: 12, iuranPegawai: 1_200_000, zakat: 2_400_000, sudahDipotong: janNov }, aturan);
    expect(d).toMatchObject({ biayaJabatan: 6_000_000, neto: h.desember.neto, ptkp: h.desember.ptkp, pkp: h.desember.pkp, pphSetahun: h.desember.pph_setahun, pphMasaTerakhir: h.desember.pph_desember });
  });
  it("PMK 168 Tuan B: mulai bekerja September, lebih potong di Desember", () => {
    const h = contoh("PMK 168/2023 Lampiran huruf B Bagian Kedua I.2.1.1 Tuan B").hasil as { pph_sep_nov_per_bulan: number; jumlah_sep_nov: number; desember: Record<string, number> };
    expect(pph21Bulanan(15_500_000, "TK/0", A.ter, A.kategori_ptkp)).toMatchObject({ tarif: 7, pph: h.pph_sep_nov_per_bulan });
    const d = pph21MasaTerakhir({ status: "TK/0", brutoSetahun: 62_000_000, bulan: 4, iuranPegawai: 400_000, sudahDipotong: h.jumlah_sep_nov }, aturan);
    expect(d).toMatchObject({ biayaJabatan: h.desember.biaya_jabatan, neto: h.desember.neto, pkp: h.desember.pkp, pphSetahun: h.desember.pph_setahun, pphMasaTerakhir: h.desember.pph_desember });
  });
  it("PMK 168 Tuan C: subjek pajak baru, neto disetahunkan lalu 4/12", () => {
    const h = contoh("PMK 168/2023 Lampiran huruf B Bagian Kedua I.2.1.2 Tuan C").hasil as { desember: Record<string, number> };
    const d = pph21MasaTerakhir({ status: "TK/0", brutoSetahun: 62_000_000, bulan: 4, zakat: 3_100_000, sudahDipotong: 3 * 1_085_000, disetahunkan: true }, aturan);
    expect(d).toMatchObject({ neto: h.desember.neto, pkp: h.desember.pkp, pphSetahun: h.desember.pph_terutang_4_per_12, pphMasaTerakhir: h.desember.pph_desember });
  });
  it("PMK 168 Tuan D dan Tuan E: berhenti bekerja Agustus (biasa dan disetahunkan)", () => {
    const d = contoh("PMK 168/2023 Lampiran huruf B Bagian Kedua I.2.2.1 Tuan D").hasil as { jumlah_jan_jul: number; agustus: Record<string, number> };
    expect(pph21Bulanan(17_500_000, "TK/0", A.ter, A.kategori_ptkp).pph).toBe(1_400_000);
    expect(pph21MasaTerakhir({ status: "TK/0", brutoSetahun: 140_000_000, bulan: 8, iuranPegawai: 800_000, sudahDipotong: d.jumlah_jan_jul }, aturan))
      .toMatchObject({ biayaJabatan: 4_000_000, neto: d.agustus.neto, pkp: d.agustus.pkp, pphSetahun: d.agustus.pph_terutang, pphMasaTerakhir: d.agustus.pph_agustus });
    const e = contoh("PMK 168/2023 Lampiran huruf B Bagian Kedua I.2.2.3 Tuan E").hasil as { agustus: Record<string, number> };
    expect(pph21MasaTerakhir({ status: "TK/0", brutoSetahun: 140_000_000, bulan: 8, sudahDipotong: 7 * 1_400_000, disetahunkan: true }, aturan))
      .toMatchObject({ pkp: e.agustus.pkp, pphSetahun: e.agustus.pph_terutang_8_per_12, pphMasaTerakhir: e.agustus.pph_agustus });
  });
  it("PMK 168 Tuan F (K/3, kategori C), Tuan H (K/2, kategori B), Tuan P (honorarium)", () => {
    expect(pph21Bulanan(30_000_000, "K/3", A.ter, A.kategori_ptkp)).toEqual({ kategori: "C", tarif: 11, pph: 3_300_000 });
    expect(pph21Bulanan(6_800_000, "K/2", A.ter, A.kategori_ptkp)).toEqual({ kategori: "B", tarif: 0.5, pph: 34_000 });
    expect(pph21Bulanan(60_000_000, "TK/0", A.ter, A.kategori_ptkp)).toEqual({ kategori: "A", tarif: 20, pph: 12_000_000 });
  });
  it("PMK 168 Tuan N: penghasilan naik turun tiap bulan", () => {
    const c = contoh("PMK 168/2023 Lampiran huruf B Bagian Kedua IV.2 Tuan N");
    const bruto = c.input.bruto_per_bulan as number[];
    const h = c.hasil as { tarif_per_bulan: number[]; pph_per_bulan: number[]; jumlah: number };
    const hasil = bruto.map((b) => pph21Bulanan(b, "TK/0", A.ter, A.kategori_ptkp));
    expect(hasil.map((x) => x.tarif)).toEqual(h.tarif_per_bulan);
    expect(hasil.map((x) => x.pph)).toEqual(h.pph_per_bulan);
  });
  it("PP 58 Tuan R dan PMK 105/2025 (tahun 2026) Tuan A, B, C", () => {
    const r = contoh("PP 58/2023 Penjelasan Pasal 2 ayat (1) Tuan R").hasil as { desember: Record<string, number> };
    expect(pph21MasaTerakhir({ status: "K/0", brutoSetahun: 120_000_000, bulan: 12, iuranPegawai: 1_200_000, sudahDipotong: 11 * 200_000 }, aturan).pphMasaTerakhir).toBe(r.desember.pph_desember);
    const a = contoh("PMK 105/2025 Lampiran huruf B contoh 1 Tuan A").hasil as { pph_jan_nov_per_bulan: number; desember: Record<string, number> };
    expect(pph21Bulanan(8_000_000, "TK/0", A.ter, A.kategori_ptkp).pph).toBe(a.pph_jan_nov_per_bulan);
    expect(pph21MasaTerakhir({ status: "TK/0", brutoSetahun: 96_000_000, bulan: 12, sudahDipotong: 11 * 120_000 }, aturan).pphMasaTerakhir).toBe(a.desember.pph_desember);
    const bc = contoh("PMK 105/2025 Lampiran huruf B contoh 2 Tuan B");
    const bruto = bc.input.bruto_per_bulan as number[];
    const hb = bc.hasil as { pph_jan_nov: number[]; jumlah_jan_nov: number; desember: Record<string, number> };
    const janNov = bruto.slice(0, 11).map((b) => pph21Bulanan(b, "K/1", A.ter, A.kategori_ptkp).pph);
    expect(janNov).toEqual(hb.pph_jan_nov);
    expect(pph21MasaTerakhir({ status: "K/1", brutoSetahun: 136_000_000, bulan: 12, sudahDipotong: hb.jumlah_jan_nov }, aturan))
      .toMatchObject({ pkp: hb.desember.pkp, pphSetahun: hb.desember.pph_setahun, pphMasaTerakhir: hb.desember.pph_desember });
    const cc = contoh("PMK 105/2025 Lampiran huruf B contoh 3 Tuan C").hasil as { jumlah_mar_nov: number; desember: Record<string, number> };
    const marNov = [9e6, 9e6, 9e6, 9e6, 9e6, 9e6, 9e6, 14e6, 9e6].reduce((s, b) => s + pph21Bulanan(b, "TK/0", A.ter, A.kategori_ptkp).pph, 0);
    expect(marNov).toBe(cc.jumlah_mar_nov);
    expect(pph21MasaTerakhir({ status: "TK/0", brutoSetahun: 95_000_000, bulan: 10, sudahDipotong: marNov }, aturan).pphMasaTerakhir).toBe(cc.desember.pph_desember);
  });
});

describe("BPJS dan lembur", () => {
  const tarif: TarifBpjs = {
    kesehatan: { pemberi_kerja_persen: 4, pekerja_persen: 1, batas_atas_upah: 12_000_000 },
    jht: { pemberi_kerja_persen: 3.7, pekerja_persen: 2 },
    jkm_persen: 0.3,
    jkk_persen: 0.24,
    jp: { pemberi_kerja_persen: 2, pekerja_persen: 1, batas_upah: 10_547_400 },
  };
  it("contoh resmi BPJS Ketenagakerjaan upah Rp6.000.000", () => {
    const h = contoh("BPJS Ketenagakerjaan, artikel 17 Des 2025").hasil as Record<string, number>;
    const i = iuranBpjs(6_000_000, tarif);
    expect([i.jht.pekerja, i.jht.pemberiKerja, i.jkm.pemberiKerja, i.jp!.pekerja, i.jp!.pemberiKerja]).toEqual([
      h.jht_pekerja, h.jht_pemberi_kerja, h.jkm_pemberi_kerja, h.jp_pekerja, h.jp_pemberi_kerja,
    ]);
  });
  it("BPJS Kesehatan dibatasi Rp12.000.000; JP tanpa batas terverifikasi tidak dihitung", () => {
    const h = contoh("Turunan rumus Perpres 82/2018").hasil as Record<string, number>;
    const i = iuranBpjs(15_000_000, tarif);
    expect([i.kesehatan.pemberiKerja, i.kesehatan.pekerja]).toEqual([h.kesehatan_pemberi_kerja, h.kesehatan_pekerja]);
    expect(iuranBpjs(15_000_000, { ...tarif, jp: { ...tarif.jp, batas_upah: null } }).jp).toBeNull();
  });
  it("lembur PP 35/2021: hari kerja, libur pola 6 hari, libur pola 5 hari; jam berlebih ditolak", () => {
    for (const c of A.contoh.filter((x) => x.jenis === "lembur")) {
      const i = c.input as { upah_sebulan: number; jenis_hari: "hari_kerja" | "libur_pola_6_hari" | "libur_pola_5_hari"; jam_lembur: number };
      expect(upahLembur(i.upah_sebulan, i.jenis_hari, i.jam_lembur, A.lembur)).toMatchObject({ upahSejam: c.hasil.upah_sejam, upah: c.hasil.upah_lembur });
    }
    expect(() => upahLembur(3_460_000, "libur_pola_5_hari", 13, A.lembur)).toThrow(/melebihi/);
  });
});
