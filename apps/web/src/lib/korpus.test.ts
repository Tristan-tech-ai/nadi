import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

// Korpus contoh sintetis (fixtures/korpus, dibuat scripts/korpus/buat.mjs): lengkap, jawaban konsisten, tanpa data orang sungguhan.
const AKAR = join(__dirname, "..", "..", "..", "..", "fixtures", "korpus");
const indeks = JSON.parse(readFileSync(join(AKAR, "indeks.json"), "utf8")) as { jumlah: number; berkas: { jenis: string; berkas: string; jawaban: string }[] };
const jawaban = (j: string) => JSON.parse(readFileSync(join(AKAR, j), "utf8"));
const dariJenis = (jenis: string) => indeks.berkas.filter((b) => b.jenis === jenis).map((b) => ({ ...b, isi: jawaban(b.jawaban) }));

/** NIK sintetis Nadi: 16 digit dengan kode provinsi 99 (tidak ada di Indonesia). */
export function nikSintetis(nik: string): boolean {
  return /^\d{16}$/.test(nik) && nik.startsWith("99");
}

describe("korpus contoh", () => {
  it("minimal 40 berkas, semuanya ada beserta jawabannya", () => {
    expect(indeks.jumlah).toBeGreaterThanOrEqual(40);
    for (const b of indeks.berkas) {
      expect(existsSync(join(AKAR, b.berkas)), b.berkas).toBe(true);
      expect(existsSync(join(AKAR, b.jawaban)), b.jawaban).toBe(true);
    }
  });

  it("semua jenis yang dibutuhkan Lempar Saja ada", () => {
    const ada = new Set(indeks.berkas.map((b) => b.jenis));
    for (const j of ["nota", "invoice", "slip_gaji", "ktp", "cv", "surat", "absen", "excel_karyawan", "mutasi", "surat_sakit"]) expect(ada.has(j), j).toBe(true);
  });

  it("ada minimal dua berkas dengan tata letak sama (untuk uji ekstraktor terkompilasi)", () => {
    const tata = dariJenis("nota").map((n) => n.isi.catatan);
    expect(tata.filter((t) => t === "tata letak a").length).toBeGreaterThanOrEqual(2);
  });

  it("KTP hanya memakai NIK sintetis", () => {
    for (const k of dariJenis("ktp")) expect(nikSintetis(k.isi.bidang.nik), k.isi.bidang.nik).toBe(true);
  });

  it("pemeriksa NIK sintetis bisa gagal", () => {
    expect(nikSintetis("5171012605830001")).toBe(false);
  });

  it("nota dan invoice: jumlah baris = qty x harga, total = jumlah semua baris", () => {
    for (const d of [...dariJenis("nota"), ...dariJenis("invoice")]) {
      const baris = d.isi.bidang.baris as { qty: number; harga: number; jumlah: number }[];
      for (const b of baris) expect(b.jumlah).toBe(b.qty * b.harga);
      expect(d.isi.bidang.total).toBe(baris.reduce((a, b) => a + b.jumlah, 0));
    }
  });

  it("slip gaji: diterima = bruto - total potongan", () => {
    for (const s of dariJenis("slip_gaji")) {
      const b = s.isi.bidang;
      const pot = Object.values(b.potongan as Record<string, number>).reduce((a, c) => a + c, 0);
      expect(b.neto).toBe(b.bruto - pot);
    }
  });

  it("Excel karyawan 30 baris terbaca sama dengan jawabannya", async () => {
    const e = dariJenis("excel_karyawan").find((x) => x.berkas.endsWith("karyawan-30.xlsx"))!;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(join(AKAR, e.berkas));
    const ws = wb.worksheets[0];
    expect(ws.rowCount).toBe(31);
    expect(ws.getRow(2).getCell(2).value).toBe(e.isi.bidang.baris[0].nama);
  });

  it("mutasi CSV punya kepala kolom dan 15 baris", () => {
    for (const m of dariJenis("mutasi")) {
      const baris = readFileSync(join(AKAR, m.berkas), "utf8").trim().split("\n");
      expect(baris[0]).toBe("Tanggal,Keterangan,Cabang,Jumlah,DB/CR,Saldo");
      expect(baris.length).toBe(16);
    }
  });
});
