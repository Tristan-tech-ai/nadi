import { describe, expect, it } from "vitest";
import {
  BELUM_CUKUP, banding, bandingTepat, kalimatLintas, kalimatPoin, kalimatTepat, kataBilangan, namaHari, teksBanding, teksNaikTurun, ukuranKpi,
  type Kpi, type RincianKerja,
} from "./kpi";

// Bentuk data sama dengan keluaran public.kpi_saya (supabase/tests/kpi.test.sql: Sari, minggu 19 Okt 2026).
const kerja = (id: string, judul: string, poin: number, tanggal: string, lain: Partial<RincianKerja> = {}): RincianKerja => ({
  id, judul, poin, tanggal, selesai_at: `${tanggal}T05:00:00+00:00`, tenggat: null, lewat_menit: null, lintas_topi: false, banding: null, ...lain,
});
const rincian = [
  kerja("k1", "Cek stok beras", 2, "2026-10-20", { lewat_menit: 40, tenggat: "2026-10-20T03:00:00+00:00" }),
  kerja("k2", "Tutup kas", 1, "2026-10-21", { tenggat: "2026-10-21T15:00:00+00:00" }),
  kerja("k5", "Cuci gelas", 1, "2026-10-22", { lintas_topi: true }),
  kerja("k3", "Setor kas", 3, "2026-10-23", { lewat_menit: 60, tenggat: "2026-10-23T10:00:00+00:00" }),
  kerja("k4", "Rekap Minggu malam", 1, "2026-10-25"),
];
const sari = (ubah: Partial<Kpi> = {}): Kpi => ({
  id: "o1", nama: "Sari",
  poin_selesai: { nilai: 8, kerja: 5, ids: ["k1", "k2", "k5", "k3", "k4"], kosong: null },
  tepat: {
    nilai: 1, dari: 3, ids: ["k1", "k2", "k3"], kosong: null,
    lewat: [{ id: "k1", judul: "Cek stok beras", lewat_menit: 40, tanggal: "2026-10-20" }, { id: "k3", judul: "Setor kas", lewat_menit: 60, tanggal: "2026-10-23" }],
  },
  lintas: { nilai: 1, kerja: 1, ids: ["k5"], kosong: null },
  hadir: { nilai: null, alasan: "Hadir sesuai jadwal muncul setelah jadwal shift diisi." },
  minggu_lalu: { poin_selesai: 4, kerja: 1, tepat: 1, bertenggat: 1, lintas_poin: 0 },
  rincian,
  ...ubah,
});
const kosong = (): Kpi => sari({
  poin_selesai: { nilai: 0, kerja: 0, ids: [], kosong: "Belum ada kerja selesai minggu ini." },
  tepat: { nilai: 0, dari: 0, ids: [], lewat: [], kosong: "Belum ada kerja bertenggat yang selesai minggu ini." },
  lintas: { nilai: 0, kerja: 0, ids: [], kosong: "Belum ada kerja lintas topi minggu ini." },
  minggu_lalu: { poin_selesai: 0, kerja: 0, tepat: 0, bertenggat: 0, lintas_poin: 0 },
  rincian: [],
});

describe("kalimat penjelasan dari data SQL", () => {
  it("tepat tenggat menyebut judul, hari, dan lama lewat (contoh kpi-cermin.md)", () => {
    expect(kalimatTepat(sari().tepat)).toBe("Tepat tenggat 1 dari 3. Dua yang lewat: Cek stok beras (Selasa, lewat 40 menit), Setor kas (Jumat, lewat 1 jam).");
  });
  it("semua tepat: tidak ada yang lewat", () => {
    expect(kalimatTepat({ nilai: 3, dari: 3, ids: ["a", "b", "c"], lewat: [], kosong: null })).toBe("Tepat tenggat 3 dari 3. Tidak ada yang lewat.");
  });
  it("lebih dari tiga yang lewat: sisanya dihitung, bukan disembunyikan", () => {
    const lewat = ["A", "B", "C", "D", "E"].map((j, i) => ({ id: j, judul: j, lewat_menit: 5 + i, tanggal: "2026-10-19" }));
    expect(kalimatTepat({ nilai: 5, dari: 10, ids: [], lewat, kosong: null }))
      .toBe("Tepat tenggat 5 dari 10. Lima yang lewat: A (Senin, lewat 5 menit), B (Senin, lewat 6 menit), C (Senin, lewat 7 menit), dan 2 lainnya.");
  });
  it("poin menyebut kerja terbesar lebih dulu", () => {
    expect(kalimatPoin(sari().poin_selesai, rincian))
      .toBe("8 poin dari 5 kerja selesai: Setor kas (3 poin), Cek stok beras (2 poin), Tutup kas (1 poin), dan 2 lainnya.");
  });
  it("lintas topi selalu sebagai bantuan", () => {
    expect(kalimatLintas(sari().lintas, rincian)).toBe("1 poin dari 1 kerja lintas topi: Cuci gelas. Dihitung sebagai bantuan, tidak mengurangi angka lain.");
  });
  it("nol: teks belum ada dari SQL", () => {
    const k = kosong();
    expect(kalimatPoin(k.poin_selesai, [])).toBe("Belum ada kerja selesai minggu ini.");
    expect(kalimatTepat(k.tepat)).toBe("Belum ada kerja bertenggat yang selesai minggu ini.");
    expect(kalimatLintas(k.lintas, [])).toBe("Belum ada kerja lintas topi minggu ini.");
  });
  it("nama hari dan bilangan", () => {
    expect(["2026-10-19", "2026-10-25"].map(namaHari)).toEqual(["Senin", "Minggu"]);
    expect([1, 2, 10, 11].map(kataBilangan)).toEqual(["Satu", "Dua", "Sepuluh", "11"]);
  });
});

describe("naik/turun dan ambang pembanding", () => {
  it("teks naik/turun", () => {
    expect([6, -2.5, 0].map(teksNaikTurun)).toEqual(["naik 6", "turun 2,5", "sama"]);
  });
  it("kurang dari 5 kerja selesai di salah satu minggu: pembanding disembunyikan", () => {
    expect(banding(12, 6, 5, 4)).toEqual({ teks: BELUM_CUKUP, arah: null });
    expect(banding(12, 6, 4, 9)).toEqual({ teks: BELUM_CUKUP, arah: null });
    expect(BELUM_CUKUP).toBe("belum cukup kerja untuk dibandingkan");
  });
  it("cukup kerja: naik 6 poin dari minggu lalu", () => {
    expect(banding(12, 6, 5, 5, " poin")).toEqual({ teks: "naik 6 poin dari minggu lalu", arah: "naik" });
    expect(banding(6, 6, 5, 5)).toEqual({ teks: "sama dengan minggu lalu", arah: "sama" });
  });
  it("tepat tenggat dibanding dalam persen kedua minggu", () => {
    expect(bandingTepat(80, 70, 6, 7)).toEqual({ teks: "naik dari 70% ke 80%", arah: "naik" });
    expect(bandingTepat(60, 70, 6, 7)).toEqual({ teks: "turun dari 70% ke 60%", arah: "turun" });
    expect(bandingTepat(null, 70, 6, 7)).toBeNull();
  });
});

describe("empat ukuran", () => {
  it("urut layar, setiap ukuran bernilai membawa id kerjanya; hadir belum dihitung", () => {
    const u = ukuranKpi(sari(), null);
    expect(u.map((x) => x.label)).toEqual(["Kerja selesai", "Tepat tenggat", "Kerja lintas topi", "Hadir sesuai jadwal"]);
    expect(u.map((x) => x.angka)).toEqual(["8 poin", "1 dari 3", "1 poin", "Belum dihitung"]);
    expect(u[0].ids).toHaveLength(5);
    expect(u[1].ids).toEqual(["k1", "k2", "k3"]);
    expect(u[3]).toMatchObject({ ids: [], penjelasan: "Hadir sesuai jadwal muncul setelah jadwal shift diisi." });
    // Minggu lalu hanya 1 kerja: pembanding disembunyikan.
    expect(u[0].banding).toEqual({ teks: BELUM_CUKUP, arah: null });
    expect(u[2].banding).toBeNull();
  });
  it("rata-rata tim hanya bila ada dari SQL (n >= 3)", () => {
    expect(ukuranKpi(sari(), null)[0].rata).toBe("Rata-rata tim tampil bila minimal 3 orang punya kerja selesai minggu ini.");
    const tim = { n: 3, poin_selesai: 4.7, lintas_poin: 0.3, tepat_persen: null };
    const u = ukuranKpi(sari(), tim);
    expect(u[0].rata).toBe("Rata-rata tim 4,7 poin.");
    expect(u[1].rata).toBeNull();
  });
  it("tanpa kerja: angka 0 dengan teks, tanpa pembanding tepat", () => {
    const u = ukuranKpi(kosong(), null);
    expect(u.map((x) => x.angka)).toEqual(["0 poin", "Belum ada", "0 poin", "Belum dihitung"]);
    expect(u[0].penjelasan).toBe("Belum ada kerja selesai minggu ini.");
    expect(u[1].banding).toBeNull();
  });
  it("status banding tanpa menyalahkan", () => {
    expect(teksBanding("menunggu")).toBe("Sudah ditandai keliru, menunggu pemilik.");
    expect(teksBanding(null)).toBeNull();
  });
});
