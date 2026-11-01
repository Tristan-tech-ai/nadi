import { existsSync } from "node:fs";
import ExcelJS from "exceljs";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { bukuBpmp, JUDUL_BPMP, susunBpmp, type DataBpmp } from "./bpmp";

// F4-08 (docs/research/coretax-bpmp.md): susunan template BPMP Excel to XML v.3 DJP. Pembanding template resmi opsional lewat
// env BPMP_TEMPLATE (berkas DJP tidak disimpan di repo).
const TER = { A: [[0, 5_400_000, 0], [5_400_000, 5_650_000, 0.25], [5_650_000, 5_950_000, 0.5], [5_950_000, 6_300_000, 0.75], [6_300_000, null, 1]] as [number, number | null, number][],
  B: [[0, 6_200_000, 0], [6_200_000, null, 1]] as [number, number | null, number][], C: [[0, 6_600_000, 0], [6_600_000, null, 1]] as [number, number | null, number][] };
const KATEGORI = { "TK/0": "A", "TK/1": "A", "K/0": "A", "TK/2": "B", "TK/3": "B", "K/1": "B", "K/2": "B", "K/3": "C" };
const komponen = (pokok: number) => [
  { kode: "pokok", label: "Gaji pokok", jenis: "pendapatan", nilai: pokok, sumber: "orang_rahasia" },
  { kode: "jkk", label: "JKK", jenis: "pemberi_kerja", nilai: 14_400, sumber: "aturan" },
  { kode: "pph21", label: "PPh 21", jenis: "potongan", nilai: 0, sumber: "aturan:pph21.ter" },
];
const data = (bulan = "2026-09-01"): DataBpmp => ({
  bulan, status: "disetujui", identitas: { npwp: "3172022407981234", id_tku: "3172022407981234000000" }, bulan_disetujui: [bulan],
  baris: [
    { orang_id: "a", nama: "Ani Gaji", id_staf: "S001", ptkp: "TK/0", nik_akhir: "1234", posisi: "Kasir", komponen: komponen(5_900_000) },
    { orang_id: "b", nama: "Beni Gaji", id_staf: "S002", ptkp: null, nik_akhir: null, posisi: "Pegawai", komponen: komponen(4_000_000) },
  ],
});

describe("susunBpmp", () => {
  it("bruto PPh (pendapatan + JKK), tarif TER sesuai kategori PTKP, tanggal potong akhir bulan", () => {
    const h = susunBpmp(data(), { ter: TER, kategori: KATEGORI });
    expect(h.baris).toEqual([{ masa: 9, tahun: 2026, statusPegawai: "Resident", nik: "", paspor: "", ptkp: "TK/0", posisi: "Kasir", sertifikat: "N/A",
      kodeObjek: "21-100-01", bruto: 5_914_400, tarif: 0.5, idTku: "3172022407981234000000", tanggal: "2026-09-30", nama: "Ani Gaji" }]);
    expect(h.perluNik).toEqual(["Ani Gaji (NIK berakhiran 1234)"]);
    expect(h.dilewati).toEqual(["Beni Gaji: status PTKP belum diisi"]);
  });
  it("Desember dilewati: PPh 21 masa terakhir memakai Pasal 17, bukan TER", () => {
    const h = susunBpmp(data("2026-12-01"), { ter: TER, kategori: KATEGORI });
    expect(h.baris).toEqual([]);
    expect(h.dilewati[0]).toMatch(/Desember/);
  });
});

describe("bukuBpmp", () => {
  it("sheet DATA: NPWP di B1, judul baris 4 kolom B..N persis template v.3, data mulai baris 5, NIK kosong bercatatan", async () => {
    const h = susunBpmp(data(), { ter: TER, kategori: KATEGORI });
    const buf = await bukuBpmp("3172022407981234", h.baris);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.getWorksheet("DATA")!;
    expect(ws.getCell("A1").value).toBe("NPWP Pemotong");
    expect(ws.getCell("B1").value).toBe("3172022407981234");
    // Literal disalin dari sheet DATA template v.3 (bukan dari JUDUL_BPMP) supaya tes ini bisa merah tanpa berkas DJP.
    expect((ws.getRow(4).values as unknown[]).slice(2)).toEqual(["Masa Pajak", "Tahun Pajak", "Status Pegawai", "NPWP/NIK/TIN", "Nomor Passport", "Status", "Posisi",
      "Sertifikat/Fasilitas", "Kode Objek Pajak", "Penghasilan Kotor", "Tarif", "ID TKU", "Tgl Pemotongan"]);
    expect(ws.getCell("B5").value).toBe(9);
    expect(ws.getCell("C5").value).toBe(2026);
    expect(ws.getCell("E5").value ?? null).toBeNull();
    // exceljs tidak membaca catatan kembali; periksa berkas komentar di dalam zip xlsx.
    const isi = unzipSync(new Uint8Array(buf));
    const komentar = Object.entries(isi).filter(([n]) => /xl\/comments\d*\.xml$/.test(n)).map(([, v]) => strFromU8(v)).join("");
    expect(komentar).toContain("Isi NIK Ani Gaji");
    expect(komentar).toContain('ref="E5"');
    expect(ws.getCell("K5").value).toBe(5_914_400);
    expect(ws.getCell("L5").value).toBe(0.5);
    expect(ws.getCell("M5").value).toBe("3172022407981234000000");
    expect((ws.getCell("N5").value as Date).toISOString().slice(0, 10)).toBe("2026-09-30");
  });
  it.skipIf(!process.env.BPMP_TEMPLATE || !existsSync(process.env.BPMP_TEMPLATE ?? ""))("judul sama dengan template resmi DJP (BPMP_TEMPLATE)", async () => {
    const resmi = new ExcelJS.Workbook();
    await resmi.xlsx.readFile(process.env.BPMP_TEMPLATE!);
    const r = resmi.getWorksheet("DATA")!;
    expect((r.getRow(4).values as unknown[]).slice(2, 15)).toEqual([...JUDUL_BPMP]);
    expect(r.getCell("A1").value).toBe("NPWP Pemotong");
  });
});
