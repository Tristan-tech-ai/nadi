import { describe, expect, it } from "vitest";
import {
  bacaKolom, bacaPoin, formatMenit, formatPoin, formatTenggat, menitDariPoin, pilihStaf, poinDariMenit, ringkasStatus, teksPoin, teksSelesai,
  type KerjaPapan,
} from "./poin";

const kerja = (id: string, status: KerjaPapan["status"], lain: Partial<KerjaPapan> = {}): KerjaPapan => ({
  id, judul: `Kerja ${id}`, status, poin: null, tenggat: null, mulai_at: null, selesai_at: null, lintas_topi: false,
  estimasi: null, aktual_menit: null, jeda_menit: null, topi: null, pelaksana: null, saya: true, ...lain,
});

describe("poin beban: 1 poin = 15 menit, bulat 0,25", () => {
  it("dibulatkan ke kelipatan 0,25 terdekat (sama dengan app.poin_dari_menit)", () => {
    expect(poinDariMenit(15)).toBe(1);
    expect(poinDariMenit(22)).toBe(1.5);
    expect(poinDariMenit(40)).toBe(2.75);
    expect(poinDariMenit(30)).toBe(2);
    expect(poinDariMenit(5.625)).toBe(0.5); // 5,625 / 3,75 = 1,5, dibulatkan ke atas -> 2 x 0,25
  });
  it("paling kecil 0,25 dan paling besar 99", () => {
    expect(poinDariMenit(0.3)).toBe(0.25);
    expect(poinDariMenit(0)).toBe(0.25);
    expect(poinDariMenit(5000)).toBe(99);
  });
  it("menit dari poin", () => {
    expect(menitDariPoin(2)).toBe(30);
    expect(menitDariPoin(0.25)).toBe(3.75);
  });
  it("membaca isian poin dengan koma, menolak di luar 0,25..99", () => {
    expect(bacaPoin("2")).toBe(2);
    expect(bacaPoin("1,5")).toBe(1.5);
    expect(bacaPoin(" 0,25 ")).toBe(0.25);
    expect(bacaPoin("1.3")).toBe(1.25);
    expect(bacaPoin("0")).toBeNull();
    expect(bacaPoin("100")).toBeNull();
    expect(bacaPoin("dua")).toBeNull();
    expect(bacaPoin("")).toBeNull();
  });
  it("format poin memakai koma desimal", () => {
    expect(formatPoin(2)).toBe("2 poin");
    expect(formatPoin(1.25)).toBe("1,25 poin");
    expect(formatPoin(0.5)).toBe("0,5 poin");
  });
});

describe("durasi dan teks", () => {
  it("format menit (sama dengan app.teks_menit)", () => {
    expect(formatMenit(0.4)).toBe("kurang dari 1 menit");
    expect(formatMenit(42)).toBe("42 menit");
    expect(formatMenit(59.6)).toBe("1 jam");
    expect(formatMenit(65)).toBe("1 jam 5 menit");
  });
  it("selesai dengan perkiraan: 42 menit (perkiraan 30)", () => {
    expect(teksSelesai(42, 30)).toBe("Selesai dalam 42 menit (perkiraan 30)");
    expect(teksSelesai(0.2, 30)).toBe("Selesai dalam kurang dari 1 menit (perkiraan 30)");
    expect(teksSelesai(70, 90)).toBe("Selesai dalam 1 jam 10 menit (perkiraan 1 jam 30 menit)");
    expect(teksSelesai(42, null)).toBe("Selesai dalam 42 menit");
    expect(teksSelesai(null, 30)).toBe("Selesai");
  });
  it("teks poin menurut sumber, jujur bila belum ada", () => {
    expect(teksPoin(null)).toBe("Poin belum diperkirakan; isi manual");
    expect(teksPoin({ menit: 30, poin: 2, sumber: "riwayat", alasan: "x", faktor: null, n: 5 })).toBe("2 poin, dari 5 kerja serupa");
    expect(teksPoin({ menit: 30, poin: 2, sumber: "model", alasan: "x", faktor: 1.2, n: 4 })).toBe("2 poin, perkiraan model");
    expect(teksPoin({ menit: 19, poin: 1.25, sumber: "manual", alasan: "x", faktor: null, n: null })).toBe("1,25 poin, diisi manual");
  });
  it("tenggat: Hari ini / Besok / tanggal, jam WITA tanpa zona", () => {
    const sekarang = new Date("2026-11-01T02:00:00Z"); // 1 Nov 10.00 WITA
    const z = "Asia/Makassar";
    expect(formatTenggat("2026-11-01T07:00:00Z", sekarang, z)).toBe("Hari ini, 15.00");
    expect(formatTenggat("2026-11-02T01:30:00Z", sekarang, z)).toBe("Besok, 09.30");
    expect(formatTenggat("2026-10-31T01:30:00Z", sekarang, z)).toBe("Kemarin, 09.30");
    expect(formatTenggat("2026-11-05T01:30:00Z", sekarang, z)).toBe("5 Nov, 09.30");
    expect(formatTenggat("2027-01-05T01:30:00Z", sekarang, z)).toBe("5 Jan 2027, 09.30");
  });
  it("tenggat di zona usaha WIB dan WIT pada 23.30 lokal (Q-25)", () => {
    // 31 Okt 23.30 WIB; tenggat 17.00 WIB besok = 1 Nov 10.00 UTC.
    const wib = new Date("2026-10-31T16:30:00Z");
    expect(formatTenggat("2026-11-01T10:00:00Z", wib, "Asia/Jakarta")).toBe("Besok, 17.00");
    expect(formatTenggat("2026-10-31T16:45:00Z", wib, "Asia/Jakarta")).toBe("Hari ini, 23.45");
    // 31 Okt 23.30 WIT; tenggat 1 Nov 08.00 WIT = 31 Okt 23.00 UTC.
    const wit = new Date("2026-10-31T14:30:00Z");
    expect(formatTenggat("2026-10-31T23:00:00Z", wit, "Asia/Jayapura")).toBe("Besok, 08.00");
    expect(formatTenggat("2026-10-31T14:45:00Z", wit, "Asia/Jayapura")).toBe("Hari ini, 23.45");
  });
  it("zona wajib diisi pemanggil, tanpa bawaan WITA (Q-25)", () => expect(formatTenggat.length).toBe(3));
});

describe("papan", () => {
  const daftar = [
    kerja("a", "baru", { tenggat: "2026-11-01T09:00:00Z" }), kerja("b", "jalan"), kerja("c", "tunggu"), kerja("d", "selesai"),
    kerja("e", "baru"), kerja("f", "baru"), kerja("g", "baru"), kerja("h", "baru"), kerja("i", "baru"), kerja("j", "baru"),
  ];
  it("ringkasan jumlah per status", () => {
    expect(ringkasStatus(daftar)).toEqual({ baru: 7, jalan: 1, tunggu: 1, review: 0, selesai: 1 }); // X-11 menambah review
  });
  it("staf: kerja jalan didahulukan, lalu tunggu, lalu baru; berikutnya paling banyak 5", () => {
    const s = pilihStaf(daftar);
    expect(s.aktif?.id).toBe("b");
    expect(s.berikutnya.map((k) => k.id)).toEqual(["c", "a", "e", "f", "g"]);
    expect(s.selesai.map((k) => k.id)).toEqual(["d"]);
    expect(pilihStaf([kerja("x", "selesai")]).aktif).toBeNull();
    expect(pilihStaf([kerja("y", "tunggu"), kerja("z", "baru")]).aktif?.id).toBe("y");
  });
  it("kolom dari parameter, bawaan baru", () => {
    expect(bacaKolom(undefined)).toBe("baru");
    expect(bacaKolom("selesai")).toBe("selesai");
    expect(bacaKolom(["tunggu", "jalan"])).toBe("tunggu");
    expect(bacaKolom("batal")).toBe("baru");
  });
});

describe("teks kerja bahasa Inggris", () => {
  it("poin, menit, selesai, dan tenggat", async () => {
    const { formatPoin, formatMenit, teksSelesai, teksPoin, formatTenggat } = await import("./poin");
    expect(formatPoin(1.5, "en")).toBe("1.5 points");
    expect(formatPoin(1, "en")).toBe("1 point");
    expect(formatMenit(65, "en")).toBe("1 h 5 min");
    expect(teksSelesai(42, 30, "en")).toBe("Done in 42 min (estimate 30)");
    expect(teksPoin(null, "en")).toBe("Points not estimated yet; fill in manually");
    expect(formatTenggat("2026-11-05T02:30:00Z", new Date("2026-11-04T02:00:00Z"), "Asia/Makassar", "en")).toBe("Tomorrow, 10:30");
    expect(formatTenggat("2026-11-05T02:30:00Z", new Date("2026-11-04T02:00:00Z"), "Asia/Makassar")).toBe("Besok, 10.30");
  });
});

describe("teksTim (X-10)", () => {
  it("satu pelaksana: null; tim: PIC dulu dengan porsi", async () => {
    const { teksTim } = await import("./poin");
    expect(teksTim(undefined)).toBeNull();
    expect(teksTim([{ id: "a", nama: "Sari", porsi: 100, pic: true }])).toBeNull();
    expect(teksTim([{ id: "a", nama: "Sari", porsi: 60, pic: true }, { id: "b", nama: "Budi", porsi: 40, pic: false }])).toBe("Sari 60% (PIC), Budi 40%");
    expect(teksTim([{ id: "a", nama: null, porsi: 50, pic: true }, { id: "b", nama: "Budi", porsi: 50, pic: false }], "en")).toBe("someone 50% (PIC), Budi 50%");
  });
});
