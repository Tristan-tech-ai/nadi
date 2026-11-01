import { describe, expect, it } from "vitest";
import { idPermintaan, kelompokkan, periksaKalimat, pesanUsaha, rupiahDi, saringJawaban, type Bahan } from "../../../../supabase/functions/analis-malam/inti";

const aturan = "Tagih 1 invoice yang lewat jatuh tempo, totalnya Rp1.000.000. Yang paling lama sudah telat 6 hari.";
const bahan: Bahan[] = [
  { id: "a1", perusahaan_id: "11111111-2222-3333-4444-555555555555", kode: "tagihan_lewat_tempo", fakta: {}, teks: aturan },
  { id: "a2", perusahaan_id: "11111111-2222-3333-4444-555555555555", kode: "belanja_naik", fakta: {},
    teks: "Belanja 7 hari terakhir Rp2.300.000, naik Rp1.300.000 dari rata-rata mingguan bulan lalu (Rp1.000.000)." },
  { id: "b1", perusahaan_id: "99999999-2222-3333-4444-555555555555", kode: "belanja_naik", fakta: {}, teks: "Belanja naik Rp500.000." },
];

describe("Analis Malam: keluaran model tak tepercaya", () => {
  it("mengambil rupiah apa adanya", () => {
    expect(rupiahDi("Rp1.000.000 dan Rp 250.000")).toEqual(["Rp1.000.000", "Rp250.000"]);
  });

  it("menerima kalimat yang angka rupiahnya sama persis", () => {
    expect(periksaKalimat("Ada tagihan Rp1.000.000 yang sudah telat 6 hari. Tagih hari ini.", aturan)).toBe(true);
  });

  it("menolak angka berubah, angka tambahan, angka hilang, tanda pisah, emoji, atau terlalu panjang", () => {
    expect(periksaKalimat("Tagih Rp1.100.000 yang telat.", aturan)).toBe(false);
    expect(periksaKalimat("Tagih Rp1.000.000, bisa hemat Rp50.000.", aturan)).toBe(false);
    expect(periksaKalimat("Ada tagihan yang telat 6 hari, tagih sekarang.", aturan)).toBe(false);
    expect(periksaKalimat(`Tagih Rp1.000.000 ${"—"} sudah telat.`, aturan)).toBe(false);
    expect(periksaKalimat("Tagih Rp1.000.000 sekarang \u{1F4B0}", aturan)).toBe(false);
    expect(periksaKalimat(`Tagih Rp1.000.000 ${"ya ".repeat(80)}`, aturan)).toBe(false);
  });

  it("custom_id sesuai batas Message Batches", () => {
    const id = idPermintaan(bahan[0].perusahaan_id);
    expect(id).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
    expect(id).toBe("u11111111222233334444555555555555");
  });

  it("mengelompokkan per usaha dan tidak mengirim fakta mentah", () => {
    const g = kelompokkan(bahan);
    expect([...g.keys()]).toHaveLength(2);
    const pesan = JSON.parse(pesanUsaha(g.get(bahan[0].perusahaan_id)!));
    expect(pesan.butir.map((b: { id: string }) => b.id)).toEqual(["a1", "a2"]);
    expect(JSON.stringify(pesan)).not.toContain("perusahaan_id");
  });

  it("menyaring jawaban: id asing, id ganda, dan kalimat gagal diabaikan", () => {
    const jawab = { kalimat: [
      { id: "a1", teks: "Tagihan Rp1.000.000 sudah telat 6 hari, tagih hari ini." },
      { id: "a1", teks: "Ulang Rp1.000.000 lagi ya." },
      { id: "a2", teks: "Belanja naik jadi Rp2.300.000." },
      { id: "b1", teks: "Belanja naik Rp500.000." },
      { id: "x", teks: "Rp1.000.000" },
    ] };
    expect(saringJawaban(jawab, bahan.slice(0, 2))).toEqual([{ id: "a1", teks: "Tagihan Rp1.000.000 sudah telat 6 hari, tagih hari ini." }]);
    expect(saringJawaban({ bukan: 1 }, bahan)).toEqual([]);
    expect(saringJawaban(null, bahan)).toEqual([]);
  });
});
