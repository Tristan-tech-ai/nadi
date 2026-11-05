import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MASUK_BRUTO_PPH, ringkasKomponen, susunSlip, type PetaAturan } from "./susun";

// Aturan seperti di aturan_bertanggal setelah migrasi slip_gaji (nilai dari docs/research/gaji-aturan.json).
const J = JSON.parse(readFileSync(join(__dirname, "../../../../../docs/research/gaji-aturan.json"), "utf8"));
const ok = (nilai: unknown) => ({ nilai, terverifikasi: true });
const ATURAN: PetaAturan = {
  "pph21.ter": ok(J.ter),
  "pph21.kategori": ok(J.kategori_ptkp),
  "pph21.ptkp": ok({ diri: 54000000, kawin: 4500000, per_tanggungan: 4500000, maks_tanggungan: 3 }),
  "pph21.pasal17": ok(J.pasal17),
  "bpjs.kesehatan": ok({ pemberi_kerja: 0.04, pekerja: 0.01, batas_upah: 12000000 }),
  "bpjs.jht": ok({ pemberi_kerja: 0.037, pekerja: 0.02 }),
  "bpjs.jkm.pemberi_kerja": ok(0.003),
  "bpjs.jkk.pemberi_kerja": ok({ sangat_rendah: 0.0024, rendah: 0.0054, sedang: 0.0089, tinggi: 0.0127, sangat_tinggi: 0.0174 }),
  "bpjs.jp": { nilai: { pemberi_kerja: 0.02, pekerja: 0.01, batas_upah: null }, terverifikasi: false },
};
const nilai = (k: { kode: string; nilai: number }[], kode: string) => k.find((x) => x.kode === kode)?.nilai;

describe("susun slip", () => {
  it("gaji Rp8.000.000 TK/0: BPJS sesuai tarif, bruto PPh termasuk iuran usaha yang wajib masuk, PPh 21 dari TER A", () => {
    const { komponen, peringatan } = susunSlip({ pokok: 8_000_000, ptkp: "TK/0" }, ATURAN, 10);
    expect(nilai(komponen, "bpjs_kes_pk")).toBe(320_000);
    expect(nilai(komponen, "bpjs_kes")).toBe(80_000);
    expect(nilai(komponen, "jht")).toBe(160_000);
    expect(nilai(komponen, "jht_pk")).toBe(296_000);
    expect(nilai(komponen, "jkk")).toBe(19_200);
    expect(nilai(komponen, "jkm")).toBe(24_000);
    // Bruto PPh = 8.000.000 + 320.000 + 19.200 + 24.000 = 8.363.200 -> TER A 1,5% (7.500.000 s.d. 8.550.000) = 125.448.
    expect(nilai(komponen, "pph21")).toBe(125_448);
    expect(nilai(komponen, "jp")).toBeUndefined();
    expect(peringatan).toEqual(["Batas upah Jaminan Pensiun tahun ini belum terverifikasi; iuran JP belum dihitung. Isi manual bila usahamu wajib ikut JP."]);
  });
  it("aturan belum terverifikasi tidak dipakai: komponen tidak dihitung, ada peringatan", () => {
    const { komponen, peringatan } = susunSlip({ pokok: 5_000_000, ptkp: "K/1" }, { ...ATURAN, "bpjs.kesehatan": { nilai: { pemberi_kerja: 0.04, pekerja: 0.01, batas_upah: 12000000 }, terverifikasi: false } }, 10);
    expect(nilai(komponen, "bpjs_kes")).toBeUndefined();
    expect(peringatan.some((p) => p.startsWith("Tarif BPJS Kesehatan belum diperiksa"))).toBe(true);
  });
  it("tanpa status PTKP: PPh 21 nol dengan peringatan, bukan ditebak", () => {
    const { komponen, peringatan } = susunSlip({ pokok: 20_000_000 }, ATURAN, 10);
    expect(nilai(komponen, "pph21")).toBe(0);
    expect(peringatan.some((p) => p.startsWith("Status PTKP belum diisi"))).toBe(true);
  });
  it("BPJS Kesehatan dibatasi upah Rp12.000.000; JKK mengikuti tingkat risiko", () => {
    const { komponen } = susunSlip({ pokok: 15_000_000, ptkp: "K/0", risiko_jkk: "tinggi" }, ATURAN, 10);
    expect(nilai(komponen, "bpjs_kes_pk")).toBe(480_000);
    expect(nilai(komponen, "jkk")).toBe(190_500);
  });
  it("Desember dengan riwayat setahun: Pasal 17 dikurangi yang sudah dipotong", () => {
    const g = { pokok: 8_000_000, ptkp: "TK/0" };
    const bulanan = susunSlip(g, ATURAN, 10).komponen;
    const r = ringkasKomponen(bulanan);
    const des = susunSlip(g, ATURAN, 12, { brutoPph: r.brutoPph * 11, pphDipotong: r.pph * 11, iuranPegawai: r.iuranPegawai * 11, bulan: 11 });
    // Bruto setahun 100.358.400; biaya jabatan 5.017.920; iuran JHT 1.920.000; neto 93.420.480; PKP 39.420.000; PPh 1.971.000; dipotong 11 x 125.448.
    expect(nilai(des.komponen, "pph21")).toBe(1_971_000 - 11 * 125_448);
    expect(des.komponen.find((k) => k.kode === "pph21")?.sumber).toBe("aturan:pph21.pasal17");
  });
});

describe("lembur di slip (F1-05B)", () => {
  // Nilai sama dengan aturan bertanggal lembur.pp35 di database (PP 35/2021 Pasal 31).
  const PP35 = ok({ upah_sejam_pembagi: 173, hari_kerja: [[1, 1, 1.5], [2, null, 2]], libur_pola_6_hari: [[1, 7, 2], [8, 8, 3], [9, 11, 4]], libur_pola_6_hari_jatuh_hari_kerja_terpendek: [[1, 5, 2], [6, 6, 3], [7, 9, 4]], libur_pola_5_hari: [[1, 8, 2], [9, 9, 3], [10, 12, 4]] });
  const A = { ...ATURAN, "lembur.pp35": PP35 };
  const bruto = (k: { kode: string; jenis: string; nilai: number }[]) => k.filter((x) => x.jenis === "pendapatan" || MASUK_BRUTO_PPH.includes(x.kode)).reduce((t, x) => t + x.nilai, 0);

  it("kasus L1: upah Rp3.460.000, 4 jam hari kerja menambah Rp150.000 dan masuk bruto PPh 21", () => {
    const tanpa = susunSlip({ pokok: 3_460_000, ptkp: "TK/0" }, A, 11).komponen;
    const dengan = susunSlip({ pokok: 3_460_000, ptkp: "TK/0" }, A, 11, undefined, [{ tanggal: "2026-11-02", jenis: "hari_kerja", jam: 4 }]).komponen;
    expect(nilai(dengan, "lembur")).toBe(150_000);
    expect(dengan.find((k) => k.kode === "lembur")).toMatchObject({ label: "Lembur 4 jam", jenis: "pendapatan", sumber: "aturan:lembur.pp35" });
    expect(bruto(dengan) - bruto(tanpa)).toBe(150_000);
  });

  it("dasar upah = pokok + tunjangan tetap; beberapa hari dijumlah; jam 0 diabaikan", () => {
    const { komponen } = susunSlip({ pokok: 3_000_000, tunjangan_tetap: 460_000 }, A, 11, undefined, [
      { tanggal: "2026-11-02", jenis: "hari_kerja", jam: 1 },
      { tanggal: "2026-11-07", jenis: "libur_pola_6_hari", jam: 8 },
      { tanggal: "2026-11-09", jenis: "hari_kerja", jam: 0 },
    ]);
    // 1,5 x 20.000 + (7 x 2 + 3) x 20.000 = 30.000 + 340.000
    expect(nilai(komponen, "lembur")).toBe(370_000);
    expect(komponen.find((k) => k.kode === "lembur")?.label).toBe("Lembur 9 jam");
  });

  it("aturan lembur belum terverifikasi atau jam berlebih: tidak ditebak, ada peringatan", () => {
    const l = [{ tanggal: "2026-11-02", jenis: "hari_kerja" as const, jam: 2 }];
    const a = susunSlip({ pokok: 3_460_000 }, { ...A, "lembur.pp35": { ...PP35, terverifikasi: false } }, 11, undefined, l);
    expect(nilai(a.komponen, "lembur")).toBeUndefined();
    expect(a.peringatan.join(" ")).toContain("lembur belum dihitung");
    const b = susunSlip({ pokok: 3_460_000 }, A, 11, undefined, [...l, { tanggal: "2026-11-07", jenis: "libur_pola_5_hari", jam: 13 }]);
    expect(nilai(b.komponen, "lembur")).toBe(70_000);
    expect(b.peringatan.join(" ")).toContain("2026-11-07 (13 jam) melebihi batas");
  });
});

describe("insentif beban kerja di slip (F3-05)", () => {
  // PP 36/2021 Pasal 8 ayat (2) dan Pasal 10: insentif = pendapatan non-upah. Masuk bruto PPh 21 bulan dibayar; dasar iuran BPJS
  // di Nadi tetap pokok + tunjangan tetap (perilaku Nadi, belum diverifikasi ke aturan BPJS: docs/design/kolam-bonus-beban.md).
  it("Rp500.000 untuk gaji Rp8.000.000 TK/0: PPh 21 naik ke TER A 1,75%, iuran BPJS tidak berubah", () => {
    const tanpa = susunSlip({ pokok: 8_000_000, ptkp: "TK/0" }, ATURAN, 10).komponen;
    const dengan = susunSlip({ pokok: 8_000_000, ptkp: "TK/0" }, ATURAN, 10, undefined, [], 500_000).komponen;
    expect(dengan.find((k) => k.kode === "insentif_beban")).toEqual({
      kode: "insentif_beban", label: "Insentif beban kerja", jenis: "pendapatan", nilai: 500_000, sumber: "PP 36/2021 Pasal 8 dan 10",
    });
    expect(nilai(tanpa, "pph21")).toBe(125_448);
    expect(nilai(dengan, "pph21")).toBe(155_106);
    for (const kode of ["bpjs_kes_pk", "jkk", "jkm", "jht_pk", "bpjs_kes", "jht"]) expect(nilai(dengan, kode), kode).toBe(nilai(tanpa, kode));
    expect(nilai(tanpa, "insentif_beban")).toBeUndefined();
  });

  it("insentif nol atau tidak bulat: tidak ada komponen, bukan ditebak", () => {
    expect(nilai(susunSlip({ pokok: 3_000_000 }, ATURAN, 10, undefined, [], 0).komponen, "insentif_beban")).toBeUndefined();
    expect(nilai(susunSlip({ pokok: 3_000_000 }, ATURAN, 10, undefined, [], 12.5).komponen, "insentif_beban")).toBeUndefined();
  });
});

describe("komisi di slip (W-07C)", () => {
  it("Rp500.000 komisi: komponen pendapatan, PPh 21 sama dengan insentif senilai, iuran BPJS tidak berubah", () => {
    const tanpa = susunSlip({ pokok: 8_000_000, ptkp: "TK/0" }, ATURAN, 10).komponen;
    const dengan = susunSlip({ pokok: 8_000_000, ptkp: "TK/0" }, ATURAN, 10, undefined, [], 0, 500_000).komponen;
    expect(dengan.find((k) => k.kode === "komisi")).toMatchObject({ jenis: "pendapatan", nilai: 500_000 });
    expect(nilai(dengan, "pph21")).toBe(155_106);
    for (const kode of ["bpjs_kes_pk", "jkk", "jkm", "jht_pk", "bpjs_kes", "jht"]) expect(nilai(dengan, kode), kode).toBe(nilai(tanpa, kode));
    expect(nilai(susunSlip({ pokok: 3_000_000 }, ATURAN, 10, undefined, [], 0, 0).komponen, "komisi")).toBeUndefined();
  });
});

describe("penggantian biaya (M-18)", () => {
  it("tidak masuk bruto PPh 21", () => {
    const k = [
      { kode: "pokok", label: "Gaji pokok", jenis: "pendapatan" as const, nilai: 4_000_000, sumber: "uji" },
      { kode: "penggantian", label: "Penggantian biaya", jenis: "pendapatan" as const, nilai: 350_000, sumber: "uji" },
    ];
    expect(ringkasKomponen(k).brutoPph).toBe(4_000_000);
  });
});
