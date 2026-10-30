// Edge Function `baca-berkas`: membaca satu berkas Lempar Saja dan menyiapkan usulan untuk disetujui.
// Urutan hemat: (1) aturan tersimpan untuk tata letak ini, tanpa token; (2) model ringan lalu berat bila keyakinan
// di bawah ambang (ID model dari tabel konfigurasi); (3) setelah model berhasil pada berkas berteks, model berat menulis
// aturan sekali di latar belakang, aturan diuji pada berkas yang sama, dan hanya yang lulus disimpan.
// Berkas yang sudah diproses (status bukan 'unggah'/'gagal') tidak diproses ulang.
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { unzipSync } from "npm:fflate@0.8.3";
import { extractText, getDocumentProxy } from "npm:unpdf@1.9.1";
import { BIDANG, INSTRUKSI, SKEMA_HASIL, hasilDari, rapikan, usulanDari, xlsxKeTeks, type Hasil, type Jenis } from "./inti.ts";
import { INSTRUKSI_ATURAN, SKEMA_ATURAN, aturanDari, cocok, jalankan, konsisten, perbaikiTipe, sidik, ujiAturan, type Aturan, type AturanMentah } from "./ekstraktor.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

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

/** Teks berkas tanpa model: lapisan teks PDF, isi CSV, atau Excel sebagai CSV. Null untuk foto (butuh model). */
async function teksBerkas(mime: string, byte: Uint8Array): Promise<string | null> {
  if (mime === "text/csv") return new TextDecoder().decode(byte);
  if (mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return xlsxKeTeks(unzipSync(byte));
  if (mime === "application/pdf") {
    try {
      const { text } = await extractText(await getDocumentProxy(byte), { mergePages: true });
      const t = String(text);
      return t.replace(/\s/g, "").length > 40 ? t : null; // PDF hasil pindai tanpa lapisan teks
    } catch {
      return null;
    }
  }
  return null;
}

function isiUntukModel(mime: string, byte: Uint8Array, nama: string, teks: string | null): Blok[] {
  if (mime === "application/pdf") return [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: base64(byte) } }];
  if (mime === "image/jpeg" || mime === "image/png" || mime === "image/webp") return [{ type: "image", source: { type: "base64", media_type: mime, data: base64(byte) } }];
  if (mime === "text/csv") return [{ type: "text", text: `Isi berkas CSV "${nama}":\n${teks}` }];
  return [{ type: "text", text: `Isi berkas Excel "${nama}" (diubah ke CSV per lembar):\n${teks}` }];
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

async function catatPemakaian(db: SupabaseClient, perusahaan_id: string, berkas_id: string, tugas: string, model: string, usage: Anthropic.Usage) {
  await db.from("pemakaian_ai").insert({
    perusahaan_id, berkas_id, tugas, model,
    token_masuk: usage.input_tokens, token_keluar: usage.output_tokens,
    token_cache_baca: usage.cache_read_input_tokens ?? 0, token_cache_tulis: usage.cache_creation_input_tokens ?? 0,
  });
}

/** Coba aturan tersimpan milik usaha ini (atau milik bersama) yang cocok, lengkap, dan konsisten. */
async function cobaAturan(db: SupabaseClient, perusahaan_id: string, teks: string): Promise<{ hasil: Hasil; ekstraktorId: string } | null> {
  const { data } = await db.from("ekstraktor").select("id, aturan, dipakai")
    .eq("aktif", true).or(`perusahaan_id.eq.${perusahaan_id},perusahaan_id.is.null`);
  for (const e of data ?? []) {
    const aturan = e.aturan as Aturan;
    try {
      if (!cocok(aturan, teks)) continue;
      const h = jalankan(aturan, teks);
      if (!h.lengkap || konsisten(aturan.jenis, h.bidang).length) continue;
      await db.from("ekstraktor").update({ dipakai: e.dipakai + 1 }).eq("id", e.id);
      const jenis = aturan.jenis as Jenis;
      return { ekstraktorId: e.id, hasil: { jenis, keyakinan: 0.99, ringkasan: "", bidang: rapikan(BIDANG[jenis], h.bidang) as Record<string, unknown> } };
    } catch (err) {
      console.error("aturan rusak", e.id, err instanceof Error ? err.message : err);
    }
  }
  return null;
}

/**
 * Model berat menulis aturan sekali dari teks + hasil yang benar. Aturan diuji pada berkas yang sama; bila gagal,
 * tipe bidang diperbaiki tanpa token, lalu model diberi satu kesempatan memperbaiki dengan rincian bidang yang salah.
 * Hanya aturan yang lulus yang disimpan.
 */
async function tulisAturan(db: SupabaseClient, model: string, perusahaan_id: string, berkas_id: string, teks: string, hasil: Hasil) {
  const rapi = (b: Record<string, unknown>) => rapikan(BIDANG[hasil.jenis], b) as Record<string, unknown>;
  const percakapan: Anthropic.MessageParam[] = [{
    role: "user",
    content: `Jenis berkas: ${hasil.jenis}\n\nTeks berkas (per baris):\n<teks>\n${teks.slice(0, 30000)}\n</teks>\n\nHasil bacaan yang benar (JSON, nama bidang wajib sama):\n${JSON.stringify(hasil.bidang)}`,
  }];
  try {
    for (let coba = 1; coba <= 2; coba++) {
      const r = await ai.messages.create({
        model,
        max_tokens: 8000,
        system: [{ type: "text", text: INSTRUKSI_ATURAN, cache_control: { type: "ephemeral" } }],
        output_config: { effort: "medium", format: { type: "json_schema", schema: SKEMA_ATURAN } },
        messages: percakapan,
      } as Anthropic.MessageCreateParamsNonStreaming);
      await catatPemakaian(db, perusahaan_id, berkas_id, "tulis_aturan", model, r.usage);
      const t = r.content.find((b) => b.type === "text");
      if (r.stop_reason !== "end_turn" || t?.type !== "text") return console.log("tulis_aturan berhenti", r.stop_reason);
      let aturan = aturanDari(hasil.jenis, JSON.parse(t.text) as AturanMentah);
      let uji = ujiAturan(aturan, teks, hasil.bidang, rapi);
      if (!uji.lulus) {
        aturan = perbaikiTipe(aturan, teks, hasil.bidang, rapi);
        uji = ujiAturan(aturan, teks, hasil.bidang, rapi);
      }
      if (uji.lulus) {
        const { error } = await db.from("ekstraktor").insert({
          perusahaan_id, sidik_tata_letak: await sidik(aturan), jenis_berkas: hasil.jenis, aturan,
        });
        return console.log("aturan disimpan", berkas_id, hasil.jenis, `percobaan ${coba}`, error?.message ?? "ok");
      }
      console.log("aturan ditolak", berkas_id, `percobaan ${coba}`, uji.alasan, JSON.stringify(aturan).slice(0, 1500));
      percakapan.push(
        // Kirim balik isi jawaban utuh (termasuk blok pemikiran) agar riwayat tidak dianggap diubah.
        { role: "assistant", content: r.content },
        { role: "user", content: `Aturanmu diuji pada berkas ini dan ditolak: ${uji.alasan}. Perbaiki pola dan tipenya, lalu kirim aturan lengkap sekali lagi.` },
      );
    }
  } catch (e) {
    console.error("tulis_aturan", berkas_id, e instanceof Error ? e.message : e);
  }
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
    const byte = new Uint8Array(await unduh.arrayBuffer());
    const teks = await teksBerkas(berkas.mime, byte);

    let hasil: Hasil | null = null;
    let sumber: "aturan" | "model" = "model";
    let token = 0;
    const model: string[] = [];

    const dariAturan = teks ? await cobaAturan(admin, berkas.perusahaan_id, teks) : null;
    if (dariAturan) {
      hasil = dariAturan.hasil;
      sumber = "aturan";
    } else {
      const { data: konf } = await admin.from("konfigurasi").select("nilai").eq("kunci", "model_ai").single();
      const tangga = konf?.nilai as { ringan: string; berat: string; ambang_naik: number };
      const isi = isiUntukModel(berkas.mime, byte, berkas.nama_asli ?? "berkas", teks);
      const percobaan = [await baca(tangga.ringan, isi)];
      const pertama = percobaan[0].hasil;
      if (!pertama || pertama.keyakinan < tangga.ambang_naik || pertama.jenis === "lainnya") percobaan.push(await baca(tangga.berat, isi));
      for (const p of percobaan) {
        token += p.usage.input_tokens + p.usage.output_tokens;
        model.push(p.model);
        await catatPemakaian(admin, berkas.perusahaan_id, berkas_id, "baca_berkas", p.model, p.usage);
      }
      const akhir = percobaan.at(-1)!;
      hasil = akhir.hasil ?? pertama;
      if (!hasil) {
        await admin.from("berkas").update({ token_ai: token }).eq("id", berkas_id);
        return await gagal(`Nadi belum bisa membaca berkas ini (${akhir.berhenti}). Coba foto ulang lebih jelas.`);
      }
      // Berkas berteks dan jenisnya dikenal: tulis aturan sekali agar berkas kembarannya nanti tanpa token.
      if (teks && hasil.jenis !== "lainnya") EdgeRuntime.waitUntil(tulisAturan(admin, tangga.berat, berkas.perusahaan_id, berkas_id, teks, hasil));
    }

    const u = usulanDari(hasil);
    const { data: usulan } = await admin.from("usulan").insert({
      perusahaan_id: berkas.perusahaan_id, sumber: "lempar", aksi: u.aksi, judul: u.judul,
      penjelasan: sumber === "aturan" ? u.penjelasan.replace(/Dibaca dari berkas, yakin \d+%\./, "Dibaca dengan aturan tersimpan untuk tata letak ini, tanpa AI.") : u.penjelasan,
      payload: { jenis: hasil.jenis, bidang: hasil.bidang, ringkasan: hasil.ringkasan }, keyakinan: hasil.keyakinan,
      dampak_rp: u.dampak_rp, berkas_id,
    }).select("id").single();
    await admin.from("berkas").update({
      status: "usulan", jenis_terdeteksi: hasil.jenis, hasil: { ...hasil, sumber, ...(dariAturan ? { ekstraktor_id: dariAturan.ekstraktorId } : {}) },
      token_ai: token, diubah_at: new Date().toISOString(),
    }).eq("id", berkas_id);
    return json({ status: "usulan", jenis: hasil.jenis, keyakinan: hasil.keyakinan, hasil, usulan_id: usulan?.id, token, sumber, model });
  } catch (e) {
    console.error("baca-berkas", berkas_id, e instanceof Error ? e.message : e);
    return await gagal("Nadi gagal membaca berkas ini. Coba lagi sebentar.", 500);
  }
});
