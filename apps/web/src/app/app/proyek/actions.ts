"use server";

import { revalidatePath } from "next/cache";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export type HasilProyek = { pesan: string } | { galat: string } | null;

async function teks() {
  return ambilKamus(await bahasaAplikasi()).proyekPesan;
}
type K = Awaited<ReturnType<typeof teks>>;
const galat = (k: K, e: { code?: string; message: string }): HasilProyek =>
  ({ galat: ["22023", "P0002", "23505", "23514", "42501"].includes(e.code ?? "") ? isiTeks(k.galatDb, { pesan: e.message }) : k.gagal });
const segar = () => revalidatePath("/app/proyek");

export async function buatProyek(_: HasilProyek, form: FormData): Promise<HasilProyek> {
  const k = await teks();
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_dimension", { p_jenis: "proyek", p_nama: String(form.get("nama") ?? "").trim(), p_aktif: true });
  if (error) return galat(k, error);
  segar();
  return { pesan: k.dibuat };
}

export async function simpanRab(_: HasilProyek, form: FormData): Promise<HasilProyek> {
  const k = await teks();
  const nominal = Number(String(form.get("nominal") ?? "").replace(/[.\s]/g, ""));
  if (!Number.isInteger(nominal) || nominal < 0) return { galat: k.angkaRusak };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_project_budget", { p_dimension: String(form.get("proyek") ?? ""), p_akun: String(form.get("akun") ?? ""), p_nominal: nominal,
    p_catatan: String(form.get("catatan") ?? "") || null });
  if (error) return galat(k, error);
  segar();
  return { pesan: k.rabTersimpan };
}

export async function tandaiJurnal(_: HasilProyek, form: FormData): Promise<HasilProyek> {
  const k = await teks();
  const supabase = await createClient();
  const { error } = await supabase.rpc("tag_journal", { p_jurnal: String(form.get("jurnal") ?? ""), p_dimension: String(form.get("proyek") ?? "") });
  if (error) return galat(k, error);
  segar();
  return { pesan: k.ditandai };
}

export async function catatJam(_: HasilProyek, form: FormData): Promise<HasilProyek> {
  const k = await teks();
  const jam = Number(String(form.get("jam") ?? "").replace(",", "."));
  if (!Number.isFinite(jam) || jam <= 0 || jam > 24) return { galat: k.angkaRusak };
  const supabase = await createClient();
  const { error } = await supabase.rpc("log_project_hours", { p_dimension: String(form.get("proyek") ?? ""), p_tanggal: String(form.get("tanggal") ?? ""), p_jam: jam,
    p_catatan: String(form.get("catatan") ?? "") || null, p_orang: String(form.get("orang") ?? "") || null });
  if (error) return galat(k, error);
  segar();
  return { pesan: k.jamTercatat };
}
