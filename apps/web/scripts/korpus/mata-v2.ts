// Korpus Mata v2 (W-02): tulis skenario toko sintetis berjalur diketahui ke fixtures/korpus/mata-v2 dan video pendek untuk e2e.
// Jalankan dari apps/web: node scripts/korpus/mata-v2.ts   (butuh ffmpeg di PATH untuk video)
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buatSkenario, KORPUS_V2, renderBingkai, VIDEO_V2 } from "../../src/lib/mata/toko-sintetis.ts";

const AKAR = join(import.meta.dirname, "..", "..", "..", "..", "fixtures", "korpus", "mata-v2");
mkdirSync(AKAR, { recursive: true });
const indeks = [];
for (const p of [...KORPUS_V2, VIDEO_V2]) {
  const s = buatSkenario(p);
  writeFileSync(join(AKAR, `${s.nama}.json`), JSON.stringify(s) + "\n");
  indeks.push({ nama: s.nama, durasi: s.durasi, fps: s.fps, kunjungan: s.jawaban.length, karyawan: s.orang.some((o) => o.karyawan), uji: !["sepi", "ramai", "antrean"].includes(s.nama) });
}
writeFileSync(join(AKAR, "indeks.json"), JSON.stringify(indeks, null, 1) + "\n");

// Video: bingkai abu-abu 160x120 diperbesar 2x (tetangga terdekat) lalu VP9, 5 fps, tanpa suara.
const s = buatSkenario(VIDEO_V2);
const n = Math.round(s.durasi * s.fps);
const mentah = Buffer.alloc(n * s.lebar * s.tinggi);
for (let i = 0; i < n; i++) mentah.set(renderBingkai(s, i).data, i * s.lebar * s.tinggi);
const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "gray", "-s", `${s.lebar}x${s.tinggi}`, "-r", String(s.fps), "-i", "-",
  "-vf", "scale=320:240:flags=neighbor,format=yuv420p", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "42", "-row-mt", "1", "-an", join(AKAR, "pendek.webm")], { input: mentah });
if (r.status !== 0) throw new Error(String(r.stderr));
console.log(indeks);
