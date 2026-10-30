import { readFileSync } from "node:fs";
import { join } from "node:path";
import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { INSTRUKSI, JENIS, SKEMA_HASIL, hasilDari, nilai, seriKeTanggal, usulanDari, xlsxKeTeks, type Hasil } from "../../../../supabase/functions/baca-berkas/inti";

const KORPUS = join(__dirname, "..", "..", "..", "..", "fixtures", "korpus");
const jawaban = (p: string) => JSON.parse(readFileSync(join(KORPUS, p), "utf8"));

describe("SKEMA_HASIL dan hasilDari", () => {
  it("skema keluaran kecil dan tertutup (varian per jenis ditolak API: grammar terlalu besar)", () => {
    const sk = SKEMA_HASIL as { properties: Record<string, { enum?: string[] }>; additionalProperties: boolean; required: string[] };
    expect(sk.additionalProperties).toBe(false);
    expect(sk.required).toEqual(["jenis", "keyakinan", "ringkasan", "bidang_json"]);
    expect(sk.properties.jenis.enum).toEqual([...JENIS]);
    expect(JSON.stringify(SKEMA_HASIL)).not.toMatch(/minimum|maximum|minLength|maxLength|anyOf/);
  });
  it("instruksi memuat bentuk bidang setiap jenis", () => {
    for (const j of JENIS) expect(INSTRUKSI).toContain(`  ${j}: {`);
    expect(INSTRUKSI).toContain("nota: {pemasok");
  });
  it("hasilDari merapikan angka bertitik, mengisi bidang hilang, membuang bidang asing", () => {
    const h = hasilDari({ jenis: "nota", keyakinan: 1.4, ringkasan: "x", bidang_json: JSON.stringify({ pemasok: "UD A", total: "Rp1.250.000", baris: [{ nama: "Gula", qty: "2", harga: 15000 }], asing: 1 }) });
    expect(h.keyakinan).toBe(1);
    expect(h.bidang).toEqual({ pemasok: "UD A", nomor: "", tanggal: "", baris: [{ nama: "Gula", qty: 2, harga: 15000, jumlah: 0 }], total: 1250000 });
  });
  it("angka desimal CSV dan desimal koma terbaca benar", () => {
    const h = hasilDari({ jenis: "mutasi", keyakinan: 0.9, ringkasan: "", bidang_json: JSON.stringify({ baris: [{ jumlah: "2503000.00", saldo: "12.500,50", arah: "DB" }] }) });
    const b = (h.bidang.baris as { jumlah: number; saldo: number; arah: string }[])[0];
    expect([b.jumlah, b.saldo, b.arah]).toEqual([2503000, 12500.5, "DB"]);
  });
  it("bidang_json rusak dan jenis asing tidak membuat gagal", () => {
    const h = hasilDari({ jenis: "apa" as never, keyakinan: 0.2, ringkasan: "", bidang_json: "{rusak" });
    expect(h.jenis).toBe("lainnya");
    expect(h.bidang).toEqual({ judul: "", isi: "" });
  });
});

describe("xlsxKeTeks", () => {
  it("absen korpus: semua baris data terbaca dengan judul kolom", () => {
    const teks = xlsxKeTeks(unzipSync(readFileSync(join(KORPUS, "absen", "absen-01.xlsx"))));
    const baris = teks.split("\n").filter((l) => l && !l.startsWith("#"));
    expect(baris[0]).toBe("Nama,Tanggal,Masuk,Pulang,Keterangan");
    expect(baris.length - 1).toBe(jawaban("absen/absen-01.json").bidang.baris.length);
    expect(baris[1].startsWith(jawaban("absen/absen-01.json").bidang.baris[0].nama)).toBe(true);
  });
  it("karyawan dengan kolom acak: angka gaji tetap utuh", () => {
    const teks = xlsxKeTeks(unzipSync(readFileSync(join(KORPUS, "excel_karyawan", "karyawan-8-kolom-acak.xlsx"))));
    const b = jawaban("excel_karyawan/karyawan-8-kolom-acak.json").bidang.baris[0];
    expect(teks).toContain(b.nama);
    expect(teks).toContain(String(b.gaji_pokok));
  });
  it("nomor seri tanggal Excel diubah ke ISO", () => {
    expect(seriKeTanggal(46326)).toBe("2026-10-31");
  });
});

describe("usulanDari dan nilai", () => {
  const nota = jawaban("nota/nota-01.json");
  const hasil: Hasil = { jenis: "nota", keyakinan: 0.93, ringkasan: "Belanja bahan", bidang: nota.bidang };
  it("nota menjadi usulan catat belanja dengan rupiah EYD dan keyakinan", () => {
    const u = usulanDari(hasil);
    expect(u.aksi).toBe("uang.keluar");
    expect(u.judul).toBe("Catat belanja Rp376.500 di UD Sumber Rejeki");
    expect(u.penjelasan).toContain("yakin 93%");
    expect(u.dampak_rp).toBe(376500);
  });
  it("penilai menerima jawaban benar dan menolak total yang salah atau jenis yang keliru", () => {
    expect(nilai("nota", nota.bidang, hasil).benar).toBe(true);
    expect(nilai("nota", nota.bidang, { ...hasil, bidang: { ...nota.bidang, total: 1 } }).salah).toContain("total");
    expect(nilai("invoice", nota.bidang, hasil).benar).toBe(false);
  });
  it("setiap jenis menghasilkan judul tanpa tanda pisah panjang", () => {
    for (const j of JENIS) {
      const u = usulanDari({ jenis: j, keyakinan: 0.8, ringkasan: "", bidang: { baris: [], pengalaman: [] } });
      expect(u.judul).not.toMatch(/[–—]/);
      expect(u.judul.length).toBeGreaterThan(5);
    }
  });
});
