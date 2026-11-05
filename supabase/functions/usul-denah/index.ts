// Edge Function `usul-denah` (T-01D): kamera Mata baru, satu bingkai yang SUDAH dikecilkan (<= 320 px) dan dikaburkan di perangkat
// (orang tidak dapat dikenali) dikirim sekali. Model ringan (naik ke berat bila ragu atau ditolak pengawas; ID model dari
// konfigurasi model_ai) mengusulkan zona pintu/kasir/antrean/rak/lorong/kerja/meja. Pengawas bukan AI (denah.ts periksaDenah)
// memeriksa; yang lolos disimpan sebagai DRAF di vision_camera_layout dan baru aktif setelah pemilik menyetujui di layar.
// Bingkai tidak disimpan. Kamera dengan sidik yang sama berikutnya memakai denah aktif tanpa memanggil fungsi ini (token 0).
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { JENIS_DENAH, periksaDenah, type ZonaUsul } from "./denah.ts";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const kunciEnv = (baru: string, lama: string) => {
  const j = Deno.env.get(baru);
  return j ? JSON.parse(j)["default"] : Deno.env.get(lama)!;
};
const ai = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
const BATAS_HARIAN = 20;
const json = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "Content-Type": "application/json" } });

const SKEMA = {
  type: "object",
  properties: {
    zona: { type: "array", items: { type: "object", properties: {
      nama: { type: "string" }, jenis: { type: "string", enum: JENIS_DENAH },
      poligon: { type: "array", items: { type: "array", items: { type: "number" } } },
    }, required: ["nama", "jenis", "poligon"], additionalProperties: false } },
    keyakinan: { type: "number" },
  },
  required: ["zona", "keyakinan"],
  additionalProperties: false,
};

const INSTRUKSI = `Kamu melihat satu bingkai kamera toko atau usaha kecil di Indonesia yang sengaja dikaburkan. Usulkan denah zona untuk penghitung kunjungan.
Jenis zona: pintu (tempat orang masuk dan keluar, wajib ada minimal satu; bila pintu tidak terlihat, pakai tepi bingkai tempat orang datang), kasir, antrean (depan kasir), rak, lorong, kerja (tempat karyawan, mis. balik meja), meja (meja makan).
Tulis 2 sampai 8 zona. Poligon berupa titik [x, y] dalam pecahan lebar dan tinggi bingkai (0 sampai 1), 4 sampai 8 titik searah jarum jam, tidak saling bertumpuk.
Nama zona pendek dalam bahasa Indonesia (mis. "Pintu", "Kasir", "Rak minuman"). keyakinan 0 sampai 1.`;

type Usul = { zona: ZonaUsul[]; keyakinan: number };

async function tanyaModel(model: string, gambar: string) {
  const res = await ai.messages.create({
    model, max_tokens: 1200,
    system: [{ type: "text", text: INSTRUKSI, cache_control: { type: "ephemeral" } }],
    output_config: { effort: "low", format: { type: "json_schema", schema: SKEMA } },
    messages: [{ role: "user", content: [
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: gambar } },
      { type: "text", text: "Usulkan denah zona untuk kamera ini." },
    ] }],
  } as Anthropic.MessageCreateParamsNonStreaming);
  const t = res.content.find((b) => b.type === "text");
  let usul: Usul | null = null;
  try { if (res.stop_reason === "end_turn" && t?.type === "text") usul = JSON.parse(t.text); } catch { usul = null; }
  return { usul, usage: res.usage };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ galat: "Pakai POST" }, 405);
  const otorisasi = req.headers.get("Authorization");
  if (!otorisasi) return json({ galat: "Masuk dulu" }, 401);
  const { gambar, sidik } = await req.json().catch(() => ({}));
  if (typeof sidik !== "string" || !/^[0-9a-f]{16,64}$/.test(sidik)) return json({ galat: "sidik kamera tidak sah" }, 400);
  if (typeof gambar !== "string" || gambar.length < 200 || gambar.length > 200_000 || !/^[A-Za-z0-9+/=]+$/.test(gambar)) {
    return json({ galat: "bingkai tidak sah (JPEG base64, maksimal 150 KB)" }, 400);
  }

  const pengguna = createClient(URL_SUPABASE, kunciEnv("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY"), { global: { headers: { Authorization: otorisasi } }, auth: { persistSession: false } });
  const { data: konteks, error: eKonteks } = await pengguna.rpc("learn_migration_context");
  if (eKonteks || !konteks) return json({ galat: "Hanya pemilik atau admin" }, 403);
  const pid = (konteks as { perusahaan_id: string }).perusahaan_id;

  const admin = createClient(URL_SUPABASE, kunciEnv("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const { count } = await admin.from("pemakaian_ai").select("id", { count: "exact", head: true }).eq("perusahaan_id", pid).eq("tugas", "usul_denah").gte("dibuat_at", new Date(Date.now() - 86400000).toISOString());
  if ((count ?? 0) >= BATAS_HARIAN) return json({ galat: "Batas usulan denah hari ini tercapai" }, 429);

  const { data: konf } = await admin.from("konfigurasi").select("nilai").eq("kunci", "model_ai").single();
  const tangga = konf?.nilai as { ringan: string; berat: string; ambang_naik: number };
  const coba = [await tanyaModel(tangga.ringan, gambar)];
  const lolos = (u: Usul | null) => Boolean(u && periksaDenah(u.zona).lulus);
  if (!lolos(coba[0].usul) || coba[0].usul!.keyakinan < tangga.ambang_naik) coba.push(await tanyaModel(tangga.berat, gambar));
  let token = 0;
  for (const [i, c] of coba.entries()) {
    token += c.usage.input_tokens + c.usage.output_tokens;
    await admin.from("pemakaian_ai").insert({ perusahaan_id: pid, tugas: "usul_denah", model: i ? tangga.berat : tangga.ringan,
      token_masuk: c.usage.input_tokens, token_keluar: c.usage.output_tokens,
      token_cache_baca: c.usage.cache_read_input_tokens ?? 0, token_cache_tulis: c.usage.cache_creation_input_tokens ?? 0 });
  }
  const model = coba.map((_, i) => (i ? tangga.berat : tangga.ringan));
  const usul = [...coba].reverse().map((c) => c.usul).find((u) => lolos(u)) ?? null;
  if (!usul) {
    const alasan = periksaDenah(coba.at(-1)!.usul?.zona ?? null).alasan;
    return json({ status: "ditolak", alasan, token, model });
  }
  const zona = usul.zona.map((z) => ({ nama: z.nama.trim(), jenis: z.jenis, poligon: z.poligon.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]) }));
  const { data: draf, error } = await admin.from("vision_camera_layout").insert({ perusahaan_id: pid, sidik, zona, asal: { model, keyakinan: usul.keyakinan } }).select("id").single();
  if (error) return json({ galat: "Draf denah gagal disimpan" }, 500);
  return json({ status: "draf", id: draf.id, zona, token, model });
});
