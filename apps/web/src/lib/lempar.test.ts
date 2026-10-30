import { describe, expect, it } from "vitest";
import { mimeBerkas, sha256Hex, ukuranKompres } from "./lempar";

describe("mimeBerkas", () => {
  it("memakai tipe browser bila dikenal", () => {
    expect(mimeBerkas("nota.jpg", "image/jpeg")).toBe("image/jpeg");
  });
  it("menebak dari ekstensi saat tipe kosong atau keliru (CSV di Windows, xlsx tanpa tipe)", () => {
    expect(mimeBerkas("mutasi.csv", "application/vnd.ms-excel")).toBe("text/csv");
    expect(mimeBerkas("Karyawan.XLSX", "")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  });
  it("menolak jenis yang tidak bisa dibaca", () => {
    expect(mimeBerkas("foto.heic", "image/heic")).toBeNull();
    expect(mimeBerkas("program.exe", "application/x-msdownload")).toBeNull();
  });
});

describe("ukuranKompres", () => {
  it("foto 4000x3000 diperkecil ke sisi terpanjang 2000", () => {
    expect(ukuranKompres(4000, 3000)).toEqual({ lebar: 2000, tinggi: 1500 });
  });
  it("foto potret dan foto kecil", () => {
    expect(ukuranKompres(3024, 4032)).toEqual({ lebar: 1500, tinggi: 2000 });
    expect(ukuranKompres(800, 600)).toEqual({ lebar: 800, tinggi: 600 });
  });
});

describe("sha256Hex", () => {
  it("sidik isi kosong sesuai standar", async () => {
    expect(await sha256Hex(new ArrayBuffer(0))).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
});
