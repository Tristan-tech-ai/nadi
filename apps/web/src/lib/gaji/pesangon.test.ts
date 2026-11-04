import { describe, expect, it } from "vitest";
import { bulanMenurut, hitungPesangon, masaKerjaBulan, ringkasCadangan, teksMasaKerja, type AturanPesangon, type OrangPesangon } from "./pesangon";

// Sama dengan aturan_bertanggal kunci pesangon.pp35 (migrasi 20261101021000_cadangan_pesangon.sql), dari PP 35/2021 Pasal 40
// ayat (2) dan (3) (docs/research/pesangon-f4-09.md).
const PP35: AturanPesangon = {
  pesangon: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9]],
  upmk: [[3, 2], [6, 3], [9, 4], [12, 5], [15, 6], [18, 7], [21, 8], [24, 10]],
  pengali: { rugi: 0.5, pensiun: 1.75 },
};
const HARI = "2026-11-01";
const orang = (o: Partial<OrangPesangon>): OrangPesangon => ({
  id: "o1", nama: "Sari", mulai: "2022-09-01", kontrak_selesai: null, pokok: 3_500_000, tunjangan_tetap: 500_000, ...o,
});

describe("masa kerja dalam bulan penuh", () => {
  it("genap setahun pada tanggal yang sama", () => {
    expect(masaKerjaBulan("2025-11-01", "2026-11-01")).toBe(12);
    expect(masaKerjaBulan("2025-11-01", "2026-10-31")).toBe(11);
  });
  it("4 tahun 2 bulan", () => expect(masaKerjaBulan("2022-09-01", HARI)).toBe(50));
  it("hari pertama kerja = 0 bulan", () => expect(masaKerjaBulan(HARI, HARI)).toBe(0));
  it("tanggal mulai di masa depan atau tidak sah = null", () => {
    expect(masaKerjaBulan("2026-12-01", HARI)).toBeNull();
    expect(masaKerjaBulan("2026-02-30", HARI)).toBeNull();
    expect(masaKerjaBulan("1 Nov 2020", HARI)).toBeNull();
  });
});

describe("tabel Pasal 40 ayat (2) dan (3) di batas masa kerja", () => {
  // [bulan masa kerja, bulan pesangon, bulan UPMK]
  it.each([
    [0, 1, 0], [11, 1, 0], [12, 2, 0], [35, 3, 0], [36, 4, 2], [96, 9, 3], [287, 9, 8], [288, 9, 10],
  ])("masa kerja %i bulan: pesangon %i, UPMK %i", (bulan, p, u) => {
    const tahun = Math.floor(bulan / 12);
    expect(bulanMenurut(PP35.pesangon, tahun)).toBe(p);
    expect(bulanMenurut(PP35.upmk, tahun)).toBe(u);
  });
});

describe("hitungPesangon per karyawan", () => {
  it("contoh dokumen: 4 tahun 2 bulan, upah dasar Rp4.000.000 = 7 bulan = Rp28.000.000", () => {
    const b = hitungPesangon(orang({}), PP35, HARI);
    expect(b).toMatchObject({ status: "dihitung", masaBulan: 50, upah: 4_000_000, bulanPesangon: 5, bulanUpmk: 2, dasar: 28_000_000 });
    // Rentang: pengali hanya pada pesangon, UPMK tetap 1 kali.
    expect(b.rugi).toBe(2.5 * 4_000_000 + 8_000_000);
    expect(b.pensiun).toBe(8.75 * 4_000_000 + 8_000_000);
  });
  it("upah dasar = pokok + tunjangan tetap (Pasal 157 UU 6/2023); tunjangan kosong = 0", () => {
    expect(hitungPesangon(orang({ tunjangan_tetap: null }), PP35, HARI).upah).toBe(3_500_000);
  });
  it("pecahan rupiah dibuang", () => {
    // 1 bulan pesangon x 0,5 x Rp3.000.001 = Rp1.500.000,5 -> Rp1.500.000
    expect(hitungPesangon(orang({ mulai: HARI, pokok: 3_000_001, tunjangan_tetap: 0 }), PP35, HARI).rugi).toBe(1_500_000);
  });
  it("tanpa tanggal mulai, tanpa gaji, atau kontrak waktu tertentu tidak dihitung", () => {
    expect(hitungPesangon(orang({ mulai: null }), PP35, HARI)).toMatchObject({ status: "tanpa_mulai", dasar: 0 });
    expect(hitungPesangon(orang({ mulai: "1 Sep 2022" }), PP35, HARI)).toMatchObject({ status: "tanpa_mulai", dasar: 0 });
    expect(hitungPesangon(orang({ mulai: "2027-01-01" }), PP35, HARI)).toMatchObject({ status: "belum_mulai", dasar: 0 });
    expect(hitungPesangon(orang({ pokok: null }), PP35, HARI)).toMatchObject({ status: "tanpa_gaji", dasar: 0 });
    expect(hitungPesangon(orang({ kontrak_selesai: "2027-06-30" }), PP35, HARI)).toMatchObject({ status: "kontrak", dasar: 0 });
  });
});

describe("ringkasCadangan", () => {
  const baris = [
    hitungPesangon(orang({}), PP35, HARI),
    hitungPesangon(orang({ id: "o2", nama: "Budi", mulai: "2025-11-01", pokok: 3_000_000, tunjangan_tetap: 0 }), PP35, HARI),
    hitungPesangon(orang({ id: "o3", nama: "Dewi", mulai: null }), PP35, HARI),
  ];
  it("menjumlah yang dihitung dan menyebut yang belum", () => {
    // Budi 1 tahun: pesangon 2 bulan, UPMK 0 = Rp6.000.000.
    const r = ringkasCadangan(baris, 0);
    expect(r).toMatchObject({ dasar: 34_000_000, belumDihitung: 1, kekurangan: 34_000_000 });
    expect(r.rugi).toBe(18_000_000 + 3_000_000);
    expect(r.pensiun).toBe(43_000_000 + 10_500_000);
  });
  it("saran sisihan = kekurangan dibagi 12, dibulatkan ke atas", () => {
    expect(ringkasCadangan(baris, 0).sisihanSebulan).toBe(Math.ceil(34_000_000 / 12));
    expect(ringkasCadangan(baris, 10_000_000)).toMatchObject({ kekurangan: 24_000_000, sisihanSebulan: 2_000_000 });
    expect(ringkasCadangan(baris, 50_000_000)).toMatchObject({ kekurangan: 0, sisihanSebulan: 0 });
  });
});

describe("teksMasaKerja", () => {
  it.each([[0, "kurang dari 1 bulan"], [1, "1 bulan"], [14, "1 tahun 2 bulan"], [24, "2 tahun"]])("%i bulan", (b, t) => {
    expect(teksMasaKerja(b)).toBe(t);
  });
});

// F4-09B: uang kompensasi PKWT (PP 35/2021 Pasal 15-17) dan iuran dana pensiun pengusaha (Pasal 58).
const KOMP = { pembagi_bulan: 12, minimal_bulan: 1 };

describe("uang kompensasi PKWT (Pasal 16 ayat (1), proporsional masa kerja / 12 x 1 bulan upah)", () => {
  it("9 bulan, upah Rp4.000.000 = Rp3.000.000; tanpa pengali alasan", () => {
    const b = hitungPesangon(orang({ mulai: "2026-02-01", kontrak_selesai: "2027-01-31" }), PP35, HARI, KOMP);
    expect(b).toMatchObject({ status: "kompensasi", masaBulan: 9, dasar: 3_000_000, rugi: 3_000_000, pensiun: 3_000_000, bulanPesangon: 0, bulanUpmk: 0 });
  });
  it("lebih dari 12 bulan tetap proporsional: 18 bulan = 1,5 bulan upah", () => {
    expect(hitungPesangon(orang({ mulai: "2025-05-01", kontrak_selesai: "2027-04-30" }), PP35, HARI, KOMP).dasar).toBe(6_000_000);
  });
  it("masa kerja kurang dari 1 bulan belum berhak (Pasal 15 ayat (3))", () => {
    expect(hitungPesangon(orang({ mulai: "2026-10-15", kontrak_selesai: "2027-04-14" }), PP35, HARI, KOMP)).toMatchObject({ status: "kompensasi", dasar: 0 });
  });
  it("pecahan rupiah dibuang", () => {
    expect(hitungPesangon(orang({ mulai: "2026-04-01", kontrak_selesai: "2027-03-31", pokok: 3_500_001, tunjangan_tetap: 0 }), PP35, HARI, KOMP).dasar).toBe(2_041_667);
  });
  it("kontrak tanpa tanggal mulai atau tanpa gaji tetap meminta isian", () => {
    expect(hitungPesangon(orang({ mulai: null, kontrak_selesai: "2027-01-31" }), PP35, HARI, KOMP).status).toBe("tanpa_mulai");
    expect(hitungPesangon(orang({ pokok: null, kontrak_selesai: "2027-01-31" }), PP35, HARI, KOMP).status).toBe("tanpa_gaji");
  });
});

describe("iuran dana pensiun pengusaha mengurangi kekurangan orang itu (Pasal 58)", () => {
  const sari = hitungPesangon(orang({ iuran_pensiun: 10_000_000 }), PP35, HARI);
  const budi = hitungPesangon(orang({ id: "o2", nama: "Budi", mulai: "2025-11-01", pokok: 3_000_000, tunjangan_tetap: 0, iuran_pensiun: 9_000_000 }), PP35, HARI);
  const kontrak = hitungPesangon(orang({ id: "o4", nama: "Rina", mulai: "2026-02-01", kontrak_selesai: "2027-01-31", iuran_pensiun: 5_000_000 }), PP35, HARI, KOMP);
  it("tertutup paling banyak sebesar kewajiban orang itu", () => {
    expect(sari.tertutupPensiun).toBe(10_000_000);
    expect(budi.tertutupPensiun).toBe(6_000_000);
  });
  it("tidak berlaku untuk uang kompensasi PKWT (Pasal 58 menyebut pesangon, UPMK, uang pisah)", () => {
    expect(kontrak.tertutupPensiun).toBe(0);
  });
  it("kekurangan = kewajiban - iuran tertutup - saldo", () => {
    const r = ringkasCadangan([sari, budi, kontrak], 10_000_000);
    expect(r).toMatchObject({ dasar: 28_000_000 + 6_000_000 + 3_000_000, tertutupPensiun: 16_000_000, kekurangan: 11_000_000, dihitung: 3 });
  });
});
