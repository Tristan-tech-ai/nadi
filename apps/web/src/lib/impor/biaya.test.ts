import { describe, expect, it } from "vitest";
import { hitungImpor, tarifPph22, type AturanImpor, type MasukImpor } from "./biaya";

// Nilai aturan sama dengan baris aturan_bertanggal pph22.impor dan ppn.impor (migrasi 20261104046000, terverifikasi R-EKSIM2).
const aturan: AturanImpor = {
  pph22: { dengan_api_persen: 2.5, tanpa_api_persen: 7.5, barang_tertentu_persen: 10, barang_tertentu_lain_persen: 7.5, kedelai_gandum_terigu_api_persen: 0.5, emas_batangan_persen: 0.25 },
  ppn: { tarif_persen: 12, dpp_pengali: [11, 12] },
};
const dasar: MasukImpor = { fobSen: 1_000_000, ongkirSen: 80_000, asuransiSen: 5_000, kurs: 16287.5, bmPersen: 5, kelompok: "umum", api: true, mewah: false, biayaLain: 3_000_000 };

describe("impor/biaya", () => {
  it("tarif PPh 22 impor per kelompok (PMK 51/2025 Pasal 3 ayat (1) huruf a angka 1)", () => {
    expect(tarifPph22("umum", true, aturan.pph22)).toBe(2.5);
    expect(tarifPph22("umum", false, aturan.pph22)).toBe(7.5);
    expect(tarifPph22("tertentu", true, aturan.pph22)).toBe(10);
    expect(tarifPph22("tertentu", false, aturan.pph22)).toBe(10);
    expect(tarifPph22("tertentu_lain", false, aturan.pph22)).toBe(7.5);
    expect(tarifPph22("kedelai_gandum_terigu", true, aturan.pph22)).toBe(0.5);
    expect(tarifPph22("kedelai_gandum_terigu", false, aturan.pph22)).toBe(7.5);
    expect(tarifPph22("emas_batangan", false, aturan.pph22)).toBe(0.25);
  });

  it("CIF x kurs, bea masuk, nilai impor, PPN 12% x 11/12, PPh 22 dari nilai impor", () => {
    const h = hitungImpor(dasar, aturan)!;
    expect(h.cifSen).toBe(1_085_000);
    expect(h.cifRp).toBe(176_719_375);
    expect(h.bm).toBe(8_835_969);
    expect(h.nilaiImpor).toBe(185_555_344);
    expect(h.ppn).toBe(20_411_088);
    expect(h.pph22).toBe(4_638_884);
    expect(h.tarifPph22).toBe(2.5);
    expect(h.pajak).toBe(33_885_941);
    expect(h.uangKeluar).toBe(213_605_316);
    expect(h.biayaMendarat).toBe(188_555_344);
  });

  it("tanpa API 7,5%; barang mewah PPN dari nilai impor penuh", () => {
    expect(hitungImpor({ ...dasar, api: false }, aturan)?.pph22).toBe(13_916_651);
    expect(hitungImpor({ ...dasar, mewah: true }, aturan)?.ppn).toBe(22_266_641);
  });

  it("isian kosong atau tidak masuk akal tidak menghasilkan angka", () => {
    expect(hitungImpor({ ...dasar, kurs: Number.NaN }, aturan)).toBeNull();
    expect(hitungImpor({ ...dasar, bmPersen: -1 }, aturan)).toBeNull();
    expect(hitungImpor({ ...dasar, fobSen: 0, ongkirSen: 0, asuransiSen: 0 }, aturan)).toBeNull();
  });
});
