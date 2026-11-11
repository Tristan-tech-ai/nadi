import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BANK_SKN, berkasPayroll, periksaPayroll } from "./transfer";

const resmi = (n: string) => readFileSync(join(__dirname, "../../../../../fixtures/korpus/transfer/resmi", n), "utf8");

describe("berkas payroll CIMB Niaga OCTO Biz (M-10B)", () => {
  it("contoh resmi inhouse dan SKN lolos pemeriksa", () => {
    const a = periksaPayroll("inhouse", resmi("payroll-inhouse.csv"));
    expect(a).toMatchObject({ ok: true, total: 80000, baris: 8 });
    const b = periksaPayroll("skn", resmi("payroll-skn.csv"));
    expect(b.galat).toEqual([]);
    expect(b).toMatchObject({ ok: true, total: 80000, baris: 8 });
  });

  it("akhir baris LF, CRLF, dan BOM UTF-8 sama-sama diterima (CI Linux membaca LF, Excel Windows menulis CRLF)", () => {
    for (const [jalur, nama] of [["inhouse", "payroll-inhouse.csv"], ["skn", "payroll-skn.csv"]] as const) {
      const lf = resmi(nama).replace(/\r\n/g, "\n");
      const crlf = lf.replace(/\n/g, "\r\n");
      for (const isi of [lf, crlf, "﻿" + crlf, lf.replace(/\n$/, "")]) {
        const h = periksaPayroll(jalur, isi);
        expect(h.galat, `${nama} ${JSON.stringify(isi.slice(-4))}`).toEqual([]);
        expect(h).toMatchObject({ ok: true, total: 80000, baris: 8 });
      }
    }
  });

  it("susunan Nadi sama dengan urutan kolom contoh resmi", () => {
    const csv = berkasPayroll("inhouse", { rekening: "8001213123456", nama: "Terlalu Manis", tanggal: "2025-06-24", keterangan: "Payroll Inhouse" }, [
      { rekening: "800153423700", nama: "Terlalu Manis", jumlah: 100000, keterangan: "Payroll inhouse1" },
      { rekening: "800153423700", nama: "Terlalu Manis", jumlah: 410000, keterangan: "Payroll inhouse1" },
    ]);
    expect(csv.split("\r\n")[0]).toBe("8001213123456,TERLALU MANIS,IDR,510000,Payroll Inhouse,2,20250624,");
    expect(csv.split("\r\n")[1]).toBe("800153423700,TERLALU MANIS,IDR,100000,Payroll inhouse1,,");
    expect(periksaPayroll("inhouse", csv)).toMatchObject({ ok: true, total: 510000, baris: 2 });
  });

  it("SKN: nama bank dari daftar resmi, Y/N, jenis penerima perorangan", () => {
    expect(BANK_SKN.length).toBe(133);
    const csv = berkasPayroll("skn", { rekening: "763340048300", nama: "Warung Sari, Denpasar", tanggal: "2026-11-25" }, [
      { rekening: "1234567890", nama: "Komang Ayu", jumlah: 2_750_000, bank: "BANK MANDIRI" },
      { rekening: "0987654321", nama: "Made \"Dek\" Wira", jumlah: 3_100_000, bank: "BCA (BANK CENTRAL ASIA)", keterangan: "Gaji Nov 2026" },
    ]);
    const [h, b1, b2] = csv.split("\r\n");
    expect(h).toBe("763340048300,WARUNG SARI DENPASAR,IDR,5850000, ,2,20261125,");
    expect(b1).toBe("1234567890,KOMANG AYU,IDR,2750000, ,BANK MANDIRI,Y,Y,,1,");
    expect(b2.split(",")[1]).toBe("MADE DEK WIRA");
    expect(periksaPayroll("skn", csv)).toMatchObject({ ok: true, peringatan: [] });
  });

  it("menolak masukan salah sebelum berkas dibuat", () => {
    expect(() => berkasPayroll("skn", { rekening: "123", nama: "A", tanggal: "2026-11-25" }, [{ rekening: "12a", nama: "B", jumlah: 0.5, bank: "BANK ANTAH" }])).toThrow(/Rekening sumber.*rekening harus angka.*rupiah bulat.*daftar SKN/);
  });

  it("pemeriksa menangkap total dan jumlah baris yang tidak cocok (gerbang bisa merah)", () => {
    const rusak = resmi("payroll-inhouse.csv").replace("IDR,80000,", "IDR,80001,").replace(",8,20260824", ",7,20260824");
    const h = periksaPayroll("inhouse", rusak);
    expect(h.ok).toBe(false);
    expect(h.galat.join(" ")).toMatch(/menyebut 7 baris.*Total header 80001/);
  });
});
