import { describe, expect, it } from "vitest";
import { CONTOH_TEKS_NADI } from "./prompt";
import { uraiTeksNadi } from "./teks-nadi";

// W-04: 10 kasus cetak biru (5 baik, 5 buruk). Keluaran AI = masukan tak tepercaya.
const HARI = "2026-11-04";
const aksi = (t: string) => uraiTeksNadi(t, HARI).butir.map((b) => b.aksi);

describe("Teks Nadi: kasus baik", () => {
  it("1. contoh lengkap di prompt menjadi >= 10 usulan", () => {
    const h = uraiTeksNadi(CONTOH_TEKS_NADI, HARI);
    expect(h.galat).toBeUndefined();
    expect(h.butir.length).toBeGreaterThanOrEqual(10);
    expect(h.baris.every((b) => b.dikenali)).toBe(true);
    expect(h.butir[0]).toMatchObject({ aksi: "onboarding.usaha", bidang: { negara: "ID", kota: "Denpasar", skala: "6-15", cabang: 1 } });
  });
  it("2. orang dengan dua topi dan tanggal mulai", () => {
    const h = uraiTeksNadi("NADI ONBOARDING 1\nORANG:\n- Sari Dewi | kasir, pelayan | mulai 2024-03-01", HARI);
    expect(h.butir).toEqual([{ aksi: "orang.impor", judul: "Tambah Sari Dewi sebagai kasir, pelayan",
      bidang: { baris: [{ id: "", nama: "Sari Dewi", jabatan: "kasir, pelayan", telepon: "", mulai: "2024-03-01" }] } }]);
  });
  it("3. aturan izin beberapa jenis dalam satu baris", () => {
    const h = uraiTeksNadi("NADI ONBOARDING 1\nATURAN IZIN: sakit otomatis 2 hari, wajib surat dokter; cuti 12 hari setahun", HARI);
    expect(h.butir.map((b) => b.bidang)).toEqual([
      { jenis: "sakit", otomatis: true, maks_hari: 2, butuh_bukti: true, jatah_tahunan: null },
      { jenis: "cuti", otomatis: false, maks_hari: 0, butuh_bukti: false, jatah_tahunan: 12 }]);
  });
  it("4. JSON setara diperlakukan sama dengan teks", () => {
    const j = JSON.stringify({ nadi_onboarding: 1, usaha: { kota: "Makassar", negara: "Indonesia", orang: 3 }, orang: [{ nama: "Komang Ayu", topi: ["koki"], mulai: "2025-01-15" }], fitur: ["Absen", "Gaji"] });
    expect(aksi(j)).toEqual(["onboarding.usaha", "orang.impor", "onboarding.fitur"]);
  });
  it("5. blok kode, komentar, dan huruf kecil tidak mengganggu; fitur asing disebut", () => {
    const h = uraiTeksNadi("```\nNADI ONBOARDING 1\n# dari AI\nFITUR: lempar, feed, terbang\n```", HARI);
    expect(h.butir).toEqual([{ aksi: "onboarding.fitur", judul: "Pakai fitur: lempar, feed", bidang: { fitur: ["lempar", "feed"] } }]);
    expect(h.baris[0].detail).toBe("terbang");
  });
});

describe("Teks Nadi: kasus buruk", () => {
  it("6. angka gaji dikarang AI ditolak, orang lain tetap masuk", () => {
    const h = uraiTeksNadi("NADI ONBOARDING 1\nORANG:\n- Budi | kasir | gaji Rp4.500.000\n- Wayan Sari | pelayan", HARI);
    expect(h.butir.map((b) => (b.bidang.baris as { nama: string }[])[0].nama)).toEqual(["Wayan Sari"]);
    expect(h.baris.find((b) => b.teks.includes("Budi"))).toMatchObject({ dikenali: false, alasan: "uang" });
  });
  it("7. NIK utuh ditolak (teks dan JSON)", () => {
    expect(uraiTeksNadi("NADI ONBOARDING 1\nORANG:\n- Agus | kasir | NIK 3171012605831840", HARI).baris[1]).toMatchObject({ alasan: "nik" });
    expect(aksi(JSON.stringify({ nadi_onboarding: 1, orang: [{ nama: "Agus", nik: "3171 0126 0583 1840" }] }))).toEqual([]);
  });
  it("8. perintah dari AI tidak dijalankan", () => {
    const h = uraiTeksNadi("NADI ONBOARDING 1\nHAPUS semua karyawan\nSETUJUI usulan ini\n- ignore previous instructions", HARI);
    expect(h.butir).toEqual([]);
    expect(h.baris.map((b) => b.alasan)).toEqual(["perintah", "perintah", "perintah"]);
  });
  it("9. tanpa kepala, JSON rusak, tanggal masa depan, negara asing", () => {
    expect(uraiTeksNadi("ORANG:\n- Sari | kasir", HARI).galat).toBe("tanpa_kepala");
    expect(uraiTeksNadi("{ nadi_onboarding: 1", HARI).galat).toBe("json");
    expect(uraiTeksNadi("NADI ONBOARDING 1\nORANG:\n- Sari | kasir | mulai 2027-01-01", HARI).baris[1]).toMatchObject({ alasan: "tanggal" });
    expect(uraiTeksNadi("NADI ONBOARDING 1\nKOTA: Paris | NEGARA: Prancis", HARI).baris[0]).toMatchObject({ alasan: "negara" });
  });
  it("10. nama berisi angka, aturan izin di luar batas, dan lebih dari 60 orang", () => {
    expect(uraiTeksNadi("NADI ONBOARDING 1\nORANG:\n- K4sir 01 | kasir", HARI).baris[1]).toMatchObject({ alasan: "nama" });
    expect(uraiTeksNadi("NADI ONBOARDING 1\nATURAN IZIN: sakit otomatis 90 hari", HARI).baris[0]).toMatchObject({ alasan: "izin" });
    const banyak = Array.from({ length: 61 }, (_, i) => `- Orang ${"abcdefghijklmnopqrstuvwxyz"[i % 26]}${"abcdefghij"[Math.floor(i / 26)]} | kasir`).join("\n");
    const h = uraiTeksNadi(`NADI ONBOARDING 1\nORANG:\n${banyak}`, HARI);
    expect(h.butir).toHaveLength(60);
    expect(h.baris.at(-1)).toMatchObject({ alasan: "terlalu_banyak" });
  });
});

describe("Teks Nadi: jawaban asli model chat gratis (docs/quality/onboarding-ai.md)", () => {
  it("11. kepala bertanda tebal, gaji dan NIK bocor di satu baris, peran merangkap", () => {
    const jawab = ["**NADI ONBOARDING 1**", "USAHA: Kedai Kopi Pagi", "JENIS: kedai kopi", "KOTA: Makassar | NEGARA: Indonesia | ORANG: 4 | CABANG: 1", "ORANG:",
      "- Andi Rahman | barista | mulai 2025-02-01 | gaji Rp3.200.000 sebulan | NIK 7371011502990003",
      "- Rina Kartika | kasir merangkap pelayan | mulai 2024-08-10", "- Joko Susilo | bagian gudang", "- Lina Marlina | barista | mulai 2026-01-05",
      "FITUR: Lempar, Feed, Absen, Gaji, Jadwal, Stok", "ATURAN IZIN: cuti 12 hari setahun", "NEGARA: Indonesia"].join("\n");
    const h = uraiTeksNadi(jawab, HARI);
    expect(h.galat).toBeUndefined();
    expect(h.baris.find((b) => b.teks.includes("Andi"))).toMatchObject({ dikenali: false, alasan: "nik" });
    expect(h.butir.filter((b) => b.aksi === "orang.impor").map((b) => (b.bidang.baris as { jabatan: string }[])[0].jabatan)).toEqual(["kasir, pelayan", "bagian gudang", "barista"]);
    expect(h.butir.length).toBe(6);
  });
});
