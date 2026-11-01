// Edge Function `analis-malam`: memperhalus kalimat Sarapan Data lewat Message Batches API (harga 50%, selesai <= 24 jam).
// Dipanggil pg_cron lewat app.panggil_analis dengan header x-nadi-token (token Vault yang sama dengan push); di-deploy tanpa
// verify_jwt dan memeriksa sendiri. Aksi: { aksi: "kirim" } membuat satu batch berisi satu permintaan per usaha yang punya
// insight tanpa teks_model; { aksi: "ambil" } membaca batch yang sudah selesai dan menyimpan kalimat yang lolos periksaKalimat.
// ID model dari tabel konfigurasi (model_ai.ringan). Gagal di mana pun = teks aturan tetap tampil; tidak ada yang hilang.
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { INSTRUKSI, SKEMA, idPermintaan, kelompokkan, pesanUsaha, saringJawaban, type Bahan } from "./inti.ts";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;

function kunciRahasia(): string {
  const baru = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (baru) return JSON.parse(baru)["default"];
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}

const ai = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

function json(isi: unknown, status = 200) {
  return new Response(JSON.stringify(isi), { status, headers: { "Content-Type": "application/json" } });
}

async function bahan(db: SupabaseClient): Promise<Bahan[]> {
  const { data, error } = await db.rpc("analis_bahan");
  if (error) throw new Error(`analis_bahan: ${error.message}`);
  return (data ?? []) as Bahan[];
}

async function kirim(db: SupabaseClient) {
  const semua = await bahan(db);
  if (!semua.length) return { kirim: 0 };
  const { data: konf } = await db.from("konfigurasi").select("nilai").eq("kunci", "model_ai").single();
  const model = (konf?.nilai as { ringan: string } | null)?.ringan;
  if (!model) return { galat: "model_ai.ringan belum diatur" };
  const requests = [...kelompokkan(semua)].map(([pid, daftar]) => ({
    custom_id: idPermintaan(pid),
    params: {
      model,
      max_tokens: 1024,
      system: INSTRUKSI,
      output_config: { effort: "low", format: { type: "json_schema", schema: SKEMA } },
      messages: [{ role: "user", content: pesanUsaha(daftar) }],
    },
  }));
  const batch = await ai.messages.batches.create({ requests } as unknown as Parameters<typeof ai.messages.batches.create>[0]);
  await db.rpc("analis_batch_catat", { p_batch: batch.id, p_jumlah: requests.length });
  return { kirim: requests.length, batch: batch.id };
}

async function ambil(db: SupabaseClient) {
  const { data: jalan } = await db.rpc("analis_batch_jalan");
  const ids = (jalan ?? []) as string[];
  if (!ids.length) return { batch: 0 };
  const semua = kelompokkan(await bahan(db));
  const perId = new Map([...semua].map(([pid, daftar]) => [idPermintaan(pid), { pid, daftar }]));
  const { data: konf } = await db.from("konfigurasi").select("nilai").eq("kunci", "model_ai").single();
  const model = (konf?.nilai as { ringan: string } | null)?.ringan ?? "";
  let disimpan = 0;
  let selesai = 0;
  for (const id of ids) {
    const b = await ai.messages.batches.retrieve(id);
    if (b.processing_status !== "ended") continue;
    const simpan: { id: string; teks: string }[] = [];
    for await (const r of await ai.messages.batches.results(id)) {
      const tujuan = perId.get(r.custom_id);
      if (!tujuan || r.result.type !== "succeeded") continue;
      const m = r.result.message;
      await db.from("pemakaian_ai").insert({
        perusahaan_id: tujuan.pid, tugas: "analis_malam", model: m.model || model,
        token_masuk: m.usage.input_tokens, token_keluar: m.usage.output_tokens,
        token_cache_baca: m.usage.cache_read_input_tokens ?? 0, token_cache_tulis: m.usage.cache_creation_input_tokens ?? 0,
      });
      const t = m.content.find((c) => c.type === "text");
      if (m.stop_reason !== "end_turn" || t?.type !== "text") continue;
      try {
        simpan.push(...saringJawaban(JSON.parse(t.text), tujuan.daftar));
      } catch {
        // JSON rusak: teks aturan tetap dipakai.
      }
    }
    if (simpan.length) {
      const { data: n } = await db.rpc("analis_simpan", { p_hasil: simpan });
      disimpan += Number(n) || 0;
    }
    await db.rpc("analis_batch_catat", { p_batch: id, p_jumlah: 0, p_status: "selesai",
      p_catatan: `${b.request_counts.succeeded} berhasil, ${b.request_counts.errored} galat, ${b.request_counts.expired} kedaluwarsa` });
    selesai++;
  }
  return { batch: ids.length, selesai, disimpan };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ galat: "Pakai POST" }, 405);
  const token = req.headers.get("x-nadi-token");
  if (!token) return json({ galat: "Token wajib" }, 401);
  const db = createClient(URL_SUPABASE, kunciRahasia(), { auth: { persistSession: false } });
  const { data: cocok } = await db.rpc("push_token_cocok", { p_token: token });
  if (!cocok) return json({ galat: "Token tidak sah" }, 401);
  const isi = await req.json().catch(() => ({}));
  try {
    if (isi.aksi === "kirim") return json(await kirim(db));
    if (isi.aksi === "ambil") return json(await ambil(db));
    return json({ galat: "Aksi tidak dikenal" }, 400);
  } catch (e) {
    console.log("analis-malam gagal", e instanceof Error ? e.message : String(e));
    return json({ galat: "Analis Malam gagal; teks aturan tetap dipakai" }, 500);
  }
});
