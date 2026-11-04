import { describe, expect, it } from "vitest";
import { kamusEn } from "./en";
import { isiTeks, kamusId } from "./id";

/** Bentuk kamus: kunci objek dan panjang larik, tanpa isi teks. */
function bentuk(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(bentuk);
  if (x && typeof x === "object") return Object.fromEntries(Object.keys(x).sort().map((k) => [k, bentuk((x as Record<string, unknown>)[k])]));
  return typeof x;
}
function semuaTeks(x: unknown): string[] {
  if (typeof x === "string") return [x];
  if (Array.isArray(x)) return x.flatMap(semuaTeks);
  if (x && typeof x === "object") return Object.values(x).flatMap(semuaTeks);
  return [];
}

describe("kamus", () => {
  it("kunci dan panjang larik id dan en identik", () => {
    expect(bentuk(kamusEn)).toEqual(bentuk(kamusId));
  });
  it("tidak ada teks kosong, tanda pisah panjang, atau emoji", () => {
    for (const t of [...semuaTeks(kamusId), ...semuaTeks(kamusEn)]) {
      expect(t.trim().length).toBeGreaterThan(0);
      expect(t).not.toMatch(/[\u2014\u2013]|\p{Extended_Pictographic}/u);
    }
  });
  it("teks Inggris tidak memuat kata Indonesia umum (kecuali nama produk, orang, dan regulasi)", () => {
    const kata = /\b(dan|yang|untuk|dengan|tidak|kamu|usaha|karyawan|belum|sudah|atau)\b/i;
    const pengecualian = ["Bahasa Indonesia", "UD Sumber Rejeki"];
    // Penanda {nama}, {usaha}, ... adalah kunci yang diurai database, bukan kalimat, jadi diabaikan.
    for (const t of semuaTeks(kamusEn)) if (!pengecualian.includes(t)) expect(t.replace(/\{[a-z_]+\}/g, ""), t).not.toMatch(kata);
  });
  it("isiTeks mengisi {nama}", () => {
    expect(isiTeks("sampai {n} orang", { n: 15 })).toBe("sampai 15 orang");
    expect(isiTeks("{x}", {})).toBe("{x}");
  });
});
