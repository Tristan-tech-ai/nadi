// Korpus suara uji wawancara (F2-03): teks rujukan fixtures/korpus/suara/jawaban.json -> WAV 16 kHz mono.
// Suara sintetis eSpeak NG lewat Echogarden 3.4.0 (alat, GPL-3.0; tidak menjadi dependensi aplikasi), lalu ffmpeg.
// Jalankan dari apps/web: node scripts/korpus/suara.mjs
//   ECHOGARDEN=<jalur node_modules/echogarden/dist/cli/CLILauncher.js> bila sudah terpasang (bawaan: npx --yes echogarden@3.4.0);
//   ffmpeg harus ada di PATH. Tanpa shell agar teks berspasi tetap satu argumen.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const AKAR = join(import.meta.dirname, "..", "..", "..", "..", "fixtures", "korpus", "suara");
const jawaban = JSON.parse(readFileSync(join(AKAR, "jawaban.json"), "utf8"));
const sementara = mkdtempSync(join(tmpdir(), "suara-"));
const bin = process.env.ECHOGARDEN;

try {
  for (const { id, teks } of jawaban) {
    const mentah = join(sementara, `${id}.wav`);
    const args = ["speak", teks, mentah, "--engine=espeak", "--language=id"];
    if (bin) execFileSync(process.execPath, [bin, ...args], { stdio: "ignore" });
    else execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", ["--yes", "echogarden@3.4.0", ...args], { stdio: "ignore", shell: process.platform === "win32" });
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", mentah, "-ar", "16000", "-ac", "1", "-sample_fmt", "s16", "-map_metadata", "-1", "-fflags", "+bitexact", join(AKAR, `${id}.wav`)]);
    console.log(id, teks);
  }
} finally {
  rmSync(sementara, { recursive: true, force: true });
}
