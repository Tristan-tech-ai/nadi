import { describe, expect, it } from "vitest";
import { BIDANG, JENIS, hasilDari, jurnalPib, nilai, usulanDari, type Hasil } from "../../../../supabase/functions/baca-berkas/inti";

// B-EKSIM3: dokumen pabean yang dilempar (PIB BC 2.0, PEB BC 3.0, SPPB) menjadi usulan; PIB menjadi usulan jurnal impor.
const pib = {
  nomor_pengajuan: "000020-010101-20261104-000123", nomor_daftar: "123456", tanggal_daftar: "2026-11-04", pemasok: "Harbour Supply Pty Ltd",
  negara_pemasok: "Australia", importir: "CV Kopi Uji", valuta: "USD", ndpbm: 16287.5, fob: 10000, freight: 800, asuransi: 50, nilai_cif: 10850,
  nilai_pabean_rp: 176719375, baris: [{ hs: "0901.11.10", uraian: "Kopi biji mentah", jumlah: 1200, satuan: "KGM" }],
  bm: 8835969, cukai: 0, ppn: 20411088, ppnbm: 0, pph: 4638884, total: 33885941,
};
const hasil = (jenis: Hasil["jenis"], bidang: Record<string, unknown>): Hasil => ({ jenis, keyakinan: 0.95, ringkasan: "", bidang });

describe("dokumen pabean", () => {
  it("jenis baru terdaftar dengan skema bidang", () => {
    for (const j of ["pib", "peb", "sppb"] as const) {
      expect(JENIS).toContain(j);
      expect(BIDANG[j].type).toBe("object");
    }
  });

  it("jurnal PIB seimbang: persediaan + PPN + PPh = utang valas (CIF) + pungutan dibayar", () => {
    const j = jurnalPib(pib);
    expect(j).toMatchObject({ cif: 176_719_375, persediaan: 176_719_375 + 8_835_969, ppn: 20_411_088, pph: 4_638_884, pungutan: 33_885_941 });
    expect(j.persediaan + j.ppn + j.pph).toBe(j.cif + j.pungutan);
  });

  it("nilai pabean kosong: CIF x NDPBM", () => {
    expect(jurnalPib({ ...pib, nilai_pabean_rp: 0 }).cif).toBe(176_719_375);
  });

  it("usulan PIB: uang.impor dengan dampak CIF + pungutan dan rincian jurnal", () => {
    const u = usulanDari(hasil("pib", pib));
    expect(u.aksi).toBe("uang.impor");
    expect(u.dampak_rp).toBe(176_719_375 + 33_885_941);
    expect(u.judul).toBe("Catat impor PIB 123456 dari Harbour Supply Pty Ltd: Rp210.605.316");
    expect(u.penjelasan).toContain("PPN impor Rp20.411.088 (pajak masukan)");
    expect(u.penjelasan).toContain("PPh 22 impor Rp4.638.884 (kredit pajak)");
    expect(u.penjelasan).toContain("utang ke pemasok USD 10.850,00 = Rp176.719.375 (NDPBM Rp16.287,5)");
  });

  it("usulan PEB dan SPPB hanya arsip, tanpa uang", () => {
    expect(usulanDari(hasil("peb", { nomor_daftar: "654321", pembeli: "Harbour Roasters", negara_tujuan: "AU", valuta: "USD", nilai_fob: 8821.05 }))).toMatchObject({ aksi: "dokumen.peb", dampak_rp: null });
    expect(usulanDari(hasil("sppb", { nomor: "SPPB-0099", nomor_pib: "123456", tanggal: "2026-11-05" }))).toMatchObject({ aksi: "dokumen.sppb", dampak_rp: null });
  });

  it("keluaran model dirapikan: angka valuta desimal tetap, bidang asing dibuang", () => {
    const h = hasilDari({ jenis: "pib", keyakinan: 0.9, ringkasan: "", bidang_json: JSON.stringify({ ndpbm: "16287.50", nilai_cif: 10850.5, asing: 1 }) });
    expect(h.bidang.ndpbm).toBe(16287.5);
    expect(h.bidang.nilai_cif).toBe(10850.5);
    expect(h.bidang).not.toHaveProperty("asing");
  });

  it("penilai eval menghitung bidang yang diperiksa", () => {
    const n = nilai("pib", pib, hasil("pib", { ...pib, ppn: 1 }));
    expect(n.diperiksa).toBe(12);
    expect(n.salah).toEqual(["ppn"]);
  });
});
