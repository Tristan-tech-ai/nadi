import { describe, expect, it } from "vitest";
import { angkaIsian, capStatus, hariIni, jumlahHari, rentangTanggal, zonaSah } from "./izin";

describe("izin: tanggal dan isian", () => {
  it("hari ini mengikuti zona usaha di batas tengah malam (Q-24)", () => {
    // 31 Okt 23.30 WIB = 1 Nov 00.30 WITA: usaha WIB masih 31 Okt.
    expect(hariIni(new Date("2026-10-31T16:30:00Z"), "Asia/Jakarta")).toBe("2026-10-31");
    expect(hariIni(new Date("2026-10-31T16:30:00Z"), "Asia/Makassar")).toBe("2026-11-01");
    // 1 Nov 00.30 WIT = 31 Okt 23.30 WITA: usaha WIT sudah 1 Nov.
    expect(hariIni(new Date("2026-10-31T15:30:00Z"), "Asia/Jayapura")).toBe("2026-11-01");
    expect(hariIni(new Date("2026-10-31T15:30:00Z"), "Asia/Makassar")).toBe("2026-10-31");
  });
  it("zona usaha yang kosong atau tidak dikenal jatuh ke Asia/Jakarta seperti bawaan kolom", () => {
    expect(zonaSah("Asia/Jayapura")).toBe("Asia/Jayapura");
    expect(zonaSah(null)).toBe("Asia/Jakarta");
    expect(zonaSah("")).toBe("Asia/Jakarta");
    expect(zonaSah("Bukan/Zona")).toBe("Asia/Jakarta");
  });
  it("hari ini memakai zona yang diberikan, bukan UTC", () => {
    expect(hariIni(new Date("2026-10-31T17:30:00Z"), "Asia/Makassar")).toBe("2026-11-01");
    expect(hariIni(new Date("2026-10-31T15:30:00Z"), "Asia/Makassar")).toBe("2026-10-31");
  });
  it("23.30 lokal masih hari itu untuk usaha WIB dan WIT (Q-25)", () => {
    expect(hariIni(new Date("2026-10-31T16:30:00Z"), "Asia/Jakarta")).toBe("2026-10-31");
    expect(hariIni(new Date("2026-10-31T14:30:00Z"), "Asia/Jayapura")).toBe("2026-10-31");
  });
  it("zona wajib diisi pemanggil, tanpa bawaan WITA (Q-25)", () => expect(hariIni.length).toBe(2));
  it("jumlah hari termasuk hari pertama dan terakhir, juga lintas bulan dan tahun kabisat", () => {
    expect(jumlahHari("2026-11-03", "2026-11-03")).toBe(1);
    expect(jumlahHari("2026-11-30", "2026-12-02")).toBe(3);
    expect(jumlahHari("2028-02-28", "2028-03-01")).toBe(3);
    expect(jumlahHari("2026-11-05", "2026-11-03")).toBe(0);
    expect(jumlahHari("", "2026-11-03")).toBe(0);
  });
  it("rentang tanggal ringkas sesuai VOICE", () => {
    expect(rentangTanggal("2026-11-03", "2026-11-03")).toBe("3 Nov 2026");
    expect(rentangTanggal("2026-11-03", "2026-11-05")).toBe("3 sampai 5 Nov 2026");
    expect(rentangTanggal("2026-11-30", "2026-12-02")).toBe("30 Nov sampai 2 Des 2026");
    expect(rentangTanggal("2026-12-30", "2027-01-02")).toBe("30 Des 2026 sampai 2 Jan 2027");
  });
  it("status pengajuan menjadi cap dengan teks", () => {
    expect(capStatus("disetujui")).toEqual({ jenis: "diterima", label: "Disetujui" });
    expect(capStatus("ditolak")).toEqual({ jenis: "ditolak", label: "Belum disetujui" });
    expect(capStatus("menunggu").jenis).toBe("menunggu");
  });
  it("angka isian: kosong = tanpa batas, di luar rentang atau bukan angka = salah", () => {
    expect(angkaIsian("", 0, 30)).toBeNull();
    expect(angkaIsian(" 2 ", 0, 30)).toBe(2);
    expect(angkaIsian("31", 0, 30)).toBe("salah");
    expect(angkaIsian("1,5", 0, 30)).toBe("salah");
    expect(angkaIsian(null, 0, 30)).toBeNull();
  });
});
