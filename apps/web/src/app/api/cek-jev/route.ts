import { createClient } from "@supabase/supabase-js";
import { readPublicEnv } from "@/lib/env";
import { GalatKeputusan, langkahBerikut, panggilKeputusan } from "@/lib/jev";

// Route uji sementara R-02B: satu panggilan model keputusan lewat AI Gateway dengan OIDC deployment.
// Hanya pemilik (JWT Supabase di header Authorization). Dihapus setelah hasil dicatat di docs/research/jev.md.
export const maxDuration = 30;

const tanpaSimpan = { "Cache-Control": "no-store" };

export async function GET(req: Request) {
  const jwt = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!jwt) return Response.json({ galat: "Masuk dulu sebagai pemilik." }, { status: 401, headers: tanpaSimpan });
  const { supabaseUrl, supabasePublishableKey } = readPublicEnv();
  const sb = createClient(supabaseUrl, supabasePublishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data } = await sb.auth.getClaims(jwt);
  if ((data?.claims?.app_metadata as { prn?: string } | undefined)?.prn !== "pemilik") {
    return Response.json({ galat: "Khusus pemilik." }, { status: 403, headers: tanpaSimpan });
  }
  const model = process.env.NADI_MODEL_KEPUTUSAN;
  const token = req.headers.get("x-vercel-oidc-token") ?? process.env.VERCEL_OIDC_TOKEN;
  if (!model || !token) {
    return Response.json({ galat: "Konfigurasi belum ada.", model: Boolean(model), oidc: Boolean(token) }, { status: 503, headers: tanpaSimpan });
  }
  const state = {
    pengajuan: { orang: "Sari", jenis: "sakit", hari: 1, bukti: "surat dokter (foto)", alasan: "Demam sejak semalam" },
    kebijakan: { jenis: "sakit", otomatis: true, maks_hari_otomatis: 2, butuh_bukti: true },
    hari_itu: { izin_lain: 1, maks_bersamaan: 3 },
  };
  try {
    const h = await panggilKeputusan({
      token,
      model,
      state,
      questions: {
        sesuai: {
          type: "boolean",
          instructions: "Apakah pengajuan ini memenuhi semua syarat kebijakan untuk disetujui otomatis?",
          criteria: { true: "jumlah hari tidak melebihi batas, bukti ada bila diwajibkan, kuota hari itu belum penuh", false: "ada syarat yang tidak terpenuhi" },
        },
        penerima: {
          type: "choice",
          instructions: "Siapa yang sebaiknya melihat pengajuan ini bila perlu keputusan manusia?",
          criteria: { pemilik: "menyangkut uang, kontrak, atau keputusan besar", admin: "urusan harian kehadiran dan izin" },
        },
        mendesak: { type: "score", instructions: "Seberapa mendesak pengajuan ini diputuskan?", criteria: ["bisa minggu depan", "hari ini", "dalam satu jam"] },
      },
    });
    const langkah = Object.fromEntries(Object.entries(h.jawaban).map(([k, v]) => [k, langkahBerikut(v)]));
    return Response.json({ ok: true, ...h, langkah }, { headers: tanpaSimpan });
  } catch (e) {
    if (e instanceof GalatKeputusan) return Response.json({ ok: false, status: e.status, pesan: e.message, ms: e.ms }, { status: 502, headers: tanpaSimpan });
    return Response.json({ ok: false, pesan: e instanceof Error ? e.message.slice(0, 200) : "galat" }, { status: 502, headers: tanpaSimpan });
  }
}
