// Edge Function `baca-berkas`: membaca satu berkas Lempar Saja dengan model AI dan menyiapkan usulan untuk disetujui.
// Tangga kecerdasan: model ringan dulu, naik ke model berat bila keyakinan di bawah ambang. ID model dari tabel konfigurasi.
// Berkas yang sudah diproses (status bukan 'unggah'/'gagal') tidak diproses ulang.
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { unzipSync } from "npm:fflate@0.8.3";
import { INSTRUKSI, SKEMA_HASIL, hasilDari, usulanDari, xlsxKeTeks } from "./inti.ts";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const kunciEnv = (baru: string, lama: string) => {
  const j = Deno.env.get(baru);
  return j ? JSON.parse(j)["default"] : Deno.env.get(lama)!;
};
const ai = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

function json(isi: unknown, status = 200) {
  return new Response(JSON.stringify(isi), { status, headers: { "Content-Type": "application/json" } });
}

function base64(byte: Uint8Array): string {
  let s = "";
  for (let i = 0; i < byte.length; i += 0x8000) s += String.fromCharCode(...byte.subarray(i, i + 0x8000));
  return btoa(s);
}

type Blok = Anthropic.ContentBlockParam;

function isiUntukModel(mime: string, byte: Uint8Array, nama: string): Blok[] {
  if (mime === "application/pdf") return [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: base64(byte) } }];
  if (mime === "image/jpeg" || mime === "image/png" || mime === "image/webp") return [{ type: "image", source: { type: "base64", media_type: mime, data: base64(byte) } }];
  if (mime === "text/csv") return [{ type: "text", text: `Isi berkas CSV "${nama}":\n${new TextDecoder().decode(byte)}` }];
  return [{ type: "text", text: `Isi berkas Excel "${nama}" (diubah ke CSV per lembar):\n${xlsxKeTeks(unzipSync(byte))}` }];
}

async function baca(model: string, isi: Blok[]) {
  const r = await ai.messages.create({
    model,
    max_tokens: 16000,
    // Instruksi stabil di depan dan ditandai cache agar panggilan berikutnya membaca dari cache.
    system: [{ type: "text", text: INSTRUKSI, cache_control: { type: "ephemeral" } }],
    output_config: { effort: "low", format: { type: "json_schema", schema: SKEMA_HASIL } },
    messages: [{ role: "user", content: [...isi, { type: "text", text: "Baca berkas ini dan isi skemanya." }] }],
  } as Anthropic.MessageCreateParamsNonStreaming);
  const teks = r.content.find((b) => b.type === "text");
  const hasil = r.stop_reason === "end_turn" && teks?.type === "text" ? hasilDari(JSON.parse(teks.text)) : null;
  return { hasil, berhenti: r.stop_reason, usage: r.usage, model };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ galat: "Pakai POST" }, 405);
  const otorisasi = req.headers.get("Authorization");
  if (!otorisasi) return json({ galat: "Masuk dulu" }, 401);
  const { berkas_id } = await req.json().catch(() => ({ berkas_id: null }));
  if (typeof berkas_id !== "string") return json({ galat: "berkas_id wajib" }, 400);

  // Hak akses diperiksa atas nama pemanggil (RLS): hanya berkas yang boleh ia lihat.
  const pengguna = createClient(URL_SUPABASE, kunciEnv("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: otorisasi } },
    auth: { persistSession: false },
  });
  const { data: berkas } = await pengguna.from("berkas").select("id, perusahaan_id, jalur, nama_asli, mime, status").eq("id", berkas_id).maybeSingle();
  if (!berkas) return json({ galat: "Berkas tidak ditemukan" }, 404);

  const admin = createClient(URL_SUPABASE, kunciEnv("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  // Klaim atomik: hanya satu pemanggil yang memproses; berkas selesai tidak diproses ulang.
  const { data: diklaim } = await admin.from("berkas").update({ status: "proses", galat: null, diubah_at: new Date().toISOString() })
    .eq("id", berkas_id).in("status", ["unggah", "gagal"]).select("id");
  if (!diklaim?.length) return json({ status: berkas.status, diproses_ulang: false });

  const gagal = async (pesan: string, status = 422) => {
    await admin.from("berkas").update({ status: "gagal", galat: pesan, diubah_at: new Date().toISOString() }).eq("id", berkas_id);
    return json({ status: "gagal", galat: pesan }, status);
  };

  try {
    const { data: unduh, error: eUnduh } = await admin.storage.from("berkas").download(berkas.jalur);
    if (eUnduh || !unduh) return await gagal("Berkas belum terunggah. Lempar ulang berkasnya.", 409);
    const isi = isiUntukModel(berkas.mime, new Uint8Array(await unduh.arrayBuffer()), berkas.nama_asli ?? "berkas");

    const { data: konf } = await admin.from("konfigurasi").select("nilai").eq("kunci", "model_ai").single();
    const tangga = konf?.nilai as { ringan: string; berat: string; ambang_naik: number };

    const percobaan = [await baca(tangga.ringan, isi)];
    const pertama = percobaan[0].hasil;
    if (!pertama || pertama.keyakinan < tangga.ambang_naik || pertama.jenis === "lainnya") percobaan.push(await baca(tangga.berat, isi));
    const akhir = percobaan.at(-1)!;

    let token = 0;
    for (const p of percobaan) {
      token += p.usage.input_tokens + p.usage.output_tokens;
      await admin.from("pemakaian_ai").insert({
        perusahaan_id: berkas.perusahaan_id, berkas_id, tugas: "baca_berkas", model: p.model,
        token_masuk: p.usage.input_tokens, token_keluar: p.usage.output_tokens,
        token_cache_baca: p.usage.cache_read_input_tokens ?? 0, token_cache_tulis: p.usage.cache_creation_input_tokens ?? 0,
      });
    }
    const hasil = akhir.hasil ?? pertama;
    if (!hasil) {
      await admin.from("berkas").update({ token_ai: token }).eq("id", berkas_id);
      return await gagal(`Nadi belum bisa membaca berkas ini (${akhir.berhenti}). Coba foto ulang lebih jelas.`);
    }

    const u = usulanDari(hasil);
    const { data: usulan } = await admin.from("usulan").insert({
      perusahaan_id: berkas.perusahaan_id, sumber: "lempar", aksi: u.aksi, judul: u.judul, penjelasan: u.penjelasan,
      payload: { jenis: hasil.jenis, bidang: hasil.bidang, ringkasan: hasil.ringkasan }, keyakinan: hasil.keyakinan,
      dampak_rp: u.dampak_rp, berkas_id,
    }).select("id").single();
    await admin.from("berkas").update({
      status: "usulan", jenis_terdeteksi: hasil.jenis, hasil, token_ai: token, diubah_at: new Date().toISOString(),
    }).eq("id", berkas_id);
    return json({ status: "usulan", jenis: hasil.jenis, keyakinan: hasil.keyakinan, hasil, usulan_id: usulan?.id, token, model: percobaan.map((p) => p.model) });
  } catch (e) {
    console.error("baca-berkas", berkas_id, e instanceof Error ? e.message : e);
    return await gagal("Nadi gagal membaca berkas ini. Coba lagi sebentar.", 500);
  }
});
