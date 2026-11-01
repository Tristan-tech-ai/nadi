import { describe, expect, it } from "vitest";
import { cekBatas, hitungFinal, simulasi, type AturanFinal } from "./kompas";

// F4-07 (docs/research/kompas-pajak.md): angka dari PP 55/2022 sebagaimana diubah PP 20/2026, sama dengan aturan_bertanggal
// kunci pph.final_umkm (migrasi kompas_pajak).
const A: AturanFinal = { tarif_persen: 0.5, batas_bruto: 4_800_000_000, bebas_op: 500_000_000, koperasi_tahun: 4 };
const LAPISAN: [number | null, number][] = [[60_000_000, 5], [250_000_000, 15], [500_000_000, 25], [5_000_000_000, 30], [null, 35]];
const PTKP = { diri: 54_000_000, kawin: 4_500_000, per_tanggungan: 4_500_000, maks_tanggungan: 3 };
const rata = (n: number) => Array.from({ length: 12 }, () => n);

describe("hitungFinal (Pasal 60)", () => {
  it("orang pribadi: Rp500 jt pertama setahun tidak dikenai, dihitung kumulatif sejak masa pertama", () => {
    const h = hitungFinal(rata(100_000_000), "op", A);
    expect(h.perBulan.slice(0, 6).map((b) => b.pajak)).toEqual([0, 0, 0, 0, 0, 500_000]);
    expect(h.perBulan[4].dpp).toBe(0);
    expect(h.perBulan[5].dpp).toBe(100_000_000);
    expect(h.total).toBe(3_500_000);
  });
  it("bulan yang melewati Rp500 jt hanya kena bagian di atasnya", () => {
    const h = hitungFinal([450_000_000, 100_000_000, ...rata(0).slice(2)], "op", A);
    expect(h.perBulan[1]).toMatchObject({ dpp: 50_000_000, pajak: 250_000 });
  });
  it("PT perorangan dan koperasi: tanpa bagian bebas", () => {
    expect(hitungFinal(rata(100_000_000), "pt_perorangan", A).total).toBe(6_000_000);
    expect(hitungFinal(rata(100_000_000), "koperasi", A).total).toBe(6_000_000);
  });
  it("lewat Rp4,8 M di tahun berjalan: tetap 0,5% sampai akhir tahun, bulan lewatnya dicatat (Pasal 61)", () => {
    const h = hitungFinal(rata(500_000_000), "pt_perorangan", A);
    expect(h.lewatBulan).toBe(10);
    expect(h.total).toBe(30_000_000);
  });
  it("badan selain perseroan perorangan dan koperasi: tidak dihitung", () => {
    expect(hitungFinal(rata(1), "badan_lain", A)).toEqual({ perBulan: [], total: 0, lewatBulan: null, berlaku: false });
  });
});

describe("cekBatas (Pasal 57, 58)", () => {
  it("gabungan semua usaha pemilik tahun lalu di atas Rp4,8 M: tidak boleh memakai tarif final tahun ini", () => {
    const h = cekBatas({ bentuk: "op", brutoLalu: 3_000_000_000, usahaLainLalu: 2_000_000_000, brutoIni: 100_000_000, usahaLainIni: 0, pasanganLalu: 0, pasanganIni: 0 }, A);
    expect(h.status).toBe("lewat_tahun_lalu");
    expect(h.gabunganLalu).toBe(5_000_000_000);
    expect(h.kalimat).toContain("Rp5.000.000.000");
    expect(h.dasar).toMatch(/Pasal 57 ayat \(2\) huruf e/);
  });
  it("pasangan pisah harta ikut digabung", () => {
    expect(cekBatas({ bentuk: "op", brutoLalu: 3_000_000_000, usahaLainLalu: 0, brutoIni: 0, usahaLainIni: 0, pasanganLalu: 2_000_000_000, pasanganIni: 0 }, A).status).toBe("lewat_tahun_lalu");
  });
  it("tahun lalu aman, tahun ini sudah lewat: final sampai akhir tahun, tahun depan tarif umum", () => {
    const h = cekBatas({ bentuk: "pt_perorangan", brutoLalu: 1_000_000_000, usahaLainLalu: 0, brutoIni: 4_000_000_000, usahaLainIni: 900_000_000, pasanganLalu: 0, pasanganIni: 0 }, A);
    expect(h.status).toBe("lewat_tahun_ini");
    expect(h.dasar).toMatch(/Pasal 61/);
  });
  it("di bawah batas: boleh, sisa ruang disebut", () => {
    const h = cekBatas({ bentuk: "op", brutoLalu: 1_000_000_000, usahaLainLalu: 0, brutoIni: 800_000_000, usahaLainIni: 0, pasanganLalu: 0, pasanganIni: 0 }, A);
    expect(h.status).toBe("boleh");
    expect(h.kalimat).toContain("Rp4.000.000.000");
  });
  it("CV, firma, PT biasa: tidak berlaku sejak PP 20/2026, kecuali sisa jangka waktu lama", () => {
    const h = cekBatas({ bentuk: "badan_lain", brutoLalu: 1, usahaLainLalu: 0, brutoIni: 1, usahaLainIni: 0, pasanganLalu: 0, pasanganIni: 0 }, A);
    expect(h.status).toBe("tidak_berlaku");
    expect(h.dasar).toMatch(/Pasal II/);
  });
});

describe("simulasi bentuk usaha (legal saja)", () => {
  const s = simulasi({ bruto: 2_000_000_000, laba: 300_000_000, statusPtkp: "K/1" }, A, LAPISAN, PTKP);
  it("tiga hitungan dengan dasar hukum: OP final, PT perorangan final, OP tarif umum", () => {
    expect(s.baris.map((b) => [b.bentuk, b.pajak])).toEqual([
      ["Orang pribadi, PPh final 0,5%", 7_500_000],
      ["Perseroan perorangan, PPh final 0,5%", 10_000_000],
      ["Orang pribadi, tarif umum Pasal 17 (dari laba)", 29_550_000],
    ]);
    for (const b of s.baris) expect(b.dasar.length).toBeGreaterThan(10);
  });
  it("badan biasa tidak dihitung tanpa sumber terverifikasi, dan dikatakan terus terang", () => {
    expect(s.tidakDihitung).toMatch(/Pasal 31E/);
  });
  it("tidak pernah menyarankan memecah usaha; malah memperingatkannya", () => {
    const semua = JSON.stringify(s).toLowerCase();
    expect(semua).not.toMatch(/pecah usaha agar|pisahkan usaha agar|atas nama orang lain agar/);
    expect(s.peringatan).toMatch(/gabungan/);
  });
});
