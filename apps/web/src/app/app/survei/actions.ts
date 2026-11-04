"use server";

import { revalidatePath } from "next/cache";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

// M-11B: survei (pemilik/admin membuat; anggota sasaran mengisi sekali; anonim tanpa akun).
export type HasilSurvei = { pesan: string } | { galat: string } | null;
const PERAN = ["staf", "admin", "akuntan"];

export async function buatSurvei(_: HasilSurvei, f: FormData): Promise<HasilSurvei> {
  const k = ambilKamus(await bahasaAplikasi()).hrPesan;
  const pertanyaan = [0, 1, 2, 3, 4].flatMap((i) => {
    const teks = String(f.get(`teks${i}`) ?? "").trim();
    if (!teks) return [];
    const jenis = String(f.get(`jenis${i}`) ?? "skala");
    const pilihan = String(f.get(`pilihan${i}`) ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    return [{ teks, jenis, ...(jenis === "pilihan" ? { pilihan } : {}) }];
  });
  const untuk = f.getAll("untuk").map(String).filter((p) => PERAN.includes(p));
  const supabase = await createClient();
  const { error } = await supabase.rpc("buat_survei", {
    p_judul: String(f.get("judul") ?? ""), p_pertanyaan: pertanyaan, p_anonim: f.get("anonim") === "on", p_untuk: untuk.length ? untuk : null,
    p_tutup: /^\d{4}-\d{2}-\d{2}$/.test(String(f.get("tutup") ?? "")) ? String(f.get("tutup")) : null, p_kunci: String(f.get("kunci") ?? ""),
  });
  if (error) return { galat: error.code === "42501" ? k.hanya : error.code === "22023" ? error.message : k.gagal };
  revalidatePath("/app/survei");
  return { pesan: k.surveiDibuat };
}

export async function isiSurvei(_: HasilSurvei, f: FormData): Promise<HasilSurvei> {
  const k = ambilKamus(await bahasaAplikasi()).hrPesan;
  const jawaban: Record<string, string | number> = {};
  for (const [kunci, nilai] of f.entries()) {
    if (!/^q\d+$/.test(kunci)) continue;
    const v = String(nilai).trim();
    if (!v) continue;
    jawaban[kunci] = f.get(`jenis_${kunci}`) === "skala" ? Number(v) : v;
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("isi_survei", { p_survei: String(f.get("survei") ?? ""), p_jawaban: jawaban });
  if (error) return { galat: error.code === "22023" || error.code === "23505" ? error.message : k.gagal };
  revalidatePath("/app/survei");
  return { pesan: k.surveiTerisi };
}
