// Edge Function `putuskan`: tingkat model gerbang keputusan (F1-06B, docs/research/keputusan-model.md).
// 1) Dari database (trigger rute_usulan_model -> pg_net, header x-nadi-token dari Vault): { usulan_id }. Klaim antrean lewat
//    RPC peran layanan rute_model_ambil (sekali; ulangan tidak lanjut), panggil model ringan dengan judul, aksi, dan penjelasan
//    saja (angka panjang disensor), lalu rute_model_simpan menerapkan ambang (yakin >= 0,85: hanya pilihan pemilik yang
//    mempersempit untuk_peran, pilihan admin dicatat sebagai saran) atau rute_model_gagal mencatat galat.
// 2) Uji oleh pemilik/admin (scripts/eval-keputusan.ts, JWT pengguna): { uji: { judul, aksi, penjelasan } }. Tidak mengubah data;
//    dibatasi per hari dan tokennya dicatat (rute_model_uji_mulai / rute_model_uji_catat atas nama pemanggil).
// Di-deploy tanpa verify_jwt dan memeriksa sendiri. ID model dibaca dari public.konfigurasi (model_ai.ringan), bukan dari kode.
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { INSTRUKSI, SKEMA, pesan, rapikan, tindakan, type IsiUsulan, type Rute } from "./inti.ts";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const ai = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY"), maxRetries: 1, timeout: 20_000 });

function kunciRahasia(): string {
  const baru = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (baru) return JSON.parse(baru)["default"];
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}
function kunciPublik(): string {
  const baru = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (baru) return JSON.parse(baru)["default"];
  return Deno.env.get("SUPABASE_ANON_KEY")!;
}
const layanan = () => createClient(URL_SUPABASE, kunciRahasia(), { auth: { persistSession: false } });

function json(isi: unknown, status = 200) {
  return new Response(JSON.stringify(isi), { status, headers: { "Content-Type": "application/json" } });
}

type Pemakaian = { model: string; token_masuk: number; token_keluar: number; token_cache_baca: number; token_cache_tulis: number };
type Hasil = { rute: Rute; latensi_ms: number; pemakaian: Pemakaian };

class GagalModel extends Error {
  constructor(pesan: string, readonly pemakaian: Pemakaian | null) {
    super(pesan);
  }
}

/** Satu panggilan model ringan dengan keluaran terstruktur; latensi diukur di sekitar panggilan saja. */
async function tanyaModel(model: string, u: IsiUsulan): Promise<Hasil> {
  const t0 = performance.now();
  let r: Anthropic.Message;
  try {
    r = await ai.messages.create({
      model,
      max_tokens: 1000,
      system: [{ type: "text", text: INSTRUKSI }],
      output_config: { effort: "low", format: { type: "json_schema", schema: SKEMA } },
      messages: [{ role: "user", content: [{ type: "text", text: pesan(u) }] }],
    } as Anthropic.MessageCreateParamsNonStreaming);
  } catch (e) {
    const status = e instanceof Anthropic.APIError ? ` ${e.status}` : "";
    throw new GagalModel(`Model gagal dipanggil${status}: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}`, null);
  }
  const latensi_ms = Math.round((performance.now() - t0) * 10) / 10;
  const pemakaian: Pemakaian = {
    model, token_masuk: r.usage.input_tokens, token_keluar: r.usage.output_tokens,
    token_cache_baca: r.usage.cache_read_input_tokens ?? 0, token_cache_tulis: r.usage.cache_creation_input_tokens ?? 0,
  };
  const teks = r.content.find((b) => b.type === "text");
  if (r.stop_reason !== "end_turn" || teks?.type !== "text") throw new GagalModel(`Model tidak menjawab (${r.stop_reason})`, pemakaian);
  let mentah: unknown;
  try {
    mentah = JSON.parse(teks.text);
  } catch {
    throw new GagalModel("Jawaban model bukan JSON", pemakaian);
  }
  return { rute: rapikan(mentah), latensi_ms, pemakaian };
}

async function dariDatabase(usulanId: unknown): Promise<Response> {
  if (typeof usulanId !== "string" || !/^[0-9a-f-]{36}$/i.test(usulanId)) return json({ galat: "usulan_id wajib" }, 400);
  const db = layanan();
  const { data: a, error } = await db.rpc("rute_model_ambil", { p_usulan: usulanId });
  if (error) return json({ galat: error.message }, 500);
  const ambil = a as { lanjut: boolean; status?: string; judul: string; aksi: string; penjelasan: string; model: string | null };
  if (!ambil.lanjut) return json({ status: ambil.status ?? "sudah" });
  if (!ambil.model) {
    await db.rpc("rute_model_gagal", { p_usulan: usulanId, p_galat: "Model ringan belum diatur di konfigurasi", p_pemakaian: null });
    return json({ galat: "Model ringan belum diatur" }, 503);
  }
  try {
    const h = await tanyaModel(ambil.model, ambil);
    const { data, error: eSimpan } = await db.rpc("rute_model_simpan", {
      p_usulan: usulanId, p_pilihan: h.rute.pilihan, p_peluang: h.rute.peluang, p_yakin: h.rute.yakin, p_alasan: h.rute.alasan,
      p_latensi_ms: h.latensi_ms, p_model: ambil.model, p_pemakaian: h.pemakaian,
    });
    if (eSimpan) {
      await db.rpc("rute_model_gagal", { p_usulan: usulanId, p_galat: `Simpan gagal: ${eSimpan.message}`, p_pemakaian: h.pemakaian });
      return json({ galat: eSimpan.message }, 500);
    }
    return json({ ...(data as object), latensi_ms: h.latensi_ms });
  } catch (e) {
    const g = e instanceof GagalModel ? e : new GagalModel(e instanceof Error ? e.message : String(e), null);
    console.error("putuskan", usulanId, g.message);
    await db.rpc("rute_model_gagal", { p_usulan: usulanId, p_galat: g.message, p_pemakaian: g.pemakaian });
    return json({ galat: g.message }, 502);
  }
}

async function uji(otorisasi: string, isi: unknown): Promise<Response> {
  const u = (isi ?? {}) as Partial<IsiUsulan>;
  if (typeof u.judul !== "string" || !u.judul.trim() || typeof u.aksi !== "string" || !u.aksi.trim()) {
    return json({ galat: "uji butuh judul dan aksi" }, 400);
  }
  const db = createClient(URL_SUPABASE, kunciPublik(), { global: { headers: { Authorization: otorisasi } }, auth: { persistSession: false } });
  const { data: m, error } = await db.rpc("rute_model_uji_mulai");
  if (error) return json({ galat: error.message }, error.code === "42501" ? 403 : error.code === "54000" ? 429 : 400);
  const mulai = m as { id: string; model: string };
  try {
    const h = await tanyaModel(mulai.model, { judul: u.judul, aksi: u.aksi, penjelasan: typeof u.penjelasan === "string" ? u.penjelasan : null });
    await db.rpc("rute_model_uji_catat", { p_id: mulai.id, p_pemakaian: h.pemakaian });
    return json({ ...h.rute, tindakan: tindakan(h.rute.yakin), latensi_ms: h.latensi_ms, token_masuk: h.pemakaian.token_masuk, token_keluar: h.pemakaian.token_keluar });
  } catch (e) {
    const g = e instanceof GagalModel ? e : new GagalModel(String(e), null);
    if (g.pemakaian) await db.rpc("rute_model_uji_catat", { p_id: mulai.id, p_pemakaian: g.pemakaian });
    return json({ galat: g.message }, 502);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ galat: "Pakai POST" }, 405);
  const isi = await req.json().catch(() => ({}));
  const token = req.headers.get("x-nadi-token");
  if (token) {
    const { data: cocok } = await layanan().rpc("push_token_cocok", { p_token: token });
    if (!cocok) return json({ galat: "Token tidak sah" }, 401);
    return await dariDatabase(isi.usulan_id);
  }
  const otorisasi = req.headers.get("Authorization");
  if (!otorisasi) return json({ galat: "Masuk dulu" }, 401);
  return await uji(otorisasi, isi.uji);
});
