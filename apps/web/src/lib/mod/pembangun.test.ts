import { describe, expect, it } from "vitest";
import { periksaManifest } from "./pengawas";
import { kodeIsian, kodeMod, periksaRancangan, susunManifest, TIPE_PEMBANGUN, type Rancangan } from "./pembangun";

const dasar = (): Rancangan => ({
  nama: "Jadwal piket", deskripsi: "", ikon: "daftar-cek", ruang: "tempat",
  koleksi: [{ nama: "Piket", status: "Belum, Dikerjakan, Selesai", staf: "milik_sendiri", akuntan: "lihat", isian: [
    { label: "Nama tugas", tipe: "teks", wajib: true, pilihan: "" },
    { label: "Petugas", tipe: "orang", wajib: true, pilihan: "" },
    { label: "Tanggal", tipe: "tanggal", wajib: false, pilihan: "" },
  ] }],
});

describe("pembangun mod tanpa JSON (X-16)", () => {
  it("rancangan 3 isian dengan status menjadi manifest yang lolos pengawas", () => {
    const m = susunManifest(dasar());
    expect(periksaManifest(m)).toEqual([]);
    expect(m.kode).toBe("jadwal-piket");
    const k = m.koleksi[0];
    expect(k.judul).toBe("nama_tugas");
    expect(k.bidang.find((b) => b.kode === "petugas")).toMatchObject({ tipe: "orang", penugasan: true, wajib: true });
    expect(k.status?.daftar.map((s) => s.kode)).toEqual(["belum", "dikerjakan", "selesai"]);
    expect(k.status?.daftar[2].akhir).toBe(true);
    expect(k.status?.transisi).toEqual([
      { dari: ["belum"], ke: "dikerjakan", peran: ["pemilik", "admin", "ditugaskan"], label: "Dikerjakan" },
      { dari: ["dikerjakan"], ke: "selesai", peran: ["pemilik", "admin", "ditugaskan"], label: "Selesai" },
    ]);
    expect(k.tampilan.map((t) => t.jenis)).toEqual(["daftar", "papan", "kalender", "formulir", "rincian"]);
  });

  it("semua tipe di formulir menghasilkan manifest sah; tanpa status tidak ada papan; akses kelola diturunkan ke tulis", () => {
    const r = dasar();
    r.koleksi[0].status = "";
    r.koleksi[0].staf = "kelola";
    r.koleksi[0].isian = TIPE_PEMBANGUN.map((t, i) => ({ label: `Isian ${i} ${t.label}`, tipe: t.tipe, wajib: false, pilihan: "Satu, Dua, Dua, Tiga" }));
    const m = susunManifest(r);
    expect(periksaManifest(m)).toEqual([]);
    expect(m.koleksi[0].tampilan.some((t) => t.jenis === "papan")).toBe(false);
    expect(m.koleksi[0].akses.staf).toBe("tulis");
    expect(m.koleksi[0].bidang.find((b) => b.tipe === "pilihan")?.pilihan?.map((p) => p.label)).toEqual(["Satu", "Dua", "Tiga"]);
  });

  it("tanpa orang yang ditugaskan, staf boleh memindah status; beberapa bagian dengan nama sama tetap unik", () => {
    const r = dasar();
    r.koleksi[0].isian = r.koleksi[0].isian.filter((x) => x.tipe !== "orang");
    r.koleksi.push({ ...r.koleksi[0] });
    const m = susunManifest(r);
    expect(periksaManifest(m)).toEqual([]);
    expect(m.koleksi.map((k) => k.kode)).toEqual(["piket", "piket_2"]);
    expect(m.koleksi[0].status?.transisi[0].peran).toEqual(["pemilik", "admin", "staf"]);
  });

  it("kode: aksen dan simbol dibuang, nama sistem dihindari, bentrok diberi nomor", () => {
    expect(kodeMod("Café & Kasir", [])).toBe("cafe-kasir");
    expect(kodeMod("Jadwal piket", ["jadwal-piket", "jadwal-piket-2"])).toBe("jadwal-piket-3");
    expect(kodeMod("1 2", [])).toMatch(/^[a-z][a-z0-9-]{2,39}$/);
    const s = new Set<string>();
    expect(kodeIsian("Status", s)).toBe("status_isi");
    expect(kodeIsian("ID", s)).toBe("id_isi");
    expect(kodeIsian("<script>", s)).toBe("script");
    expect(kodeIsian("Script", s)).toBe("script_2");
  });

  it("label berbahaya tetap ditolak pengawas walau lewat formulir", () => {
    const r = dasar();
    r.koleksi[0].isian[0].label = "<img onerror=alert(1)>";
    expect(periksaManifest(susunManifest(r)).length).toBeGreaterThan(0);
  });

  it("rancangan yang belum lengkap dijelaskan sebelum disusun", () => {
    const r = dasar();
    r.nama = "A";
    r.koleksi[0].isian = [{ label: "Tanggal", tipe: "tanggal", wajib: false, pilihan: "" }, { label: "Jenis", tipe: "pilihan", wajib: false, pilihan: "Satu" }];
    r.koleksi[0].status = "Hanya satu";
    expect(periksaRancangan(r)).toEqual([
      "Nama fitur minimal 3 huruf.",
      "Bagian 1 (Piket): perlu satu isian Teks pendek sebagai judul catatan.",
      "Bagian 1 (Piket): isian Jenis butuh minimal dua pilihan, dipisah koma.",
      "Bagian 1 (Piket): status butuh minimal dua tahap, dipisah koma, atau kosongkan.",
    ]);
    expect(periksaRancangan(dasar())).toEqual([]);
  });
});
