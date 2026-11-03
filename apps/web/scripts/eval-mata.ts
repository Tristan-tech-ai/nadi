// Ukur akurasi Mata (F5-01) pada korpus fixtures/korpus/mata: RF-DETR nano lewat transformers.js + resep zona (src/lib/mata/resep.ts).
// Jalankan dari apps/web:
//   python -I scripts/korpus/mata.py <dir cuplikan>
//   MODEL_MATA=<id model di public.konfigurasi kunci model_mata>
//   TRANSFORMERS=<jalur node_modules/@huggingface/transformers/src/transformers.js> node scripts/eval-mata.ts <dir cuplikan> [dtype=q8]
// Mencetak akurasi status meja per zona dan total, dengan dan tanpa histeresis, serta latensi rata-rata per cuplikan.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { akurasi, langkahStatus, orangDiZona, statusAwal, type Deteksi, type Status, type StatusMeja, type Zona } from "../src/lib/mata/resep.ts";

const AKAR = join(import.meta.dirname, "..", "..", "..", "fixtures", "korpus", "mata");
const dir = process.argv[2];
const dtype = process.argv[3] ?? "q8";
if (!dir) throw new Error("Pakai: node scripts/eval-mata.ts <dir cuplikan> [dtype]");
const zona = JSON.parse(readFileSync(join(AKAR, "zona.json"), "utf8")) as Zona[];
const jawaban = JSON.parse(readFileSync(join(AKAR, "jawaban.json"), "utf8")) as { cuplikan: number; status: Record<string, StatusMeja> }[];

const sumber = process.env.TRANSFORMERS ? pathToFileURL(process.env.TRANSFORMERS).href : "@huggingface/transformers";
const { pipeline } = await import(sumber);
const model = process.env.MODEL_MATA;
if (!model) throw new Error("Isi MODEL_MATA (ID model dari public.konfigurasi kunci model_mata)");
const deteksi = await pipeline("object-detection", model, { dtype });

const status = new Map<string, Status>(zona.map((z) => [z.id, statusAwal()]));
const prediksi: StatusMeja[] = [];
const mentah: StatusMeja[] = [];
const benar: StatusMeja[] = [];
const perZona = new Map<string, { p: StatusMeja[]; j: StatusMeja[] }>(zona.map((z) => [z.id, { p: [], j: [] }]));
let ms = 0;
const simpan: { cuplikan: number; orang: Deteksi[] }[] = [];
for (const j of jawaban) {
  const t0 = performance.now();
  const d = (await deteksi(join(dir, `${String(j.cuplikan).padStart(3, "0")}.jpg`), { threshold: 0.5, percentage: true })) as Deteksi[];
  ms += performance.now() - t0;
  simpan.push({ cuplikan: j.cuplikan, orang: d.filter((x) => x.label === "person").map((x) => ({ label: x.label, score: +x.score.toFixed(3),
    box: { xmin: +x.box.xmin.toFixed(4), ymin: +x.box.ymin.toFixed(4), xmax: +x.box.xmax.toFixed(4), ymax: +x.box.ymax.toFixed(4) } })) });
  for (const z of zona) {
    const ada = orangDiZona(d, z, 0.5) > 0;
    const s = langkahStatus(status.get(z.id)!, ada).status;
    status.set(z.id, s);
    prediksi.push(s.nilai);
    mentah.push(ada ? "terisi" : "kosong");
    benar.push(j.status[z.id]);
    perZona.get(z.id)!.p.push(s.nilai);
    perZona.get(z.id)!.j.push(j.status[z.id]);
  }
}
const persen = (x: number) => `${(x * 100).toFixed(1)}%`;
console.log(`model ${model} ${dtype}, ${jawaban.length} cuplikan x ${zona.length} zona, rata-rata ${Math.round(ms / jawaban.length)} ms per cuplikan`);
for (const z of zona) console.log(`  ${z.nama}: ${persen(akurasi(perZona.get(z.id)!.p, perZona.get(z.id)!.j))}`);
console.log(`akurasi dengan histeresis: ${persen(akurasi(prediksi, benar))}; tanpa histeresis: ${persen(akurasi(mentah, benar))}`);
// Simpan deteksi orang per cuplikan sebagai fixture supaya vitest bisa menguji resep tanpa model (SIMPAN_DETEKSI=1).
if (process.env.SIMPAN_DETEKSI) writeFileSync(join(AKAR, `deteksi-${dtype}.json`), `${JSON.stringify(simpan)}\n`);
