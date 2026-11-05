import { describe, expect, it } from "vitest";
import { bacaPilihan, keCsv, selCsv } from "./laporan";

describe("bacaPilihan", () => {
  it("sumber tak dikenal jatuh ke orang dengan semua kolom", () => {
    expect(bacaPilihan({ sumber: "slip_gaji" })).toEqual({ sumber: "orang", kolom: ["nama", "jenis", "status", "telepon", "email", "dibuat_at"], cari: "" });
  });
  it("kolom di luar daftar putih dibuang, urutan mengikuti daftar", () => {
    expect(bacaPilihan({ sumber: "invoice", kolom: ["total", "pelanggan", "baris", "kode_verifikasi", "total"] }).kolom).toEqual(["pelanggan", "total"]);
    expect(bacaPilihan({ sumber: "produk", kolom: "harga_jual,nama,perusahaan_id" }).kolom).toEqual(["nama", "harga_jual"]);
  });
  it("ganti sumber: kolom sumber lama tidak dibawa walau namanya sama", () => {
    expect(bacaPilihan({ sumber: "invoice", asal: "orang", kolom: ["nama", "status"] }).kolom).toEqual(["nomor", "pelanggan", "tanggal", "jatuh_tempo", "total", "status", "lunas_tanggal"]);
    expect(bacaPilihan({ sumber: "invoice", asal: "invoice", kolom: ["status"] }).kolom).toEqual(["status"]);
  });
  it("kata saring dibersihkan dari karakter operator PostgREST dan dipotong", () => {
    expect(bacaPilihan({ cari: "Bu%di,or(nama.eq.x)" }).cari).toBe("Bu di or nama.eq.x");
    expect(bacaPilihan({ cari: "a".repeat(90) }).cari).toHaveLength(60);
  });
});

describe("CSV", () => {
  it("rumus Excel dinetralkan, pemisah dan kutip di-escape, larik digabung", () => {
    expect(selCsv("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(selCsv("-10")).toBe("'-10");
    expect(selCsv(-10)).toBe("-10");
    expect(selCsv(["karyawan", "magang"])).toBe("karyawan, magang");
    expect(selCsv("Toko; Jaya")).toBe("\"Toko; Jaya\"");
    expect(selCsv(null)).toBe("");
  });
  it("judul dari kamus, baris per data", () => {
    expect(keCsv([{ nama: "Budi", status: "aktif" }], ["nama", "status"], { nama: "Nama", status: "Status" })).toBe("Nama;Status\r\nBudi;aktif\r\n");
  });
});
