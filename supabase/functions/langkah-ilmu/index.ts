// Edge Function `langkah-ilmu` (F3-07C): transkrip penjelasan orang yang berhenti -> saran langkah kerja berurutan dengan model
// ringan. Dipanggil server action dengan JWT pengguna; hak (pemilik/admin), transkrip wajib, dan batas 3 panggilan per butir per
// 24 jam diperiksa RPC konteks_ilmu atas nama pemanggil. Fungsi ini tidak memakai kunci rahasia Supabase. ID model dibaca dari
// public.konfigurasi (kunci model_ai, bidang ringan). Keluaran divalidasi rapikanLangkah (masukan tak tepercaya); token dicatat
// lewat simpan_langkah_model walau keluarannya ditolak.
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { INSTRUKSI, SKEMA, pesanModel, rapikanLangkah } from "./inti.ts";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const kunciPublik = () => {
  const j = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  return j ? JSON.parse(j)["default"] : Deno.env.get("SUPABASE_ANON_KEY")!;
};
const ai = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
const json = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ galat: "Pakai POST" }, 405);
  const otorisasi = req.headers.get("Authorization");
  if (!otorisasi) return json({ galat: "Masuk dulu" }, 401);
  const { butir_id } = await req.json().catch(() => ({ butir_id: null }));
  if (typeof butir_id !== "string" || !/^[0-9a-f-]{36}$/i.test(butir_id)) return json({ galat: "butir_id wajib" }, 400);

  const db = createClient(URL_SUPABASE, kunciPublik(), { global: { headers: { Authorization: otorisasi } }, auth: { persistSession: false } });
  const { data: k, error } = await db.rpc("konteks_ilmu", { p_butir: butir_id });
  if (error || !k) {
    const status = error?.code === "42501" ? 403 : error?.code === "54000" ? 429 : error?.code === "55000" ? 409 : 404;
    return json({ galat: error?.message ?? "Butir tidak ditemukan", kode: error?.code }, status);
  }
  const konteks = k as { judul: string; transkrip: string };
  const { data: konf } = await db.from("konfigurasi").select("nilai").eq("kunci", "model_ai").maybeSingle();
  const model = (konf?.nilai as { ringan?: string } | null)?.ringan;
  if (!model) return json({ galat: "Model ringan belum diatur di konfigurasi" }, 503);

  let r: Anthropic.Message;
  try {
    r = await ai.messages.create({
      model,
      max_tokens: 2000,
      system: [{ type: "text", text: INSTRUKSI }],
      output_config: { effort: "low", format: { type: "json_schema", schema: SKEMA } },
      messages: [{ role: "user", content: [{ type: "text", text: pesanModel(konteks.judul, konteks.transkrip) }] }],
    } as Anthropic.MessageCreateParamsNonStreaming);
  } catch (e) {
    console.error("langkah_ilmu", butir_id, e instanceof Error ? e.message : e);
    return json({ galat: "Model gagal dipanggil" }, 502);
  }
  const teks = r.content.find((b) => b.type === "text");
  let langkah: string[] | null = null;
  if (r.stop_reason === "end_turn" && teks?.type === "text") {
    try { langkah = rapikanLangkah(JSON.parse(teks.text)); } catch { langkah = null; }
  }
  const pemakaian = {
    model, token_masuk: r.usage.input_tokens, token_keluar: r.usage.output_tokens,
    token_cache_baca: r.usage.cache_read_input_tokens ?? 0, token_cache_tulis: r.usage.cache_creation_input_tokens ?? 0,
  };
  const { error: eSimpan } = await db.rpc("simpan_langkah_model", { p_butir: butir_id, p_langkah: langkah, p_pemakaian: pemakaian });
  if (eSimpan) return json({ galat: eSimpan.message }, 422);
  if (!langkah) return json({ galat: "Keluaran model tidak berbentuk langkah kerja", kode: "bentuk" }, 422);
  return json({ status: "ok", langkah });
});
