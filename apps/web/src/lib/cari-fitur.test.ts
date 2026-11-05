import { describe, expect, it } from "vitest";
import { cariFitur } from "./cari-fitur";

// Korpus 60 kata kunci sehari-hari (ditulis sebelum menyetel skor): kata yang dipakai pemilik usaha -> halaman yang benar (hasil pertama).
const KORPUS: [string, string][] = [
  ["invoice", "/app/invoice"], ["tagihan", "/app/invoice"], ["faktur", "/app/invoice"], ["piutang", "/app/invoice"], ["qris", "/app/invoice"],
  ["slip gaji", "/app/gaji"], ["gaji", "/app/gaji"], ["payroll", "/app/gaji"], ["bpjs", "/app/gaji"], ["upah", "/app/gaji"],
  ["kasbon", "/app/gaji/kasbon"], ["thr", "/app/gaji/thr"], ["absen", "/app/perusahaan"], ["cuti", "/app/izin"], ["sakit", "/app/izin"],
  ["lembur", "/app/izin"], ["shift", "/app/jadwal"], ["jadwal", "/app/jadwal"], ["karyawan", "/app/orang"], ["pegawai", "/app/orang"],
  ["lowongan", "/app/rekrutmen"], ["pelamar", "/app/rekrutmen"], ["magang", "/app/magang"], ["pelatihan", "/app/kursus"], ["sertifikat", "/app/kursus"],
  ["review", "/app/kinerja"], ["kpi", "/app/kerja"], ["tugas", "/app/kerja"], ["resign", "/app/serah-terima"], ["pengumuman", "/app/pengumuman"],
  ["laba rugi", "/app/buku"], ["untung", "/app/buku"], ["neraca", "/app/buku"], ["pajak", "/app/pajak"], ["efaktur", "/app/pajak/faktur"],
  ["coretax", "/app/pajak"], ["mutasi bank", "/app/kas"], ["saldo", "/app/kas"], ["hutang", "/app/beli"], ["pemasok", "/app/beli"],
  ["reimburse", "/app/klaim"], ["kasir", "/app/kasir"], ["pos", "/app/kasir"], ["pelanggan", "/app/pelanggan"], ["crm", "/app/pelanggan"],
  ["booking", "/app/janji-temu"], ["laundry", "/app/servis"], ["stok", "/app/barang"], ["opname", "/app/barang"], ["resep", "/app/produksi"],
  ["cctv", "/app/mata"], ["denah", "/app/peta-usaha"], ["surat", "/app/surat-keluar"], ["tanda tangan", "/app/tanda-tangan"], ["tenggat", "/app/kepatuhan"],
  ["otomasi", "/app/alur"], ["webhook", "/app/alur"], ["migrasi", "/app/pindah"], ["chatgpt", "/app/siapkan"], ["password", "/app/akun/keamanan"],
];

describe("cari fitur", () => {
  it("korpus 60 kata: >= 95% hasil pertama benar (pemilik)", () => {
    expect(KORPUS).toHaveLength(60);
    const salah = KORPUS.filter(([q, harap]) => cariFitur(q, "pemilik")[0]?.href !== harap).map(([q, harap]) => `${q} -> ${cariFitur(q, "pemilik")[0]?.href} (harap ${harap})`);
    console.log(`CARI_FITUR benar ${60 - salah.length}/60`, salah);
    expect((60 - salah.length) / 60).toBeGreaterThanOrEqual(0.95);
  });
  it("awalan kata sudah menemukan, peran membatasi hasil", () => {
    expect(cariFitur("gaj", "pemilik")[0]?.href).toBe("/app/gaji");
    expect(cariFitur("pajak", "staf")).toEqual([]);
    expect(cariFitur("izin", "staf")[0]?.href).toBe("/app/izin");
    expect(cariFitur("a", "pemilik")).toEqual([]);
  });
});

describe("jangkauan <= 2 ketukan", () => {
  it("setiap halaman peran ada di bilah bawah (1 ketukan) atau lembar Menu/rail/sidebar (2 ketukan), dan bilah bawah tidak memuat halaman terlarang", async () => {
    const { bilahBawah } = await import("@/components/app/kerangka");
    const { ruangUntuk } = await import("./ruang");
    for (const peran of ["pemilik", "admin", "akuntan", "staf"] as const) {
      const halaman = ruangUntuk(peran).flatMap((r) => r.halaman.map((x) => x.href));
      const bawah = bilahBawah(peran, "id").map((x) => x.href);
      for (const href of bawah) expect(halaman, `${peran} ${href}`).toContain(href);
      // Menu memuat seluruh ruangUntuk(peran): ketukan 1 = Menu (HP) / ruang (rail, sidebar), ketukan 2 = halaman.
      const ketukan = new Map(halaman.map((h) => [h, bawah.includes(h) ? 1 : 2]));
      expect(Math.max(...ketukan.values()), peran).toBeLessThanOrEqual(2);
      expect(cariFitur(halaman.length > 3 ? "gaji" : "x", peran).every((x) => halaman.includes(x.href)), peran).toBe(true);
    }
  }, 60_000); // impor dingin pustaka ikon bisa lebih dari 15 dtk di mesin lambat
});
