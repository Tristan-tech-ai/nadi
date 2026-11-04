// Edge Function `cadangan` (Q-03B, docs/research/cadangan.md): cadangan mingguan data usaha ke bucket pribadi `cadangan`.
// Aksi (hanya dari database lewat pg_net, header x-nadi-token dari Vault, dicocokkan push_token_cocok):
//   { aksi: "cadangan" }  ekspor setiap tabel dari cadangan_daftar() ke <tanggal>/<tabel>.json + manifest.json, lalu rotasi;
//   { aksi: "uji_pulih" } unduh folder terbaru dan muat tiap tabel ke tabel sementara lewat cadangan_uji_pulih.
// Di-deploy tanpa verify_jwt dan memeriksa sendiri. Kunci rahasia hanya dari env bawaan runtime; tidak pernah dicetak.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { folderRotasi } from "./rotasi.ts";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const BUCKET = "cadangan";

function kunciRahasia(): string {
  const baru = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (baru) return JSON.parse(baru)["default"];
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}
const admin = () => createClient(URL_SUPABASE, kunciRahasia(), { auth: { persistSession: false } });
const json = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "Content-Type": "application/json" } });
const teks = (b: unknown) => new TextEncoder().encode(JSON.stringify(b));

/** Folder cadangan bertanggal (AAAA-BB-HH), terurut terbaru dulu. */
async function daftarFolder(db: SupabaseClient): Promise<string[]> {
  const { data, error } = await db.storage.from(BUCKET).list("", { limit: 1000 });
  if (error) throw new Error(`list: ${error.message}`);
  return (data ?? []).map((x) => x.name).filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n)).sort().reverse();
}

async function cadangkan(db: SupabaseClient) {
  const folder = new Date().toISOString().slice(0, 10);
  const { data: daftar, error } = await db.rpc("cadangan_daftar");
  if (error) throw new Error(`cadangan_daftar: ${error.message}`);
  const manifest: { tabel: string; baris: number; byte: number }[] = [];
  for (const tabel of daftar as string[]) {
    const { data: isi, error: e } = await db.rpc("cadangan_tabel", { p_tabel: tabel });
    if (e) throw new Error(`cadangan_tabel ${tabel}: ${e.message}`);
    const badan = teks(isi);
    const { error: eu } = await db.storage.from(BUCKET).upload(`${folder}/${tabel}.json`, badan, { contentType: "application/json", upsert: true });
    if (eu) throw new Error(`unggah ${tabel}: ${eu.message}`);
    manifest.push({ tabel, baris: (isi as unknown[]).length, byte: badan.byteLength });
  }
  const { error: em } = await db.storage.from(BUCKET).upload(`${folder}/manifest.json`, teks({ folder, dibuat: new Date().toISOString(), tabel: manifest }), { contentType: "application/json", upsert: true });
  if (em) throw new Error(`manifest: ${em.message}`);
  const baris = manifest.reduce((t, m) => t + m.baris, 0);
  const byte = manifest.reduce((t, m) => t + m.byte, 0);
  await db.rpc("cadangan_catat", { p_jenis: "cadangan", p_folder: folder, p_tabel: manifest.length, p_baris: baris, p_byte: byte, p_rincian: { tabel: manifest }, p_galat: null });

  // Rotasi hanya setelah cadangan minggu ini lengkap (manifest terunggah).
  const hapus = folderRotasi(await daftarFolder(db), folder);
  for (const f of hapus) {
    const { data: isi } = await db.storage.from(BUCKET).list(f, { limit: 1000 });
    const jalur = (isi ?? []).map((x) => `${f}/${x.name}`);
    if (jalur.length) await db.storage.from(BUCKET).remove(jalur);
  }
  if (hapus.length) await db.rpc("cadangan_catat", { p_jenis: "rotasi", p_folder: folder, p_tabel: 0, p_baris: 0, p_byte: 0, p_rincian: { dihapus: hapus }, p_galat: null });
  return { folder, tabel: manifest.length, baris, byte, dirotasi: hapus };
}

async function ujiPulih(db: SupabaseClient) {
  const [folder] = await daftarFolder(db);
  if (!folder) throw new Error("belum ada cadangan");
  const { data: m, error } = await db.storage.from(BUCKET).download(`${folder}/manifest.json`);
  if (error || !m) throw new Error(`manifest: ${error?.message}`);
  const manifest = JSON.parse(await m.text()) as { tabel: { tabel: string; baris: number }[] };
  const hasil: { tabel: string; baris: number; cocok: boolean }[] = [];
  for (const t of manifest.tabel) {
    const { data: berkas, error: eb } = await db.storage.from(BUCKET).download(`${folder}/${t.tabel}.json`);
    if (eb || !berkas) throw new Error(`unduh ${t.tabel}: ${eb?.message}`);
    const { data: r, error: er } = await db.rpc("cadangan_uji_pulih", { p_tabel: t.tabel, p_isi: JSON.parse(await berkas.text()) });
    if (er) throw new Error(`uji_pulih ${t.tabel}: ${er.message}`);
    const x = r as { baris: number; cocok: boolean };
    hasil.push({ tabel: t.tabel, baris: x.baris, cocok: x.cocok && x.baris === t.baris });
  }
  const gagal = hasil.filter((h) => !h.cocok).map((h) => h.tabel);
  const baris = hasil.reduce((s, h) => s + h.baris, 0);
  await db.rpc("cadangan_catat", { p_jenis: "pulih", p_folder: folder, p_tabel: hasil.length, p_baris: baris, p_byte: 0, p_rincian: { gagal, hasil }, p_galat: gagal.length ? `tidak cocok: ${gagal.join(", ")}` : null });
  return { folder, tabel: hasil.length, baris, gagal };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ galat: "Pakai POST" }, 405);
  const token = req.headers.get("x-nadi-token");
  if (!token) return json({ galat: "Token tidak ada" }, 401);
  const db = admin();
  const { data: cocok } = await db.rpc("push_token_cocok", { p_token: token });
  if (!cocok) return json({ galat: "Token tidak sah" }, 401);
  const isi = await req.json().catch(() => ({}));
  try {
    if (isi.aksi === "cadangan") return json(await cadangkan(db));
    if (isi.aksi === "uji_pulih") return json(await ujiPulih(db));
    return json({ galat: "Aksi tidak dikenal" }, 400);
  } catch (e) {
    const pesan = e instanceof Error ? e.message : String(e);
    await db.rpc("cadangan_catat", { p_jenis: isi.aksi === "uji_pulih" ? "pulih" : "cadangan", p_folder: new Date().toISOString().slice(0, 10), p_tabel: 0, p_baris: 0, p_byte: 0, p_rincian: {}, p_galat: pesan.slice(0, 500) });
    return json({ galat: pesan }, 500);
  }
});
