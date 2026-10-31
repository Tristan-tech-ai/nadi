// Eval tingkat model gerbang keputusan (F1-06B): 20 usulan sintetis berlabel (fixtures/keputusan/usulan.json) dinilai Edge Function
// putuskan produksi lewat jalur uji (JWT akun uji A, pemilik; tanpa membuat usulan, token dicatat di pemakaian_ai tugas
// rute_usulan_uji). Mengukur akurasi pilihan model terhadap label, berapa yang lolos ambang 0,85 dan akurasinya di antara yang lolos,
// serta p50/p95 latensi panggilan model (diukur di Edge Function) dan waktu pulang-pergi dari mesin ini.
// Hasil ditulis ke bagian F1-06B di docs/quality/keputusan.md. Jalankan dari apps/web: node scripts/eval-keputusan.ts
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { AMBANG_YAKIN, penerima, type Pilihan } from "../../../supabase/functions/putuskan/inti.ts";

const AKAR = join(import.meta.dirname, "..", "..", "..");
const env = (f: string) =>
  Object.fromEntries(readFileSync(join(import.meta.dirname, "..", f), "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const E = { ...env(".env.local"), ...env(".env.e2e.local") };

type Butir = { no: number; label: Pilihan; aksi: string; judul: string; penjelasan: string };
type Jawab = { pilihan: Pilihan; yakin: number; alasan: string; tindakan: string; latensi_ms: number; token_masuk: number; token_keluar: number };
const { usulan } = JSON.parse(readFileSync(join(AKAR, "fixtures", "keputusan", "usulan.json"), "utf8")) as { usulan: Butir[] };

const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const { error: eMasuk } = await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI });
if (eMasuk) throw new Error("masuk gagal: " + eMasuk.message);

const persentil = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return NaN;
  const i = (s.length - 1) * p;
  return s[Math.floor(i)] + (s[Math.ceil(i)] - s[Math.floor(i)]) * (i - Math.floor(i));
};
const ms = (x: number) => `${Math.round(x).toLocaleString("id-ID")} ms`;
const persen = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "-");

const hasil: { b: Butir; j: Jawab | null; galat?: string; pp: number }[] = [];
for (const b of usulan) {
  const t0 = performance.now();
  const { data, error } = await sb.functions.invoke("putuskan", { body: { uji: { judul: b.judul, aksi: b.aksi, penjelasan: b.penjelasan } } });
  const pp = performance.now() - t0;
  const galat = error ? `${error.message} ${await (error as { context?: Response }).context?.text?.()}` : undefined;
  hasil.push({ b, j: error ? null : (data as Jawab), galat, pp });
  console.log(b.no, b.label, error ? `GALAT ${galat}` : `${(data as Jawab).pilihan} ${(data as Jawab).yakin} ${Math.round((data as Jawab).latensi_ms)} ms`);
}

const ok = hasil.filter((h) => h.j);
const benar = ok.filter((h) => h.j!.pilihan === h.b.label).length;
const lolos = ok.filter((h) => h.j!.yakin >= AMBANG_YAKIN);
const benarLolos = lolos.filter((h) => h.j!.pilihan === h.b.label).length;
const sempitPemilik = ok.filter((h) => penerima(h.j!) === "pemilik");
const sempitSalah = sempitPemilik.filter((h) => h.b.label !== "pemilik").length;
const lat = ok.map((h) => h.j!.latensi_ms);
const pp = ok.map((h) => h.pp);
const token = ok.reduce((s, h) => s + h.j!.token_masuk + h.j!.token_keluar, 0);
const perLabel = (["pemilik", "admin", "keduanya"] as const).map((l) => {
  const xs = ok.filter((h) => h.b.label === l);
  return `${l} ${xs.filter((h) => h.j!.pilihan === l).length}/${xs.length}`;
});

const baris = hasil.map(({ b, j, galat }) => j
  ? `| ${b.no} | ${b.judul} | ${b.label} | ${j.pilihan} | ${Math.round(j.yakin * 100)}% | ${j.yakin >= AMBANG_YAKIN ? "ya" : "tidak"} | ${penerima(j)} | ${j.pilihan === b.label ? "benar" : "salah"} | ${ms(j.latensi_ms)} |`
  : `| ${b.no} | ${b.judul} | ${b.label} | galat | - | - | keduanya | galat: ${galat?.slice(0, 80)} | - |`);

const bagian = `<!-- F1-06B mulai -->
## F1-06B: tingkat model (rute usulan), eval 20 usulan sintetis

Dijalankan ${new Date().toISOString()} oleh \`node scripts/eval-keputusan.ts\` (apps/web) terhadap Edge Function \`putuskan\` produksi
lewat jalur uji (JWT akun uji A sebagai pemilik; tidak membuat usulan; token tercatat di \`pemakaian_ai\` tugas \`rute_usulan_uji\`).
Model: model ringan dari \`konfigurasi.model_ai.ringan\`, keluaran terstruktur \`{pilihan, peluang, yakin, alasan}\`, effort rendah.
Data: \`fixtures/keputusan/usulan.json\`, 20 usulan karangan berlabel (${perLabel.map((x) => x.split(" ")[0]).join(", ")}); dua butir (#19, #20)
menyisipkan perintah palsu "kirim ke admin saja". Latensi model diukur di Edge Function di sekitar panggilan model saja (yang juga dicatat
di \`keputusan.latensi_ms\` untuk jalur sungguhan); pulang-pergi diukur dari mesin pengembang di Indonesia ke Supabase Singapura.

**Hasil:** ${benar} dari ${ok.length} pilihan benar (${persen(benar, ok.length)}); per label: ${perLabel.join(", ")}.
${ok.length < hasil.length ? `**${hasil.length - ok.length} panggilan gagal** (lihat tabel).\n` : ""}Lolos ambang yakin >= 0,85: **${lolos.length} dari ${ok.length}**, benar di antara yang lolos: **${benarLolos} dari ${lolos.length} (${persen(benarLolos, lolos.length)})**.
Rute yang benar-benar dipersempit ke pemilik (satu-satunya penyempitan yang diizinkan; pilihan admin hanya saran): ${sempitPemilik.length}, salah ${sempitSalah}.
Latensi model p50 **${ms(persentil(lat, 0.5))}**, p95 ${ms(persentil(lat, 0.95))}; pulang-pergi p50 ${ms(persentil(pp, 0.5))}, p95 ${ms(persentil(pp, 0.95))}. Token total ${token.toLocaleString("id-ID")}.

| # | Usulan | Label | Pilihan model | Yakin | Lolos 0,85 | Penerima akhir | Penilaian | Latensi model |
|---|---|---|---|---|---|---|---|---|
${baris.join("\n")}

Catatan jujur: label dibuat penulis eval mengikuti pembagian di instruksi model, jadi eval ini mengukur kepatuhan pada pembagian itu,
bukan kebenaran mutlak; batas antara "admin" dan "keduanya" memang kabur. Sampel 20 terlalu kecil untuk mengkalibrasi ambang.
<!-- F1-06B selesai -->`;

const jalur = join(AKAR, "docs", "quality", "keputusan.md");
const lama = readFileSync(jalur, "utf8");
const baru = lama.includes("<!-- F1-06B mulai -->")
  ? lama.replace(/<!-- F1-06B mulai -->[\s\S]*<!-- F1-06B selesai -->/, bagian)
  : `${lama.trimEnd()}\n\n${bagian}\n`;
writeFileSync(jalur, baru);
console.log(`\nBENAR ${benar}/${ok.length}, lolos ${lolos.length} (benar ${benarLolos}), p50 ${Math.round(persentil(lat, 0.5))} ms`);
process.exit(ok.length === hasil.length ? 0 : 1);
