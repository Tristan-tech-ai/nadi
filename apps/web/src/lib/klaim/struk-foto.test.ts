import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { bacaStruk } from "./struk";

// M-18B: foto struk sintetis (fixtures/korpus/struk-foto, dibangkitkan scripts/korpus/struk-foto.py) dibaca OCR di perangkat
// (tesseract.js 'ind'); teks OCR disimpan oleh scripts/eval-struk-foto.ts agar tes ini tidak butuh jaringan. Kriteria: total
// benar >= 90% pada set normal. Set sulit dilaporkan; foto dengan keyakinan OCR < 85 dialihkan ke baca-berkas mode struk.
const KORPUS = join(__dirname, "..", "..", "..", "..", "..", "fixtures", "korpus");
const harapan = JSON.parse(readFileSync(join(KORPUS, "struk", "harapan.json"), "utf8")) as Record<string, { total: number }>;

function ukur(dir: string) {
  const berkas = readdirSync(dir).filter((f) => f.endsWith(".txt"));
  const benar = berkas.filter((f) => bacaStruk(readFileSync(join(dir, f), "utf8")).total === harapan[f].total).length;
  return { benar, n: berkas.length };
}

describe("foto struk", () => {
  test("set normal: total benar >= 90%", () => {
    const h = ukur(join(KORPUS, "struk-foto", "ocr"));
    expect(h.n).toBe(32);
    expect(h.benar / h.n).toBeGreaterThanOrEqual(0.9);
  });
  test("set sulit: OCR saja jauh di bawah target, jadi butuh jalur model (gerbang bisa merah)", () => {
    const h = ukur(join(KORPUS, "struk-foto", "sulit", "ocr"));
    expect(h.n).toBe(32);
    expect(h.benar / h.n).toBeLessThan(0.9);
  });
  test("pemasok dari baris pertama struk teks", () => {
    expect(bacaStruk(readFileSync(join(KORPUS, "struk", "struk-05.txt"), "utf8")).pemasok).toBe("RUMAH MAKAN SARI RASA");
    expect(bacaStruk(readFileSync(join(KORPUS, "struk", "struk-01.txt"), "utf8")).pemasok).toBe("SPBU 34.520.88");
  });
});
