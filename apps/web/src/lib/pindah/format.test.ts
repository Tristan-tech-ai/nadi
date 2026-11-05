import { readFileSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { angka, kenali, tanggal, uraiCsv } from "./format";

const KORPUS = join(__dirname, "..", "..", "..", "..", "..", "fixtures", "korpus", "pindah");
const csv = (n: string) => uraiCsv(readFileSync(join(KORPUS, n), "utf8"));

describe("korpus pindah (kolom template resmi Jurnal + format umum)", () => {
  it("Akun/COA Jurnal: 12 akun, apostrof kode dibuang, saldo awal seimbang", () => {
    const h = kenali(csv("jurnal-akun.csv"));
    if (!h || !("baris" in h)) throw new Error("tidak dikenali");
    expect(h.format).toBe("akun");
    expect(h.baris).toHaveLength(12);
    expect(h.baris[0]).toEqual({ kode_asal: "1-10001", nama: "Kas Toko", kategori: 3, saldo: 2500000 });
    expect(h.baris[8]).toEqual({ kode_asal: "4-40000", nama: "Pendapatan Penjualan", kategori: 13 });
    const debit = h.baris.filter((b) => [1, 3, 4, 5].includes(b.kategori as number)).reduce((s, b) => s + Number(b.saldo ?? 0), 0);
    const kredit = h.baris.filter((b) => [7, 8, 12].includes(b.kategori as number)).reduce((s, b) => s + Number(b.saldo ?? 0), 0);
    expect(debit).toBe(kredit);
  });
  it("Kontak Jurnal: tipe bertitik koma, HP ke 62", () => {
    const h = kenali(csv("jurnal-kontak.csv"));
    if (!h || !("baris" in h)) throw new Error("tidak dikenali");
    expect(h.format).toBe("kontak");
    expect(h.baris).toHaveLength(6);
    expect(h.baris[1]).toMatchObject({ tipe: ["customer"], nama: "Warung Bu Ani", hp: "6281234567802", kota: "Denpasar" });
    expect(h.baris[3]).toMatchObject({ tipe: ["customer", "vendor"], nama: "Koperasi Tani Makmur", hp: "6281234567804", perusahaan: "Koperasi Tani Makmur" });
  });
  it("Penagihan Penjualan Jurnal dikenali tetapi belum dipindahkan", () => {
    expect(kenali(csv("jurnal-penagihan.csv"))).toEqual({ format: "penagihan", sumber: "jurnal", belum: true });
  });
  it("karyawan umum: tanggal dd/mm/yyyy dan ISO, gaji Rp bertitik", () => {
    const h = kenali(csv("karyawan-umum.csv"));
    if (!h || !("baris" in h)) throw new Error("tidak dikenali");
    expect(h.format).toBe("karyawan");
    expect(h.baris[0]).toEqual({ id: "K-001", nama: "Sari Dewi", jabatan: "Kasir", telepon: "6281211112201", mulai: "2024-02-01", gaji_pokok: 3200000 });
    expect(h.baris[2]).toMatchObject({ mulai: "2023-03-10", telepon: "6281211112203", gaji_pokok: 5500000 });
  });
  it("produk umum bertitik koma: harga Rp, stok kosong tidak dikirim", () => {
    const h = kenali(csv("produk-umum.csv"));
    if (!h || !("baris" in h)) throw new Error("tidak dikenali");
    expect(h.format).toBe("produk");
    expect(h.baris).toEqual([
      { kode: "GLP-1", nama: "Gula Pasir 1 kg", satuan: "bks", harga_jual: 18500, stok: 40 },
      { kode: "BRS-5", nama: "Beras Premium 5 kg", satuan: "sak", harga_jual: 82000, stok: 12 },
      { kode: "KPI-200", nama: "Kopi Bubuk 200 g", satuan: "bks", harga_jual: 27500, stok: 30 },
    ]);
  });
  it("berkas lain tidak dikenali", () => expect(kenali(csv("acak.csv"))).toBeNull());
  it("XLSX berjudul Inggris (sel tanggal asli Excel)", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Employees");
    ws.addRow(["Employee ID", "Full Name", "Job Position", "Join Date", "Mobile Phone"]);
    ws.addRow(["EMP-01", "Wayan Sudira", "Cook", new Date(Date.UTC(2025, 0, 6)), "081299990001"]);
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(await wb.xlsx.writeBuffer());
    const rows: unknown[][] = [];
    wb2.worksheets[0].eachRow((r) => rows.push((r.values as unknown[]).slice(1)));
    expect(kenali(rows)).toEqual({ format: "karyawan", sumber: "umum", dilewati: 0,
      baris: [{ id: "EMP-01", nama: "Wayan Sudira", jabatan: "Cook", telepon: "6281299990001", mulai: "2025-01-06" }] });
  });
});

describe("angka dan tanggal", () => {
  it("format rupiah dan ribuan", () => {
    expect([angka("Rp3.200.000"), angka("2,500,000"), angka("1.250,50"), angka("(5000)"), angka("12,5"), angka("abc"), angka("")]).toEqual([3200000, 2500000, 1250.5, -5000, 12.5, null, null]);
  });
  it("tanggal tidak sah ditolak", () => {
    expect([tanggal("31/12/2025"), tanggal("13/31/2025"), tanggal("kemarin")]).toEqual(["2025-12-31", null, null]);
  });
});
