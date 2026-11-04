// Uji ujung ke ujung F5-04: agen edge (biner Rust) membaca RTSP dari mediamtx yang memutar video korpus Mata, lalu mencatat
// kejadian ke Nadi produksi dengan token agen terbatas milik akun uji A. Prasyarat: mediamtx berjalan dan ffmpeg menerbitkan
// rtsp://127.0.0.1:8554/meja (lihat docs/edge/PASANG.md bagian Uji). Jalankan dari apps/web:
//   AGEN=<jalur biner> node scripts/uji-agen-mata.ts
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const AKAR = join(import.meta.dirname, "..", "..", "..");
const env = (f: string) =>
  Object.fromEntries(readFileSync(join(import.meta.dirname, "..", f), "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const E = { ...env(".env.local"), ...env(".env.e2e.local") };
const AGEN = process.env.AGEN;
if (!AGEN) throw new Error("isi AGEN=<jalur biner nadi-mata-agen>");

const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const { error: eMasuk } = await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI });
if (eMasuk) throw new Error("masuk gagal: " + eMasuk.message);
const zona = JSON.parse(readFileSync(join(AKAR, "fixtures", "korpus", "mata", "zona.json"), "utf8")) as { nama: string; jenis: string; poligon: number[][] }[];
const { error: eZona } = await sb.rpc("simpan_zona_mata", { p_zona: zona.map(({ nama, jenis, poligon }) => ({ nama, jenis, poligon })) });
if (eZona) throw new Error("zona: " + eZona.message);
const { data: token, error: eTok } = await sb.rpc("buat_token_agen_mata", { p_nama: `Uji agen ${new Date().toISOString().slice(0, 16)}` });
if (eTok) throw new Error("token: " + eTok.message);
const mulai = new Date().toISOString();

const konf = {
  NADI_SUPABASE_URL: E.NEXT_PUBLIC_SUPABASE_URL, NADI_KUNCI_PUBLIK: E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NADI_TOKEN_AGEN: token as string,
  NADI_RTSP: "rtsp://127.0.0.1:8554/meja", NADI_DETIK: "2",
};
// AGEN_WSL=1: biner Linux dijalankan di WSL Ubuntu-22.04 (mediamtx dan penerbit RTSP juga berjalan di WSL).
const anak = process.env.AGEN_WSL
  ? spawn("wsl", ["-d", "Ubuntu-22.04", "--", "env", ...Object.entries({ ...konf, NADI_LATAR: "/mnt/c/Users/Tristan/Downloads/project-pkl/nadi/fixtures/korpus/mata/sumber/latar.jpg" }).map(([k, v]) => `${k}=${v}`), `AGEN_LINUX=${AGEN}`, "bash", "/mnt/c/Users/Tristan/Downloads/project-pkl/nadi/edge/mata-agen/uji/rtsp-linux.sh"], { stdio: ["ignore", "inherit", "inherit"] })
  : spawn(AGEN, ["jalan"], { env: { ...process.env, ...konf, NADI_LATAR: join(AKAR, "fixtures", "korpus", "mata", "sumber", "latar.jpg") }, stdio: ["ignore", "inherit", "inherit"] });
await new Promise((r) => setTimeout(r, 75_000));
anak.kill();

const { data: kej } = await sb.from("kejadian").select("jenis, data, terjadi_at").eq("sumber", "mata_agen").gte("terjadi_at", mulai).order("terjadi_at");
const { data: agen } = await sb.from("agen_mata").select("id, terakhir_at").is("dicabut_at", null).order("dibuat_at", { ascending: false }).limit(1).single();
if (agen) await sb.rpc("cabut_token_agen_mata", { p_id: agen.id });
const n = kej?.length ?? 0;
const terisi = (kej ?? []).filter((k) => (k.data as { status?: string }).status === "terisi").length;
console.log(`KEJADIAN mata_agen ${n} (terisi ${terisi}); agen terakhir dipakai ${agen?.terakhir_at ?? "-"}; token dicabut`);
for (const k of (kej ?? []).slice(0, 8)) console.log(k.terjadi_at, k.jenis, JSON.stringify(k.data));
// exitCode, bukan process.exit: keluaran console.log ke pipa bisa hilang bila proses langsung keluar.
process.exitCode = n > 0 && terisi > 0 ? 0 : 1;
