// Edge Function `pelajari-pindah` (T-01C): berkas pindah data yang judul kolomnya tidak dikenali dipetakan model sekali.
// Masukan hanya ringkasan berkas: judul kolom dan tipe tiap kolom, tanpa isi baris. Model ringan (naik ke berat bila ragu; ID model
// dari konfigurasi model_ai) memilih format (karyawan atau produk) dan memetakan bidang Nadi ke judul kolom. Pengawas bukan AI
// (peta.ts periksaPeta) memeriksa; tanpa peta tersimpan, peta yang lolos disimpan bayangan; dengan peta bayangan (peta_id), peta
// model dibandingkan: sama dihitung, cocok 2 kali aktif, beda sekali mati.
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { BIDANG_PETA, periksaPeta, petaSama, sidikJudul, type Peta, type Ringkas } from "./peta.ts";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const kunciEnv = (baru: string, lama: string) => {
  const j = Deno.env.get(baru);
  return j ? JSON.parse(j)["default"] : Deno.env.get(lama)!;
};
const ai = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
const BATAS_HARIAN = 30;
const BAYANGAN_WAJIB = 2;
const TIPE = ["teks", "angka", "tanggal", "hp", "kosong"];
const BIDANG = [...new Set(Object.values(BIDANG_PETA).flatMap((b) => Object.keys(b.boleh)))];

const json = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "Content-Type": "application/json" } });

const SKEMA = {
  type: "object",
  properties: {
    format: { type: "string", enum: ["karyawan", "produk", "tidak"] },
    kolom: { type: "array", items: { type: "object", properties: { bidang: { type: "string", enum: BIDANG }, judul: { type: "string" } }, required: ["bidang", "judul"], additionalProperties: false } },
    keyakinan: { type: "number" },
  },
  required: ["format", "kolom", "keyakinan"],
  additionalProperties: false,
};

const INSTRUKSI = `Kamu memetakan kolom berkas Excel/CSV milik usaha kecil di Indonesia ke bidang Nadi. Kamu hanya melihat judul kolom dan tipe isinya, bukan isinya.
Format karyawan: nama (wajib), id (kode/NIK karyawan), jabatan, telepon (nomor HP/WA), mulai (tanggal mulai kerja), gaji_pokok.
Format produk: nama (wajib, nama barang), kode (kode/SKU), satuan, harga_jual, stok.
Pilih format yang paling cocok, atau "tidak" bila berkas bukan daftar karyawan atau daftar barang.
Untuk setiap bidang yang ada padanannya, tulis judul kolom PERSIS seperti di daftar (huruf kecil). Satu judul hanya untuk satu bidang. Lewati kolom yang tidak cocok (catatan, harga grosir, keterangan).
Tipe kolom harus cocok: harga dan gaji berisi angka, mulai berisi tanggal, telepon berisi nomor HP.
keyakinan 0 sampai 1.`;

type Usul = { format: string; kolom: { bidang: string; judul: string }[]; keyakinan: number };

async function tanyaModel(model: string, r: Ringkas) {
  const daftar = r.judul.map((j, i) => `- "${j}" (${r.tipe[i]})`).join("\n");
  const res = await ai.messages.create({
    model, max_tokens: 800,
    system: [{ type: "text", text: INSTRUKSI, cache_control: { type: "ephemeral" } }],
    output_config: { effort: "low", format: { type: "json_schema", schema: SKEMA } },
    messages: [{ role: "user", content: `Judul kolom dan tipe isinya:\n${daftar}` }],
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
  const { ringkas, peta_id: petaId } = await req.json().catch(() => ({}));
  // Ringkasan dari pemanggil diperiksa bentuknya: judul pendek, tipe dari daftar tetap, sidik dihitung ulang di sini.
  const r = ringkas as Ringkas | undefined;
  if (!r || !Array.isArray(r.judul) || !Array.isArray(r.tipe) || r.judul.length !== r.tipe.length || r.judul.length < 2 || r.judul.length > 60
    || r.judul.some((j) => typeof j !== "string" || j.length > 60) || r.tipe.some((x) => !TIPE.includes(x)) || !Number.isInteger(r.baris_judul)) {
    return json({ galat: "ringkasan berkas tidak sah" }, 400);
  }
  const sidik = sidikJudul(r.judul);

  const pengguna = createClient(URL_SUPABASE, kunciEnv("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY"), { global: { headers: { Authorization: otorisasi } }, auth: { persistSession: false } });
  const { data: konteks, error: eKonteks } = await pengguna.rpc("learn_migration_context");
  if (eKonteks || !konteks) return json({ galat: "Hanya pemilik atau admin" }, 403);
  const pid = (konteks as { perusahaan_id: string }).perusahaan_id;

  const admin = createClient(URL_SUPABASE, kunciEnv("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const { count } = await admin.from("pemakaian_ai").select("id", { count: "exact", head: true }).eq("perusahaan_id", pid).eq("tugas", "pelajari_pindah").gte("dibuat_at", new Date(Date.now() - 86400000).toISOString());
  if ((count ?? 0) >= BATAS_HARIAN) return json({ galat: "Batas belajar format hari ini tercapai" }, 429);

  const { data: konf } = await admin.from("konfigurasi").select("nilai").eq("kunci", "model_ai").single();
  const tangga = konf?.nilai as { ringan: string; berat: string; ambang_naik: number };
  const coba = [await tanyaModel(tangga.ringan, r)];
  if (!coba[0].usul || coba[0].usul.keyakinan < tangga.ambang_naik) coba.push(await tanyaModel(tangga.berat, r));
  let token = 0;
  for (const [i, c] of coba.entries()) {
    token += c.usage.input_tokens + c.usage.output_tokens;
    await admin.from("pemakaian_ai").insert({ perusahaan_id: pid, tugas: "pelajari_pindah", model: i ? tangga.berat : tangga.ringan,
      token_masuk: c.usage.input_tokens, token_keluar: c.usage.output_tokens,
      token_cache_baca: c.usage.cache_read_input_tokens ?? 0, token_cache_tulis: c.usage.cache_creation_input_tokens ?? 0 });
  }
  const usul = coba.at(-1)!.usul ?? coba[0].usul;
  const model = coba.map((_, i) => (i ? tangga.berat : tangga.ringan));
  if (!usul || usul.format === "tidak") return json({ peta: null, status: "tidak", token, model });
  const peta: Peta = { format: usul.format as Peta["format"], kolom: Object.fromEntries(usul.kolom.map((k) => [k.bidang, k.judul.trim().toLowerCase()])) };
  const periksa = periksaPeta(r, peta);

  if (typeof petaId === "string") {
    const { data: lama } = await admin.from("pindah_peta").select("id, format, peta, status, bayangan_cocok").eq("id", petaId).eq("perusahaan_id", pid).maybeSingle();
    if (lama && lama.status === "bayangan") {
      const sama = periksa.lulus && petaSama(peta, { format: lama.format, kolom: lama.peta });
      const cocok = lama.bayangan_cocok + 1;
      const ubah = sama ? { bayangan_cocok: cocok, status: cocok >= BAYANGAN_WAJIB ? "aktif" : "bayangan", diubah_at: new Date().toISOString() }
        : { status: "mati", alasan_mati: periksa.lulus ? "peta model berbeda" : `peta model ditolak pengawas: ${periksa.alasan.slice(0, 2).join("; ")}`, diubah_at: new Date().toISOString() };
      await admin.from("pindah_peta").update(ubah).eq("id", lama.id);
      return json({ peta: periksa.lulus ? peta : { format: lama.format, kolom: lama.peta }, status: ubah.status, token, model });
    }
  }
  if (!periksa.lulus) {
    console.log("peta pindah ditolak", periksa.alasan.join("; "));
    return json({ peta: null, status: "ditolak", alasan: periksa.alasan, token, model });
  }
  const { error } = await admin.from("pindah_peta").insert({ perusahaan_id: pid, sidik, format: peta.format, peta: peta.kolom, asal: { model, keyakinan: usul.keyakinan } });
  return json({ peta, status: error ? "sudah ada" : "bayangan", token, model });
});
