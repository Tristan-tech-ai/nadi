import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ringkasKomponen, susunSlip, type PetaAturan } from "./susun";

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
