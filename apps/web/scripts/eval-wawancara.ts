// Ukur WER transkrip korpus suara wawancara (F2-03) untuk model Whisper transformers.js.
// Jalankan dari apps/web: TRANSFORMERS=<jalur node_modules/@huggingface/transformers/src/transformers.js> node scripts/eval-wawancara.ts [model ...]
// Bawaan model: onnx-community/whisper-tiny, whisper-base, whisper-small. Hasil per klip dan WER korpus dicetak sebagai JSON.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { wer, werKorpus } from "../src/lib/wawancara/wer.ts";

const AKAR = join(import.meta.dirname, "..", "..", "..", "fixtures", "korpus", "suara");
const jawaban: { id: string; teks: string }[] = JSON.parse(readFileSync(join(AKAR, "jawaban.json"), "utf8"));

/** WAV PCM 16 bit mono 16 kHz -> Float32Array [-1, 1]. */
function bacaWav(jalur: string): Float32Array {
  const b = readFileSync(jalur);
  let i = 12;
  while (i < b.length - 8) {
    const id = b.toString("ascii", i, i + 4);
    const ukuran = b.readUInt32LE(i + 4);
    if (id === "data") {
      const n = ukuran / 2;
      const hasil = new Float32Array(n);
      for (let k = 0; k < n; k++) hasil[k] = b.readInt16LE(i + 8 + k * 2) / 32768;
      return hasil;
    }
    i += 8 + ukuran + (ukuran % 2);
  }
  throw new Error(`chunk data tidak ada di ${jalur}`);
}

const sumber = process.env.TRANSFORMERS ? pathToFileURL(process.env.TRANSFORMERS).href : "@huggingface/transformers";
const { pipeline } = await import(sumber);
const model = process.argv.slice(2).length ? process.argv.slice(2) : ["onnx-community/whisper-tiny", "onnx-community/whisper-base", "onnx-community/whisper-small"];

for (const m of model) {
  const mulaiMuat = performance.now();
  const transkrip = await pipeline("automatic-speech-recognition", m, { dtype: "q8" });
  const muat = performance.now() - mulaiMuat;
  const pasangan: { id: string; rujukan: string; hipotesis: string; ms: number }[] = [];
  for (const j of jawaban) {
    const audio = bacaWav(join(AKAR, `${j.id}.wav`));
    const t = performance.now();
    const keluar = await transkrip(audio, { language: "indonesian", task: "transcribe" });
    pasangan.push({ id: j.id, rujukan: j.teks, hipotesis: String(keluar.text ?? "").trim(), ms: Math.round(performance.now() - t) });
  }
  const k = werKorpus(pasangan);
  const detikAudio = jawaban.reduce((s, j) => s + bacaWav(join(AKAR, `${j.id}.wav`)).length / 16000, 0);
  console.log(JSON.stringify({
    model: m, dtype: "q8", muat_ms: Math.round(muat), wer: Number(k.wer.toFixed(4)), substitusi: k.substitusi, hapus: k.hapus, sisip: k.sisip, kata: k.kata,
    detik_audio: Number(detikAudio.toFixed(1)), ms_total: pasangan.reduce((s, p) => s + p.ms, 0),
    klip: pasangan.map((p) => ({ id: p.id, wer: Number(wer(p.rujukan, p.hipotesis).wer.toFixed(3)), hipotesis: p.hipotesis })),
  }));
}
