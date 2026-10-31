import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AMBANG_RAGU, AMBANG_YAKIN, SKEMA, pesan, penerima, rapikan, sensor, tindakan } from "../../../../supabase/functions/putuskan/inti";
import { bisaDibatalkan, labelKeputusan } from "./keputusan";

const AKAR = join(__dirname, "..", "..", "..", "..");

describe("inti putuskan", () => {
  it("rapikan menormalkan peluang dan memakai yakin terkecil", () => {
    const r = rapikan({ pilihan: "admin", peluang: { pemilik: 1, admin: 8, keduanya: 1 }, yakin: 0.95, alasan: `Stok harian ${String.fromCharCode(8212)} cukup admin.` });
    expect(r.peluang).toEqual({ pemilik: 0.1, admin: 0.8, keduanya: 0.1 });
    expect(r.yakin).toBe(0.8);
    expect(r.alasan).toBe("Stok harian , cukup admin.");
  });

  it("pilihan asing diganti pilihan berpeluang terbesar; peluang kosong jadi rata", () => {
    expect(rapikan({ pilihan: "staf", peluang: { pemilik: 0.2, admin: 0.1, keduanya: 0.7 }, yakin: 0.9 }).pilihan).toBe("keduanya");
    const kosong = rapikan({ pilihan: "pemilik", yakin: 2 });
    expect(kosong.peluang.pemilik).toBeCloseTo(1 / 3, 3);
    expect(kosong.yakin).toBeLessThan(AMBANG_RAGU);
  });

  it("ambang sama dengan rute_model_simpan di migrasi", () => {
    expect([tindakan(0.85), tindakan(0.849), tindakan(0.5), tindakan(0.499)]).toEqual(["ubah", "ragu", "ragu", "tetap"]);
    const sql = readFileSync(join(AKAR, "supabase", "migrations", "20261101004000_keputusan_model_pemilik.sql"), "utf8");
    expect(sql).toContain(`when p_yakin >= ${AMBANG_YAKIN} then 'ubah' when p_yakin >= ${AMBANG_RAGU} then 'ragu'`);
  });

  it("penerima akhir: hanya pemilik dengan yakin tinggi yang mempersempit rute; admin tetap saran", () => {
    expect(penerima({ pilihan: "pemilik", yakin: 0.9 })).toBe("pemilik");
    expect(penerima({ pilihan: "pemilik", yakin: 0.7 })).toBe("keduanya");
    expect(penerima({ pilihan: "admin", yakin: 0.99 })).toBe("keduanya");
  });

  it("sensor mengganti deret angka 8 digit atau lebih, termasuk yang dipisah spasi, titik, strip", () => {
    expect(sensor("NIK 3201234567890001, rek 123.456.7890, HP 0812-3456-7890")).toBe("NIK [angka], rek [angka], HP [angka]");
    expect(sensor("Stok gula 2 kg, total Rp1.250.000, 15 Nov")).toBe("Stok gula 2 kg, total Rp1.250.000, 15 Nov");
    expect(pesan({ judul: "Transfer ke 1234 5678 9012", aksi: "catatan" })).toBe("Aksi: catatan\nJudul: Transfer ke [angka]");
  });

  it("pesan hanya memuat aksi, judul, penjelasan; skema tanpa batas angka yang ditolak API", () => {
    const p = pesan({ judul: "Gas habis", aksi: "catatan", penjelasan: "  Tinggal satu tabung. " });
    expect(p).toBe("Aksi: catatan\nJudul: Gas habis\nPenjelasan: Tinggal satu tabung.");
    expect(JSON.stringify(SKEMA)).not.toMatch(/minimum|maximum|minLength|maxLength/);
    expect(SKEMA.additionalProperties).toBe(false);
  });
});

describe("label keputusan di kartu", () => {
  const dasar = { jenis: "usulan.rute", tingkat: "model", dibatalkan_at: null };

  it("rute model menyebut Nadi dan yakin dalam persen", () => {
    expect(labelKeputusan({ ...dasar, pilihan: "admin (saran)", yakin: 0.912 })).toBe("Saran Nadi: cukup admin, yakin 91%. Tetap ke pemilik dan admin");
    expect(labelKeputusan({ ...dasar, pilihan: "pemilik", yakin: 0.88 })).toBe("Dirute Nadi ke pemilik saja, yakin 88%");
    expect(labelKeputusan({ ...dasar, pilihan: "keduanya", yakin: 0.9 })).toBe("Dirute Nadi ke pemilik dan admin, yakin 90%");
    expect(labelKeputusan({ ...dasar, pilihan: "keduanya (ragu)", yakin: 0.7 })).toBe("Nadi ragu (yakin 70%), tetap ke pemilik dan admin");
  });

  it("tingkat aturan tidak memakai label model", () => {
    expect(labelKeputusan({ jenis: "izin.otopilot", tingkat: "aturan", pilihan: "setujui", yakin: 1, dibatalkan_at: null })).toBe("Aturan pasti");
  });

  it("tombol batal hanya untuk keputusan yang mengubah sesuatu", () => {
    expect(bisaDibatalkan({ ...dasar, pilihan: "pemilik", yakin: 0.9 })).toBe(true);
    expect(bisaDibatalkan({ ...dasar, pilihan: "admin (saran)", yakin: 0.99 })).toBe(false);
    expect(bisaDibatalkan({ ...dasar, pilihan: "keduanya (ragu)", yakin: 0.7 })).toBe(false);
    expect(bisaDibatalkan({ ...dasar, pilihan: "keduanya", yakin: 0.9 })).toBe(false);
    expect(bisaDibatalkan({ ...dasar, pilihan: "pemilik", yakin: 0.9, dibatalkan_at: "2026-11-01T01:00:00Z" })).toBe(false);
    expect(bisaDibatalkan({ jenis: "usulan.rute", tingkat: "aturan", pilihan: "pemilik_admin", yakin: 1, dibatalkan_at: null })).toBe(false);
    expect(bisaDibatalkan({ jenis: "usulan.rute", tingkat: "aturan", pilihan: "pemilik", yakin: 1, dibatalkan_at: null })).toBe(true);
    expect(bisaDibatalkan({ jenis: "izin.otopilot", tingkat: "aturan", pilihan: "setujui", yakin: 1, dibatalkan_at: null })).toBe(true);
  });
});
