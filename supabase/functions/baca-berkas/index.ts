// Edge Function `baca-berkas`: membaca satu berkas Lempar Saja dan menyiapkan usulan untuk disetujui.
// Urutan hemat: (1) aturan tersimpan untuk tata letak ini, tanpa token; (2) model ringan lalu berat bila keyakinan
// di bawah ambang (ID model dari tabel konfigurasi); (3) setelah model berhasil pada berkas berteks, model berat menulis
// aturan sekali di latar belakang, aturan diuji pada berkas yang sama, dan hanya yang lulus disimpan.
// Berkas yang sudah diproses (status bukan 'unggah'/'gagal') tidak diproses ulang.
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { unzipSync } from "npm:fflate@0.8.3";
import { extractText, getDocumentProxy } from "npm:unpdf@1.9.1";
import { BIDANG, INSTRUKSI, SKEMA_HASIL, hasilDari, rapikan, usulanDari, usulanLamar, xlsxKeTeks, type Hasil, type Jenis } from "./inti.ts";
import { bacaCv } from "./cv.ts";
import { bacaLogMesin } from "./logmesin.ts";
import { BIDANG_STRUK, INSTRUKSI_STRUK, SKEMA_STRUK, rapikanStruk, samaStruk } from "./struk.ts";
import { INSTRUKSI_ATURAN, SKEMA_ATURAN, akurasi, aturanDari, cocok, jalankan, konsisten, perbaikiTipe, sidik, ujiAturan, type Aturan, type AturanMentah } from "./ekstraktor.ts";
import { BAYANGAN_WAJIB, periksaAturan } from "./pengawas.ts";

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

type DariAturan = { hasil: Hasil; ekstraktorId: string; bayangan: boolean; cocokSebelum: number };
/** Skema bidang per jenis; "struk" (T-01B, klaim) bukan jenis Lempar tetapi memakai mesin aturan yang sama. */
const bidangJenis = (j: string) => (j === "struk" ? BIDANG_STRUK : BIDANG[j as Jenis]);

/**
 * Coba aturan tersimpan milik usaha ini (atau milik bersama) yang cocok, lengkap, dan konsisten. Aturan aktif langsung dipakai.
 * Aturan bayangan (T-02) hanya dijalankan untuk dibandingkan dengan model; hasilnya tidak dipakai sampai lolos masa bayangan.
 */
async function cobaAturan(db: SupabaseClient, perusahaan_id: string, teks: string, struk = false): Promise<DariAturan | null> {
  const q = db.from("ekstraktor").select("id, aturan, dipakai, status, bayangan_cocok")
    .in("status", ["aktif", "bayangan"]).or(`perusahaan_id.eq.${perusahaan_id},perusahaan_id.is.null`);
  // Aturan struk hanya untuk mode struk; Lempar biasa tidak pernah memakai aturan struk (dan sebaliknya).
  const { data } = await (struk ? q.eq("jenis_berkas", "struk") : q.neq("jenis_berkas", "struk"));
  let bayangan: DariAturan | null = null;
  for (const e of data ?? []) {
    const aturan = e.aturan as Aturan;
    try {
      if (!cocok(aturan, teks)) continue;
      const h = jalankan(aturan, teks);
      if (!h.lengkap || konsisten(aturan.jenis, h.bidang).length) continue;
      const jenis = aturan.jenis as Jenis;
      const hasil: Hasil = { jenis, keyakinan: 0.99, ringkasan: "", bidang: rapikan(bidangJenis(jenis), h.bidang) as Record<string, unknown> };
      if (e.status === "bayangan") { bayangan ??= { hasil, ekstraktorId: e.id, bayangan: true, cocokSebelum: e.bayangan_cocok ?? 0 }; continue; }
      await db.from("ekstraktor").update({ dipakai: e.dipakai + 1 }).eq("id", e.id);
      return { hasil, ekstraktorId: e.id, bayangan: false, cocokSebelum: 0 };
    } catch (err) {
      console.error("aturan rusak", e.id, err instanceof Error ? err.message : err);
    }
  }
  return bayangan;
}

/** T-02 masa bayangan: bandingkan hasil aturan bayangan dengan hasil model. Sama -> dihitung; beda -> aturan dimatikan. */
async function nilaiBayangan(db: SupabaseClient, b: DariAturan, model: Hasil, longgar: boolean) {
  const a = akurasi(model.bidang, b.hasil.bidang, longgar);
  // Struk klaim (T-01B): uang dan tanggal persis, pemasok sebagai label boleh dengan atau tanpa alamat.
  const s = b.hasil.jenis === "struk" ? samaStruk(model.bidang, b.hasil.bidang) : null;
  const sama = model.jenis === b.hasil.jenis && (s ? s.sama : a.cocok === a.total);
  const cocokBaru = b.cocokSebelum + 1;
  const ubah = sama
    ? { bayangan_cocok: cocokBaru, ...(cocokBaru >= BAYANGAN_WAJIB ? { status: "aktif" } : {}) }
    : { status: "mati", alasan_mati: `beda dengan model: ${model.jenis !== b.hasil.jenis ? "jenis berkas" : s ? s.beda.join(", ") : `${a.total - a.cocok} dari ${a.total} bidang`}` };
  const { error } = await db.from("ekstraktor").update(ubah).eq("id", b.ekstraktorId);
  console.log("bayangan", b.ekstraktorId, sama ? `cocok ${cocokBaru}` : "mati", error?.message ?? "ok");
}

/**
 * Model berat menulis aturan sekali dari teks + hasil yang benar. Aturan diuji pada berkas yang sama; bila gagal,
 * tipe bidang diperbaiki tanpa token, lalu model diberi satu kesempatan memperbaiki dengan rincian bidang yang salah.
 * Hanya aturan yang lulus yang disimpan.
 */
async function tulisAturan(db: SupabaseClient, model: string, perusahaan_id: string, berkas_id: string, teks: string, hasil: Hasil, ocr: boolean) {
  const rapi = (b: Record<string, unknown>) => rapikan(bidangJenis(hasil.jenis), b) as Record<string, unknown>;
  const percakapan: Anthropic.MessageParam[] = [{
    role: "user",
    content: `Jenis berkas: ${hasil.jenis}\n\nTeks berkas${ocr ? " (hasil OCR foto di HP; hasil bacaan di bawah diambil dari fotonya)" : ""} (per baris):\n<teks>\n${teks.slice(0, 30000)}\n</teks>\n\nHasil bacaan yang benar (JSON, nama bidang wajib sama):\n${JSON.stringify(hasil.bidang)}`,
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
      let uji = ujiAturan(aturan, teks, hasil.bidang, rapi, ocr);
      if (!uji.lulus) {
        aturan = perbaikiTipe(aturan, teks, hasil.bidang, rapi, ocr);
        uji = ujiAturan(aturan, teks, hasil.bidang, rapi, ocr);
      }
      // T-02 pengawas bukan AI: skema, regex aman, tanpa skrip/SQL, tidak terlalu umum. Lolos pun baru berstatus bayangan.
      const periksa = uji.lulus ? periksaAturan(aturan) : { lulus: false, alasan: [] as string[] };
      if (uji.lulus && !periksa.lulus) uji = { lulus: false, alasan: `pengawas menolak: ${periksa.alasan.slice(0, 4).join("; ")}` };
      if (uji.lulus) {
        const baris = {
          perusahaan_id, sidik_tata_letak: await sidik(aturan), jenis_berkas: hasil.jenis, aturan,
          status: "bayangan", versi: 1, asal: { model, berkas_id, percobaan: coba },
        };
        let { error } = await db.from("ekstraktor").insert(baris);
        // T-01B: tata letak ini sudah punya aturan bayangan, tetapi aturan itu tidak lengkap pada berkas kembaran ini (kalau
        // lengkap, cobaAturan sudah memakainya untuk dinilai). Aturan bayangan lama dimatikan dan diganti aturan baru yang lulus
        // pada berkas ini; aturan aktif tidak pernah diganti diam-diam.
        if (error?.code === "23505") {
          await db.from("ekstraktor").update({ status: "mati", alasan_mati: "tidak lengkap pada berkas kembaran; diganti aturan baru" })
            .eq("perusahaan_id", perusahaan_id).eq("sidik_tata_letak", baris.sidik_tata_letak).eq("status", "bayangan");
          ({ error } = await db.from("ekstraktor").insert(baris));
        }
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
  // Jalur internal: database (pg_net, mis. lamaran tanpa akun) memanggil dengan token dari Vault, bukan JWT pengguna.
  const tokenInternal = req.headers.get("x-nadi-token");
  if (!otorisasi && !tokenInternal) return json({ galat: "Masuk dulu" }, 401);
  const { berkas_id, sumber: sumberPanggil, mode } = await req.json().catch(() => ({ berkas_id: null, sumber: null, mode: null }));
  if (typeof berkas_id !== "string") return json({ galat: "berkas_id wajib" }, 400);

  const admin = createClient(URL_SUPABASE, kunciEnv("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const kolom = "id, perusahaan_id, jalur, nama_asli, mime, status, teks_ocr, ocr_keyakinan";
  let berkas;
  if (tokenInternal) {
    const { data: cocok } = await admin.rpc("push_token_cocok", { p_token: tokenInternal });
    if (cocok !== true) return json({ galat: "Token tidak sah" }, 401);
    ({ data: berkas } = await admin.from("berkas").select(kolom).eq("id", berkas_id).maybeSingle());
  } else {
    // Hak akses diperiksa atas nama pemanggil (RLS): hanya berkas yang boleh ia lihat.
    const pengguna = createClient(URL_SUPABASE, kunciEnv("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: otorisasi! } },
      auth: { persistSession: false },
    });
    ({ data: berkas } = await pengguna.from("berkas").select(kolom).eq("id", berkas_id).maybeSingle());
  }
  if (!berkas) return json({ galat: "Berkas tidak ditemukan" }, 404);
  const sumberUsulan = tokenInternal && sumberPanggil === "lamar" ? "lamar" : "lempar";

  // Struk yang sama difoto ulang: pakai hasil bacaan tersimpan, tanpa token.
  if (mode === "struk" && !tokenInternal && berkas.status === "dibaca") {
    const { data: lama } = await admin.from("berkas").select("hasil").eq("id", berkas_id).single();
    const h = lama?.hasil as { jenis?: string; pemasok: string | null; tanggal: string | null; total: number | null; keyakinan: number } | null;
    if (h?.jenis === "struk" && h.total) return json({ status: "dibaca", jenis: "struk", hasil: { pemasok: h.pemasok, tanggal: h.tanggal, total: h.total, keyakinan: h.keyakinan }, token: 0, model: [] });
  }

  // Klaim atomik: hanya satu pemanggil yang memproses; berkas selesai tidak diproses ulang.
  const { data: diklaim } = await admin.from("berkas").update({ status: "proses", galat: null, diubah_at: new Date().toISOString() })
    .eq("id", berkas_id).in("status", ["unggah", "antre", "gagal"]).select("id");
  if (!diklaim?.length) return json({ status: berkas.status, diproses_ulang: false });

  const gagal = async (pesan: string, status = 422) => {
    await admin.from("berkas").update({ status: "gagal", galat: pesan, diubah_at: new Date().toISOString() }).eq("id", berkas_id);
    return json({ status: "gagal", galat: pesan }, status);
  };

  try {
    const { data: unduh, error: eUnduh } = await admin.storage.from("berkas").download(berkas.jalur);
    if (eUnduh || !unduh) return await gagal("Berkas belum terunggah. Lempar ulang berkasnya.", 409);
    const byte = new Uint8Array(await unduh.arrayBuffer());

    // M-18B mode struk (layar Klaim): baca total/tanggal/pemasok saja, tanpa aturan ekstraktor dan tanpa usulan nota.
    if (mode === "struk" && !tokenInternal) {
      if (!berkas.mime.startsWith("image/") && berkas.mime !== "application/pdf") return await gagal("Struk berupa foto atau PDF.", 422);
      const { data: konf } = await admin.from("konfigurasi").select("nilai").eq("kunci", "model_ai").single();
      const tangga = konf?.nilai as { ringan: string; berat: string; ambang_naik: number };
      const isi = isiUntukModel(berkas.mime, byte, berkas.nama_asli ?? "struk", null);
      // T-01B: teks OCR dari HP (berapa pun keyakinannya) menjadi bahan aturan tata letak struk. Aturan aktif = tanpa model.
      const teksOcr = typeof berkas.teks_ocr === "string" && berkas.teks_ocr.replace(/\s/g, "").length > 40 ? berkas.teks_ocr : null;
      const dariAturanStruk = teksOcr ? await cobaAturan(admin, berkas.perusahaan_id, teksOcr, true) : null;
      if (dariAturanStruk && !dariAturanStruk.bayangan) {
        const b = dariAturanStruk.hasil.bidang as { pemasok?: string; tanggal?: string; total?: number };
        const h = rapikanStruk({ pemasok: b.pemasok ?? "", tanggal: b.tanggal ?? "", total: Math.round(Number(b.total) || 0), keyakinan: 0.99 });
        if (h.total) {
          await admin.from("berkas").update({ status: "dibaca", jenis_terdeteksi: "struk", hasil: { jenis: "struk", sumber: "aturan", ekstraktor_id: dariAturanStruk.ekstraktorId, ...h }, token_ai: 0, diubah_at: new Date().toISOString() }).eq("id", berkas_id);
          return json({ status: "dibaca", jenis: "struk", hasil: h, token: 0, model: [], sumber: "aturan" });
        }
      }
      const bacaStruk = async (m: string) => {
        const r = await ai.messages.create({
          model: m, max_tokens: 2000,
          system: [{ type: "text", text: INSTRUKSI_STRUK, cache_control: { type: "ephemeral" } }],
          output_config: { effort: "low", format: { type: "json_schema", schema: SKEMA_STRUK } },
          messages: [{ role: "user", content: [...isi, { type: "text", text: "Baca struk ini dan isi skemanya." }] }],
        } as Anthropic.MessageCreateParamsNonStreaming);
        await catatPemakaian(admin, berkas.perusahaan_id, berkas_id, "baca_struk", m, r.usage);
        const t = r.content.find((b) => b.type === "text");
        return { h: r.stop_reason === "end_turn" && t?.type === "text" ? rapikanStruk(JSON.parse(t.text)) : null, token: r.usage.input_tokens + r.usage.output_tokens, m };
      };
      const coba = [await bacaStruk(tangga.ringan)];
      if (!coba[0].h?.total || coba[0].h.keyakinan < tangga.ambang_naik) coba.push(await bacaStruk(tangga.berat));
      const akhir = coba.at(-1)!.h?.total ? coba.at(-1)! : coba[0];
      const token = coba.reduce((a, c) => a + c.token, 0);
      if (!akhir.h?.total) {
        await admin.from("berkas").update({ token_ai: token }).eq("id", berkas_id);
        return await gagal("Total di struk ini belum terbaca. Foto ulang lebih dekat, atau ketik totalnya.");
      }
      await admin.from("berkas").update({ status: "dibaca", jenis_terdeteksi: "struk", hasil: { jenis: "struk", sumber: "model", ...akhir.h }, token_ai: token, diubah_at: new Date().toISOString() }).eq("id", berkas_id);
      // T-01B: model sudah membaca; tata letak ini dipelajari (aturan baru, bayangan) atau aturan bayangannya dinilai.
      if (teksOcr) {
        const hasilModel: Hasil = { jenis: "struk" as Jenis, keyakinan: akhir.h.keyakinan, ringkasan: "",
          bidang: rapikan(BIDANG_STRUK, { pemasok: akhir.h.pemasok ?? "", tanggal: akhir.h.tanggal ?? "", total: akhir.h.total }) as Record<string, unknown> };
        if (dariAturanStruk?.bayangan) EdgeRuntime.waitUntil(nilaiBayangan(admin, dariAturanStruk, hasilModel, true));
        else EdgeRuntime.waitUntil(tulisAturan(admin, tangga.berat, berkas.perusahaan_id, berkas_id, teksOcr, hasilModel, true));
      }
      return json({ status: "dibaca", jenis: "struk", hasil: akhir.h, token, model: coba.map((c) => c.m), sumber: "model", belajar: Boolean(teksOcr) });
    }
    // Foto: pakai teks OCR dari perangkat bila keyakinannya cukup (>= 85, docs/research/ml-browser.md).
    const ocrCukup = berkas.mime.startsWith("image/") && berkas.teks_ocr && Number(berkas.ocr_keyakinan) >= 85;
    const teks = ocrCukup ? (berkas.teks_ocr as string) : await teksBerkas(berkas.mime, byte);

    let hasil: Hasil | null = null;
    let sumber: "aturan" | "model" = "model";
    let token = 0;
    const model: string[] = [];

    // Lampiran lamaran dari orang luar tidak mencoba dan tidak menulis aturan ekstraktor usaha (Q-11).
    const lamar = sumberUsulan === "lamar";
    const dariAturan = teks && !lamar ? await cobaAturan(admin, berkas.perusahaan_id, teks) : null;
    // CV berteks: pengurai bagian tanpa model (H-02). Berlaku juga untuk lampiran lamaran karena tidak memakai aturan usaha.
    const dariCv = !(dariAturan && !dariAturan.bayangan) && teks ? bacaCv(teks) : null;
    // Log mesin absen sidik jari/wajah: tempelan dikelompokkan per orang per hari tanpa model (M-12).
    const dariLog = !(dariAturan && !dariAturan.bayangan) && !dariCv && teks && !lamar ? bacaLogMesin(teks) : null;
    if (dariAturan && !dariAturan.bayangan) {
      hasil = dariAturan.hasil;
      sumber = "aturan";
    } else if (dariCv) {
      hasil = dariCv as Hasil;
      sumber = "aturan";
    } else if (dariLog) {
      hasil = dariLog as Hasil;
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
      // CV dikecualikan: setiap pelamar memakai tata letak sendiri, aturannya tidak pernah terpakai ulang (H-02).
      // Aturan bayangan untuk tata letak ini sudah ada: nilai saja (jangan tulis aturan kedua).
      if (dariAturan?.bayangan) EdgeRuntime.waitUntil(nilaiBayangan(admin, dariAturan, hasil, Boolean(ocrCukup)));
      else if (teks && hasil.jenis !== "lainnya" && hasil.jenis !== "cv" && !lamar) EdgeRuntime.waitUntil(tulisAturan(admin, tangga.berat, berkas.perusahaan_id, berkas_id, teks, hasil, Boolean(ocrCukup)));
    }

    // Lamaran tanpa akun hanya boleh menjadi usulan pelamar, apa pun isi berkasnya (Q-11).
    let u = usulanDari(hasil);
    if (lamar) {
      const { data: la } = await admin.from("lamaran").select("nama").eq("berkas_id", berkas_id).maybeSingle();
      ({ usulan: u, hasil } = usulanLamar(hasil, la?.nama ?? "pelamar"));
    }
    const { data: usulan } = await admin.from("usulan").insert({
      perusahaan_id: berkas.perusahaan_id, sumber: sumberUsulan, aksi: u.aksi, judul: u.judul,
      penjelasan: sumber === "aturan"
        ? u.penjelasan.replace(/Dibaca dari berkas, yakin \d+%\./, dariLog
          ? "Dibaca dari log mesin absen, tanpa AI. Masuk = tempelan pertama, pulang = tempelan terakhir; periksa nama yang belum dikenal."
          : dariCv
          ? "Dibaca dari bagian-bagian CV, tanpa AI. Periksa ejaan nama dan tempat kerja."
          : ocrCukup
          ? "Dibaca dari foto dengan aturan tersimpan, tanpa AI. Angka sudah dicocokkan; periksa ejaan nama dan nomor."
          : "Dibaca dengan aturan tersimpan untuk tata letak ini, tanpa AI.")
        : u.penjelasan,
      payload: { jenis: hasil.jenis, bidang: hasil.bidang, ringkasan: hasil.ringkasan }, keyakinan: hasil.keyakinan,
      dampak_rp: u.dampak_rp, berkas_id,
    }).select("id").single();
    await admin.from("berkas").update({
      status: "usulan", jenis_terdeteksi: hasil.jenis, hasil: { ...hasil, sumber, ...(dariAturan && !dariAturan.bayangan ? { ekstraktor_id: dariAturan.ekstraktorId } : {}) },
      token_ai: token, diubah_at: new Date().toISOString(),
    }).eq("id", berkas_id);
    return json({ status: "usulan", jenis: hasil.jenis, keyakinan: hasil.keyakinan, hasil, usulan_id: usulan?.id, token, sumber, model });
  } catch (e) {
    console.error("baca-berkas", berkas_id, e instanceof Error ? e.message : e);
    return await gagal("Nadi gagal membaca berkas ini. Coba lagi sebentar.", 500);
  }
});
