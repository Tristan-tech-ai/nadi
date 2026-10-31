// Estimasi Poin Beban dengan model ringan (F3-01, docs/research/poin-beban.md). Dipanggil server action dengan JWT pengguna
// hanya bila riwayat usaha kurang (RPC buat_kerja mengembalikan perlu_model). Semua hak diperiksa RPC atas nama pemanggil
// (konteks_estimasi dan simpan_estimasi_kerja: pemilik/admin, sekali per kerja); fungsi ini tidak memakai kunci rahasia Supabase.
// ID model dibaca dari public.konfigurasi (kunci model_ai, bidang ringan). Faktor kalibrasi usaha dikalikan di database.
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const kunciPublik = () => {
  const j = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  return j ? JSON.parse(j)["default"] : Deno.env.get("SUPABASE_ANON_KEY")!;
};
const ai = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

function json(isi: unknown, status = 200) {
  return new Response(JSON.stringify(isi), { status, headers: { "Content-Type": "application/json" } });
}

const SKEMA = {
  type: "object",
  properties: {
    menit: { type: "integer", description: "lama kerja wajar dalam menit untuk orang yang biasa memakai topi itu, 1 sampai 1485" },
    alasan: { type: "string", description: "satu kalimat bahasa Indonesia sehari-hari, paling banyak 160 huruf, menyebut dasar perkiraan" },
  },
  required: ["menit", "alasan"],
  additionalProperties: false,
};

const INSTRUKSI = [
  "Kamu memperkirakan lama satu kerja di usaha kecil Indonesia (warung, toko, kafe) dalam menit.",
  "Perkirakan waktu kerja wajar untuk orang yang biasa memakai topi (peran kerja) itu, tanpa waktu menunggu.",
  "Bila ada contoh kerja selesai beserta durasi nyatanya, jadikan itu patokan utama.",
  "Alasan: satu kalimat pendek, sapaan netral, tanpa tanda pisah panjang, tanpa emoji.",
].join(" ");

type Konteks = {
  id: string;
  judul: string;
  topi: { nama: string; deskripsi: string | null; tanggung_jawab: unknown } | null;
  estimasi: unknown;
  contoh: { judul: string; topi: string | null; menit: number }[];
};

function pesan(k: Konteks): string {
  const baris = [`Kerja: ${k.judul}`];
  if (k.topi) {
    baris.push(`Topi: ${k.topi.nama}${k.topi.deskripsi ? ` (${k.topi.deskripsi})` : ""}`);
    if (Array.isArray(k.topi.tanggung_jawab) && k.topi.tanggung_jawab.length) baris.push(`Tanggung jawab topi: ${JSON.stringify(k.topi.tanggung_jawab)}`);
  } else {
    baris.push("Topi: tidak disebut");
  }
  baris.push(k.contoh.length
    ? `Kerja selesai terdekat di usaha ini:\n${k.contoh.map((c) => `- ${c.judul}${c.topi ? ` [${c.topi}]` : ""}: ${c.menit} menit`).join("\n")}`
    : "Belum ada kerja selesai di usaha ini.");
  return baris.join("\n");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ galat: "Pakai POST" }, 405);
  const otorisasi = req.headers.get("Authorization");
  if (!otorisasi) return json({ galat: "Masuk dulu" }, 401);
  const { kerja_id } = await req.json().catch(() => ({ kerja_id: null }));
  if (typeof kerja_id !== "string" || !/^[0-9a-f-]{36}$/i.test(kerja_id)) return json({ galat: "kerja_id wajib" }, 400);

  const db = createClient(URL_SUPABASE, kunciPublik(), { global: { headers: { Authorization: otorisasi } }, auth: { persistSession: false } });
  const { data: k, error } = await db.rpc("konteks_estimasi", { p_kerja: kerja_id });
  if (error || !k) return json({ galat: error?.message ?? "Kerja tidak ditemukan" }, error?.code === "42501" ? 403 : 404);
  const konteks = k as Konteks;
  if (konteks.estimasi) return json({ status: "sudah", estimasi: konteks.estimasi });

  const { data: konf } = await db.from("konfigurasi").select("nilai").eq("kunci", "model_ai").maybeSingle();
  const model = (konf?.nilai as { ringan?: string } | null)?.ringan;
  if (!model) return json({ galat: "Model ringan belum diatur di konfigurasi" }, 503);

  let menit: number;
  let alasan: string;
  let usage: Anthropic.Usage;
  try {
    const r = await ai.messages.create({
      model,
      max_tokens: 1000,
      system: [{ type: "text", text: INSTRUKSI }],
      output_config: { effort: "low", format: { type: "json_schema", schema: SKEMA } },
      messages: [{ role: "user", content: [{ type: "text", text: pesan(konteks) }] }],
    } as Anthropic.MessageCreateParamsNonStreaming);
    const teks = r.content.find((b) => b.type === "text");
    if (r.stop_reason !== "end_turn" || teks?.type !== "text") return json({ galat: "Model tidak memberi perkiraan" }, 502);
    const h = JSON.parse(teks.text) as { menit?: unknown; alasan?: unknown };
    menit = Math.round(Number(h.menit));
    alasan = String(h.alasan ?? "").replace(/[–—]/g, ",").trim().slice(0, 200);
    usage = r.usage;
  } catch (e) {
    console.error("estimasi_kerja", kerja_id, e instanceof Error ? e.message : e);
    return json({ galat: "Model gagal dipanggil" }, 502);
  }
  // Kerja serupa yang selesai dalam hitungan detik membuat model menjawab < 1 menit (dibulatkan 0). Itu tetap perkiraan yang sah:
  // dinaikkan ke 1 menit (poin minimum 0,25 tetap berlaku), agar token yang sudah terpakai tercatat dan kerja tidak tanpa poin.
  if (!Number.isFinite(menit) || menit < 0 || menit > 1485) return json({ galat: "Perkiraan model di luar batas" }, 422);
  menit = Math.max(1, menit);

  const { data: estimasi, error: eSimpan } = await db.rpc("simpan_estimasi_kerja", {
    p_kerja: kerja_id, p_menit: menit, p_sumber: "model", p_alasan: alasan,
    p_pemakaian: {
      model, token_masuk: usage.input_tokens, token_keluar: usage.output_tokens,
      token_cache_baca: usage.cache_read_input_tokens ?? 0, token_cache_tulis: usage.cache_creation_input_tokens ?? 0,
    },
  });
  if (eSimpan) return json({ galat: eSimpan.message }, eSimpan.code === "55000" ? 409 : 422);
  return json({ status: "ok", estimasi });
});
