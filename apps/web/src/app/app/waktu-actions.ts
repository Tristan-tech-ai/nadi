"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

// M-12 waktu lanjutan: geofence tempat absen, kunci periode absensi, lembur diajukan staf, shift siaga.
export type HasilWaktu = { pesan: string } | { galat: string } | null;

async function teks() {
  return ambilKamus(await bahasaAplikasi()).waktuPesan;
}
const galat = (k: Awaited<ReturnType<typeof teks>>, e: { code?: string; message: string }): HasilWaktu =>
  ({ galat: e.code === "42501" ? k.hanya : ["22023", "P0002", "23505"].includes(e.code ?? "") ? isiTeks(k.galatDb, { pesan: e.message }) : k.gagal });

/** "-8.6705, 115.2126" (salinan dari peta) menjadi titik; kosong = geofence mati. */
export async function aturGeofence(_: HasilWaktu, form: FormData): Promise<HasilWaktu> {
  const k = await teks();
  const titik = String(form.get("titik") ?? "").trim();
  const radius = Number(String(form.get("radius") ?? "").trim());
  let lat: number | null = null, lng: number | null = null, r: number | null = null;
  if (titik) {
    const m = /^(-?\d{1,2}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)$/.exec(titik);
    if (!m || !Number.isInteger(radius)) return { galat: k.titikRusak };
    [lat, lng, r] = [Number(m[1]), Number(m[2]), radius];
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("atur_geofence", { p_tempat: String(form.get("tempat") ?? ""), p_lat: lat, p_lng: lng, p_radius: r });
  if (error) return galat(k, error);
  revalidatePath("/app/perusahaan");
  return { pesan: r ? isiTeks(k.geofenceAktif, { radius: r }) : k.geofenceMati };
}

export async function aturKunci(_: HasilWaktu, form: FormData): Promise<HasilWaktu> {
  const k = await teks();
  const kunci = String(form.get("kunci") ?? "") === "ya";
  const supabase = await createClient();
  const { error } = await supabase.rpc("atur_kunci_absensi", { p_bulan: `${String(form.get("bulan") ?? "")}-01`, p_kunci: kunci, p_alasan: String(form.get("alasan") ?? "") || null });
  if (error) return galat(k, error);
  revalidatePath("/app/perusahaan");
  return { pesan: kunci ? k.terkunci : k.terbuka };
}

export async function ajukanLembur(_: HasilWaktu, form: FormData): Promise<HasilWaktu> {
  const k = await teks();
  const supabase = await createClient();
  const { error } = await supabase.rpc("ajukan_lembur", { p_tanggal: String(form.get("tanggal") ?? ""), p_jenis: String(form.get("jenis") ?? "hari_kerja"),
    p_jam: Number(form.get("jam") ?? 0), p_alasan: String(form.get("alasan") ?? ""), p_kunci: String(form.get("kunci") ?? "") || randomUUID() });
  if (error) return galat(k, error);
  revalidatePath("/app/izin");
  return { pesan: k.lemburDiajukan };
}

export async function aturSiaga(_: HasilWaktu, form: FormData): Promise<HasilWaktu> {
  const k = await teks();
  const supabase = await createClient();
  const { error } = await supabase.rpc("tandai_siaga", { p_shift: String(form.get("shift") ?? ""), p_siaga: String(form.get("siaga") ?? "") === "ya" });
  if (error) return galat(k, error);
  revalidatePath("/app/jadwal");
  return { pesan: k.siagaTersimpan };
}
