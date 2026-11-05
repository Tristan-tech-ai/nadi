import { readFileSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { angka, hp, kenali, tanggal } from "@/lib/pindah/format";
import { periksaPeta, petaSama, ringkasKolom, terapkanPeta, type Peta } from "@/lib/pindah/peta";

const ASET = join(__dirname, "..", "..", "..", "..", "..", "docs", "promo", "aset-demo");
const FN = join(__dirname, "..", "..", "..", "..", "..", "supabase", "functions", "pelajari-pindah");

async function bacaXlsx(f: string): Promise<unknown[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(f);
  const rows: unknown[][] = [];
  wb.worksheets[0].eachRow({ includeEmpty: false }, (r) => rows.push((r.values as ExcelJS.CellValue[]).slice(1).map((v) => (v && typeof v === "object" && "result" in v ? v.result : v) ?? "")));
  return rows;
}

describe("belajar format pindah data (T-01C)", () => {
  it("salinan peta.ts di Edge Function sama persis; format.ts ringkas di sana berperilaku sama", async () => {
    expect(readFileSync(join(FN, "peta.ts"), "utf8").replace(/\r\n/g, "\n")).toBe(readFileSync(join(__dirname, "peta.ts"), "utf8").replace(/\r\n/g, "\n"));
    const f = await import("../../../../../supabase/functions/pelajari-pindah/format");
    const contoh: unknown[] = ["72rb", "4,5jt", "Rp 1.250.000", "(5000)", "2,500,000", "1.250,50", 9500, "", "abc", "2026-11-06", "06/11/2026",
      "0812-3700-0000", "+6281237104729", "62 812 37314187", "'0812370000", new Date("2026-01-02")];
    for (const v of contoh) {
      expect(f.angka(v), String(v)).toEqual(angka(v));
      expect(f.tanggal(v), String(v)).toEqual(tanggal(v));
      expect(f.hp(v), String(v)).toEqual(hp(v));
    }
  });
  it("angka singkatan rupiah", () => {
    expect([angka("72rb"), angka("4,5jt"), angka("Rp 1,2 juta"), angka("9.500")]).toEqual([72000, 4500000, 1200000, 9500]);
  });
  it("daftar harga berantakan: tidak dikenali bawaan, ringkasan hanya judul dan tipe, peta yang benar lolos pengawas", async () => {
    const rows = await bacaXlsx(join(ASET, "harga-berantakan.xlsx"));
    expect(kenali(rows)).toBeNull();
    const r = ringkasKolom(rows)!;
    expect(r.judul).toEqual(["kode", "barang", "sat", "hrg jual", "hrg grosir", "catatan"]);
    expect(r.tipe[3]).toBe("angka");
    expect(JSON.stringify(r)).not.toMatch(/beras|gula|72/i); // tanpa isi baris
    const peta: Peta = { format: "produk", kolom: { kode: "kode", nama: "barang", satuan: "sat", harga_jual: "hrg jual" } };
    expect(periksaPeta(r, peta)).toEqual({ lulus: true, alasan: [] });
    const h = terapkanPeta(rows, r, peta);
    expect(h.baris.length).toBe(13);
    expect(h.baris[0]).toMatchObject({ nama: expect.stringMatching(/beras/i), harga_jual: 72000 });
  });
  it("pengawas menolak peta karangan", async () => {
    const r = ringkasKolom(await bacaXlsx(join(ASET, "harga-berantakan.xlsx")))!;
    const tolak = (kolom: Record<string, string>, format = "produk") => periksaPeta(r, { format: format as Peta["format"], kolom }).alasan.join("; ");
    expect(tolak({ nama: "nama barang" })).toContain("tidak ada di berkas");
    expect(tolak({ nama: "barang", harga_jual: "barang" })).toContain("dua kali");
    expect(tolak({ nama: "barang", password: "kode" })).toContain("bidang tidak dikenal");
    expect(tolak({ harga_jual: "hrg jual" })).toContain("wajib");
    expect(tolak({ nama: "barang" }, "gaji")).toContain("format");
    expect(tolak({ nama: "barang", harga_jual: "catatan" })).toContain("butuh angka");
  });
  it("peta sama tidak peduli urutan bidang", () => {
    expect(petaSama({ format: "produk", kolom: { nama: "a", kode: "b" } }, { format: "produk", kolom: { kode: "b", nama: "a" } })).toBe(true);
    expect(petaSama({ format: "produk", kolom: { nama: "a" } }, { format: "produk", kolom: { nama: "b" } })).toBe(false);
  });
});
