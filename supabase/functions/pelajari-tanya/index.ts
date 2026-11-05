// Edge Function `pelajari-tanya` (T-01A): kalimat tanya data yang tidak dikenali pengurai aplikasi dibaca model sekali.
// Model ringan (naik ke berat bila ragu; ID model dari tabel konfigurasi model_ai) memilih satu dari 13 niat tetap dan kata kunci
// di kalimat. Tanpa aturan: usulan diperiksa pengawas bukan AI lalu disimpan bayangan. Dengan aturan bayangan (aturan_id):
// hasil model dibandingkan; sama dihitung, cocok 2 kali menjadi aktif, beda sekali mati. Model tidak pernah menulis SQL;
// jawaban angka tetap dihitung RPC ask_data dari niat tetap.
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { NIAT_DAFTAR } from "./urai.ts";
import { BAYANGAN_WAJIB, periksaAturanTanya } from "./pengawas.ts";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const kunciEnv = (baru: string, lama: string) => {
  const j = Deno.env.get(baru);
  return j ? JSON.parse(j)["default"] : Deno.env.get(lama)!;
};
const ai = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
const BATAS_HARIAN = 50;

const json = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "Content-Type": "application/json" } });

const SKEMA = {
  type: "object",
  properties: {
    niat: { type: "string", enum: [...NIAT_DAFTAR, "tidak"] },
    kata: { type: "string" },
    keyakinan: { type: "number" },
  },
  required: ["niat", "kata", "keyakinan"],
  additionalProperties: false,
};

const INSTRUKSI = `Kamu memetakan pertanyaan pemilik usaha kecil di Indonesia ke SATU niat dari daftar tetap. Kamu tidak menjawab pertanyaannya.
Niat: pendapatan (penjualan, omzet, uang masuk dari jualan), beban (pengeluaran, biaya, belanja), laba (untung, rugi), kas (saldo uang di kas/bank), piutang (tagihan pelanggan yang belum dibayar), piutang_lewat (tagihan pelanggan yang lewat jatuh tempo), hutang (tagihan pemasok yang belum dibayar), invoice_terbit (jumlah invoice yang diterbitkan), karyawan (jumlah karyawan), hadir (kehadiran/absen), lembur, gaji (total gaji dibayar), stok (sisa barang).
Bila pertanyaan meminta pendapat, sebab, saran, ramalan, atau tidak cocok dengan niat mana pun, pilih "tidak".
kata = kata atau frasa 1-3 kata yang PERSIS ada di pertanyaan (huruf kecil) dan yang menunjukkan niat itu, misalnya "cuan" untuk laba. Jangan memakai kata waktu (bulan ini, minggu lalu), nama orang, atau angka.
keyakinan = 0 sampai 1.`;

type Usul = { niat: string; kata: string; keyakinan: number };

async function tanyaModel(model: string, kalimat: string): Promise<{ usul: Usul | null; usage: Anthropic.Usage }> {
  const r = await ai.messages.create({
    model, max_tokens: 400,
    system: [{ type: "text", text: INSTRUKSI, cache_control: { type: "ephemeral" } }],
    output_config: { effort: "low", format: { type: "json_schema", schema: SKEMA } },
    messages: [{ role: "user", content: `Pertanyaan: ${kalimat.slice(0, 200)}` }],
  } as Anthropic.MessageCreateParamsNonStreaming);
  const t = r.content.find((b) => b.type === "text");
  let usul: Usul | null = null;
  try { if (r.stop_reason === "end_turn" && t?.type === "text") usul = JSON.parse(t.text); } catch { usul = null; }
  return { usul, usage: r.usage };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ galat: "Pakai POST" }, 405);
  const otorisasi = req.headers.get("Authorization");
  if (!otorisasi) return json({ galat: "Masuk dulu" }, 401);
  const { kalimat, hari_ini: hariIni, aturan_id: aturanId } = await req.json().catch(() => ({}));
  if (typeof kalimat !== "string" || kalimat.trim().length < 3 || typeof hariIni !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(hariIni)) return json({ galat: "kalimat dan hari_ini wajib" }, 400);

  // Usaha dan peran dari JWT pemanggil sendiri (RLS), bukan dari isi permintaan.
  const pengguna = createClient(URL_SUPABASE, kunciEnv("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY"), { global: { headers: { Authorization: otorisasi } }, auth: { persistSession: false } });
  const { data: konteks, error: eKonteks } = await pengguna.rpc("learn_question_context");
  if (eKonteks || !konteks) return json({ galat: "Tanya data hanya untuk pemilik, admin, dan akuntan" }, 403);
  const pid = (konteks as { perusahaan_id: string }).perusahaan_id;

  const admin = createClient(URL_SUPABASE, kunciEnv("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const sejak = new Date(Date.now() - 86400000).toISOString();
  const { count } = await admin.from("pemakaian_ai").select("id", { count: "exact", head: true }).eq("perusahaan_id", pid).eq("tugas", "pelajari_tanya").gte("dibuat_at", sejak);
  if ((count ?? 0) >= BATAS_HARIAN) return json({ galat: "Batas belajar pertanyaan hari ini tercapai" }, 429);

  const { data: konf } = await admin.from("konfigurasi").select("nilai").eq("kunci", "model_ai").single();
  const tangga = konf?.nilai as { ringan: string; berat: string; ambang_naik: number };
  const coba = [await tanyaModel(tangga.ringan, kalimat)];
  if (!coba[0].usul || coba[0].usul.keyakinan < tangga.ambang_naik) coba.push(await tanyaModel(tangga.berat, kalimat));
  let token = 0;
  for (const [i, c] of coba.entries()) {
    token += c.usage.input_tokens + c.usage.output_tokens;
    await admin.from("pemakaian_ai").insert({ perusahaan_id: pid, tugas: "pelajari_tanya", model: i ? tangga.berat : tangga.ringan,
      token_masuk: c.usage.input_tokens, token_keluar: c.usage.output_tokens,
      token_cache_baca: c.usage.cache_read_input_tokens ?? 0, token_cache_tulis: c.usage.cache_creation_input_tokens ?? 0 });
  }
  const usul = coba.at(-1)!.usul ?? coba[0].usul;
  const niat = usul && usul.niat !== "tidak" && (NIAT_DAFTAR as readonly string[]).includes(usul.niat) ? usul.niat : null;
  const model = coba.map((_, i) => (i ? tangga.berat : tangga.ringan));

  // Mode banding: aturan bayangan usaha ini dibandingkan dengan jawaban model.
  if (typeof aturanId === "string") {
    const { data: a } = await admin.from("tanya_aturan").select("id, niat, status, bayangan_cocok").eq("id", aturanId).eq("perusahaan_id", pid).maybeSingle();
    if (a && a.status === "bayangan") {
      const sama = niat === a.niat;
      const cocok = a.bayangan_cocok + 1;
      const ubah = sama ? { bayangan_cocok: cocok, status: cocok >= BAYANGAN_WAJIB ? "aktif" : "bayangan", diubah_at: new Date().toISOString() }
        : { status: "mati", alasan_mati: `beda dengan model: ${niat ?? "tidak"} bukan ${a.niat}`, diubah_at: new Date().toISOString() };
      await admin.from("tanya_aturan").update(ubah).eq("id", a.id);
      return json({ niat, aturan: ubah.status, token, model });
    }
    return json({ niat, aturan: a?.status ?? "tidak ada", token, model });
  }

  if (!niat || !usul) return json({ niat: null, aturan: "tidak", token, model });
  const kata = usul.kata.trim().toLowerCase().replace(/\s+/g, " ");
  const periksa = periksaAturanTanya(kalimat, kata, niat, hariIni);
  if (!periksa.lulus) {
    console.log("aturan tanya ditolak", periksa.alasan.join("; "));
    return json({ niat, aturan: "ditolak", alasan: periksa.alasan, token, model });
  }
  const { error } = await admin.from("tanya_aturan").insert({ perusahaan_id: pid, kata, niat, asal: { model, keyakinan: usul.keyakinan } });
  return json({ niat, aturan: error ? "sudah ada" : "bayangan", kata, token, model });
});
