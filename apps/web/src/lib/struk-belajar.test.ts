import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cocok, jalankan, type Aturan } from "../../../../supabase/functions/baca-berkas/ekstraktor";
import { periksaAturan } from "../../../../supabase/functions/baca-berkas/pengawas";
import { samaStruk } from "../../../../supabase/functions/baca-berkas/struk";

// T-01B: pembanding masa bayangan struk dan aturan struk SPBU (ditulis model berat pada eval 6 Nov 2026) pada korpus struk-foto.
const OCR = join(__dirname, "..", "..", "..", "..", "fixtures", "korpus", "struk-foto", "ocr");
const SPBU: Aturan = {
  bentuk: "teks",
  jenis: "struk",
  jangkar: ["Pulau/Pompa", "Nama Produk", "Harga/Liter", "Volume", "Total Harga"],
  bidang: {
    total: { pola: "^\\s*Total\\s*Harga\\s*:\\s*(?:Rp\\.?)?\\s*([\\d.,\\s]+\\d)\\s*$", tipe: "rupiah" },
    pemasok: { pola: "^\\s*(SPBU\\s*[\\d.\\s]+?\\d)\\s*$", tipe: "teks" },
    tanggal: { pola: "^\\s*Waktu\\s*:\\s*(\\d{1,2}\\s*[/.-]\\s*\\d{1,2}\\s*[/.-]\\s*\\d{4})", tipe: "tanggal" },
  },
};

describe("samaStruk", () => {
  it("pemasok dengan atau tanpa alamat dianggap sama; total dan tanggal wajib persis", () => {
    const aturan = { pemasok: "SPBU 34.452.97", tanggal: "2026-07-09", total: 177500 };
    expect(samaStruk({ pemasok: "SPBU 34.452.97 JL. RAYA SINGARAJA KM 15", tanggal: "2026-07-09", total: 177500 }, aturan)).toEqual({ sama: true, beda: [] });
    expect(samaStruk({ pemasok: "SPBU 34.452.97", tanggal: "2026-09-07", total: 177500 }, aturan).beda).toEqual(["tanggal"]);
    expect(samaStruk({ pemasok: "SPBU 34.452.97", tanggal: "2026-07-09", total: 177000 }, aturan).beda).toEqual(["total"]);
    expect(samaStruk({ pemasok: "Toko Ceria", tanggal: "2026-07-09", total: 177500 }, aturan).beda).toEqual(["pemasok"]);
    expect(samaStruk({ pemasok: "", tanggal: "", total: 0 }, { pemasok: "", tanggal: "", total: 0 }).sama).toBe(false);
  });
  it("salah baca OCR satu huruf pada pemasok tetap sama", () => {
    expect(samaStruk({ pemasok: "RUMAH MAKAN SARI RASA", tanggal: "2026-05-01", total: 1 }, { pemasok: "RUMAH MAKAN SAR1 RASA", tanggal: "2026-05-01", total: 1 }).sama).toBe(true);
  });
});

describe("aturan struk SPBU pada korpus", () => {
  it("lolos pengawas dan membaca keempat struk SPBU (pemisah tanggal / dan -)", () => {
    expect(periksaAturan(SPBU)).toEqual({ lulus: true, alasan: [] });
    const harapan: Record<string, { tanggal: string; total: number }> = {
      "01": { tanggal: "2026-10-04", total: 64800 }, "09": { tanggal: "2026-09-26", total: 174300 },
      "17": { tanggal: "2026-07-09", total: 177500 }, "25": { tanggal: "2026-07-27", total: 275100 },
    };
    for (const [n, h] of Object.entries(harapan)) {
      const teks = readFileSync(join(OCR, `struk-${n}.txt`), "utf8");
      expect(cocok(SPBU, teks)).toBe(true);
      const r = jalankan(SPBU, teks);
      expect(r.lengkap).toBe(true);
      expect(r.bidang).toMatchObject(h);
    }
  });
  it("tidak cocok dengan struk tata letak lain di korpus", () => {
    for (const n of ["02", "03", "05", "07"]) expect(cocok(SPBU, readFileSync(join(OCR, `struk-${n}.txt`), "utf8"))).toBe(false);
  });
});
