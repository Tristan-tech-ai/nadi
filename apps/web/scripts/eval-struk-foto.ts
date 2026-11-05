// M-18B: ukur pembacaan foto struk di perangkat (tesseract.js 'ind', sama dengan src/lib/ocr.ts) + aturan bacaStruk terhadap
// jawaban fixtures/korpus/struk/harapan.json. Teks OCR disimpan ke fixtures/korpus/struk-foto/ocr/*.txt (beserta keyakinan) agar
// vitest (src/lib/klaim/struk-foto.test.ts) menguji ulang tanpa jaringan. Jalankan dari apps/web: node scripts/eval-struk-foto.ts
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createWorker } from "tesseract.js";
import { bacaStruk } from "../src/lib/klaim/struk.ts";
import { AMBANG_OCR } from "../src/lib/ocr.ts";

const KORPUS = join(import.meta.dirname, "..", "..", "..", "fixtures", "korpus");
// TINGKAT=sulit memakai fixtures/korpus/struk-foto/sulit.
const FOTO = join(KORPUS, "struk-foto", process.env.TINGKAT ?? "");
const OCR = join(FOTO, "ocr");
mkdirSync(OCR, { recursive: true });
const harapan = JSON.parse(readFileSync(join(KORPUS, "struk", "harapan.json"), "utf8")) as Record<string, { total: number; tanggal: string | null }>;
const w = await createWorker("ind");
let benar = 0;
let tgl = 0;
let terima = 0;
let terimaSalah = 0;
const keModel: string[] = [];
const ms: number[] = [];
const rinci: string[] = [];
for (const f of readdirSync(FOTO).filter((x) => x.endsWith(".jpg")).sort()) {
  const t0 = performance.now();
  const { data } = await w.recognize(join(FOTO, f));
  ms.push(performance.now() - t0);
  const kunci = f.replace(".jpg", ".txt");
  writeFileSync(join(OCR, kunci), `${data.text.trim()}\n`);
  const h = bacaStruk(data.text);
  const j = harapan[kunci];
  const ok = h.total === j.total;
  benar += ok ? 1 : 0;
  // Kebijakan layar: hasil OCR dipakai hanya bila keyakinan >= AMBANG_OCR dan total terbaca; selain itu dibaca model.
  if (data.confidence >= AMBANG_OCR && h.total) {
    terima++;
    if (!ok) terimaSalah++;
  } else keModel.push(f);
  tgl += h.tanggal === j.tanggal ? 1 : 0;
  rinci.push(`${kunci}: total ${h.total} (benar ${j.total}) ${ok ? "ok" : "SALAH"}, tanggal ${h.tanggal}, keyakinan ${Math.round(data.confidence)}`);
}
await w.terminate();
const n = rinci.length;
console.log(rinci.join("\n"));
console.log(`kebijakan: ${terima} dipakai dari OCR (${terimaSalah} salah), ${keModel.length} dialihkan ke model: ${keModel.join(" ")}`);
console.log(`total benar ${benar}/${n} (${((benar / n) * 100).toFixed(1)}%), tanggal benar ${tgl}/${n}, rata-rata ${Math.round(ms.reduce((a, b) => a + b, 0) / n)} ms per foto`);
