import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hariKerja, periksaBupot, xmlBupot, xmlReturMasukan, type Potong, type Retur } from "./bupot";
import { jalurElemen } from "./efaktur";

// Korpus M-09B: 10 berkas e-Bupot Unifikasi dan 5 retur faktur masukan sintetis, divalidasi skema turunan oleh
// scripts/pajak/validasi-xsd.py di gerbang. KORPUS_TULIS=1 menulis ulang berkasnya.
const DIR = join(__dirname, "..", "..", "..", "..", "..", "fixtures", "korpus", "efaktur");
const RESMI_BPU = readFileSync(join(DIR, "resmi", "bppu.xml"), "utf8");
const RESMI_RETUR = readFileSync(join(DIR, "resmi", "sample-retur-pm-v1.1.xml"), "utf8");
const ID = { npwp: "1091031210912281", nitku: "1091031210912281000000" };
const KODE = [["24-104-39", 2], ["28-403-02", 10], ["24-104-24", 2], ["24-100-02", 2], ["28-409-22", 1.75]] as const;

function potong(i: number): Potong[] {
  return Array.from({ length: 1 + (i % 4) }, (_, j) => {
    const [kode, tarif] = KODE[(i + j) % KODE.length];
    const dpp = 1_000_000 * (1 + ((i * 3 + j) % 9)) + 50_000 * j;
    return { pemasok: `Pemasok ${i}-${j}`, npwp: `08110342485${String(20000 + i * 10 + j)}`, nitku: `08110342485${String(20000 + i * 10 + j)}000000`,
      kode, dpp, tarif, pph: Math.round((dpp * tarif) / 100), dokumen: j % 2 ? "Contract" : "CommercialInvoice", nomor: `INV & ${i}/${j}`,
      tanggal_dokumen: `2026-11-0${1 + j}`, tanggal_potong: `2026-11-1${j}`, masa: "2026-11-01" };
  });
}
const retur = (i: number): Retur[] => [{ nomorFaktur: `0400260000034${String(8920 + i)}`, npwpPenjual: "1091031210920664", tanggal: `2026-11-${String(10 + i).padStart(2, "0")}`,
  kodeTransaksi: i % 2 ? "01" : "04", baris: Array.from({ length: 1 + (i % 2) }, (_, j) => ({ nama: `Barang ${j + 1}`, jumlah: 20, harga: 200000 + j * 1500, jumlahRetur: 1 + j, satuan: "UM.0021" })) }];

describe("XML e-Bupot Unifikasi dan Retur Faktur Masukan Coretax (M-09B)", () => {
  it("urutan elemen BpuBulk sama dengan contoh resmi bppu.xml (4 bukti potong)", () => {
    const x = xmlBupot(ID, [...potong(3)]);
    expect(jalurElemen(x)).toEqual(jalurElemen(RESMI_BPU));
  });

  it("contoh resmi bppu.xml lolos pemeriksa aturan", () => {
    expect(periksaBupot(RESMI_BPU)).toEqual([]);
  });

  it("10 berkas bupot korpus lolos aturan dan sama dengan berkas di repo", () => {
    for (let i = 0; i < 10; i++) {
      const x = xmlBupot(ID, potong(i));
      expect(periksaBupot(x, new Set(KODE.map((k) => k[0]))), `bupot ${i + 1}`).toEqual([]);
      const f = join(DIR, `bupot-${String(i + 1).padStart(2, "0")}.xml`);
      if (process.env.KORPUS_TULIS === "1") { mkdirSync(DIR, { recursive: true }); writeFileSync(f, x); }
      expect(existsSync(f)).toBe(true);
      expect(readFileSync(f, "utf8")).toBe(x);
    }
  });

  it("pemeriksa bupot menangkap kesalahan", () => {
    const x = xmlBupot(ID, potong(0));
    expect(periksaBupot(x.replace(/<CounterpartTin>\d+/, "<CounterpartTin>123"))).toContain("bukti 1: NPWP/NIK penerima 16 angka");
    expect(periksaBupot(x, new Set(["24-101-01"]))).toContain("bukti 1: kode objek pajak di luar referensi");
    expect(periksaBupot(x.replace("<WithholdingDate>2026-11-10", "<WithholdingDate>2026-10-30")).join()).toContain("sebelum masa");
  });

  it("urutan elemen retur sama dengan contoh resmi dan angka per baris benar", () => {
    const x = xmlReturMasukan(ID.npwp, retur(1));
    expect(jalurElemen(x)).toEqual(jalurElemen(RESMI_RETUR));
    // kode 01: DPP lain = DPP, PPN 12%; baris 1: 200.000 x 1, baris 2: 201.500 x 2
    expect(x).toContain("<ReturnTaxBaseTotal>603000</ReturnTaxBaseTotal>");
    expect(x).toContain("<ReturnVATTotal>72360</ReturnVATTotal>");
    const y = xmlReturMasukan(ID.npwp, retur(0));
    expect(y).toContain("<ReturnOtherTaxBase>183333.33</ReturnOtherTaxBase>");
    expect(y).toContain("<ReturnDate>10-11-2026</ReturnDate>");
  });

  it("5 berkas retur korpus sama dengan berkas di repo", () => {
    for (let i = 0; i < 5; i++) {
      const x = xmlReturMasukan(ID.npwp, retur(i));
      const f = join(DIR, `retur-${String(i + 1).padStart(2, "0")}.xml`);
      if (process.env.KORPUS_TULIS === "1") writeFileSync(f, x);
      expect(readFileSync(f, "utf8")).toBe(x);
    }
  });

  it("hari kerja menggeser Sabtu, Minggu, dan libur", () => {
    expect(hariKerja("2026-12-20", new Set())).toBe("2026-12-21");
    expect(hariKerja("2026-12-25", new Set(["2026-12-25"]))).toBe("2026-12-28");
    expect(hariKerja("2026-12-15", new Set())).toBe("2026-12-15");
  });
});
