"use server";

import { revalidatePath } from "next/cache";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export type HasilKinerja = { pesan: string } | { galat: string } | null;

async function teks() {
  const k = ambilKamus(await bahasaAplikasi());
  return { p: k.kinerjaPesan, t: k.kinerja };
}
type P = Awaited<ReturnType<typeof teks>>["p"];
const galat = (k: P, e: { code?: string; message: string }): HasilKinerja =>
  ({ galat: ["22023", "P0002", "23505", "23514", "42501"].includes(e.code ?? "") ? isiTeks(k.galatDb, { pesan: e.message }) : k.gagal });
const segar = () => revalidatePath("/app/kinerja");

export async function kirimReview(_: HasilKinerja, form: FormData): Promise<HasilKinerja> {
  const { p } = await teks();
  const komp = form.getAll("kompetensi").map(String);
  const skor: Record<string, number> = {};
  for (const k of komp) {
    const v = Number(form.get(`skor:${k}`));
    if (!Number.isInteger(v) || v < 1 || v > 5) return { galat: p.skorKurang };
    skor[k] = v;
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_review", { p_entry: String(form.get("entry") ?? ""), p_skor: skor, p_komentar: String(form.get("komentar") ?? "") || null });
  if (error) return galat(p, error);
  segar();
  return { pesan: p.terkirim };
}

export async function simpanTujuan(_: HasilKinerja, form: FormData): Promise<HasilKinerja> {
  const { p } = await teks();
  const supabase = await createClient();
  const id = String(form.get("id") ?? "");
  const isi = id ? { id, progres: String(form.get("progres") ?? "").replace(",", ".") } : {
    orang: String(form.get("orang") ?? ""), judul: String(form.get("judul") ?? ""), target: String(form.get("target") ?? "").replace(/\./g, "").replace(",", "."),
    satuan: String(form.get("satuan") ?? ""), mulai: String(form.get("mulai") ?? ""), selesai: String(form.get("selesai") ?? "") };
  const { error } = await supabase.rpc("save_goal", { p: isi });
  if (error) return galat(p, error);
  segar();
  return { pesan: p.tersimpan };
}

export async function simpanIdp(_: HasilKinerja, form: FormData): Promise<HasilKinerja> {
  const { p } = await teks();
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_idp_item", { p: { orang: String(form.get("orang") ?? ""), tujuan: String(form.get("tujuan") ?? ""),
    langkah: String(form.get("langkah") ?? ""), target: String(form.get("target") ?? "") } });
  if (error) return galat(p, error);
  segar();
  return { pesan: p.tersimpan };
}

export async function bukaSiklus(_: HasilKinerja, form: FormData): Promise<HasilKinerja> {
  const { p } = await teks();
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_review_cycle", { p_nama: String(form.get("nama") ?? ""), p_mulai: String(form.get("mulai") ?? ""),
    p_selesai: String(form.get("selesai") ?? ""), p_kompetensi: String(form.get("kompetensi") ?? "").split(",").map((x) => x.trim()).filter(Boolean),
    p_peserta: form.getAll("peserta").map(String) });
  if (error) return galat(p, error);
  segar();
  return { pesan: p.dibuka };
}

export async function aksiSiklus(_: HasilKinerja, form: FormData): Promise<HasilKinerja> {
  const { p, t } = await teks();
  const supabase = await createClient();
  const aksi = String(form.get("aksi") ?? ""), cycle = String(form.get("cycle") ?? "");
  if (aksi === "kalibrasi") {
    const skor = String(form.get("skor") ?? "").replace(",", ".").trim();
    const { data, error } = await supabase.rpc("calibrate_review", { p_cycle: cycle, p_orang: String(form.get("orang") ?? ""), p_skor: skor ? Number(skor) : null,
      p_potensi: Number(form.get("potensi") ?? 2), p_catatan: String(form.get("catatan") ?? "") || null });
    if (error) return galat(p, error);
    segar();
    return { pesan: isiTeks(p.dikalibrasi, { kotak: t.kotakNama[String(data) as keyof typeof t.kotakNama] ?? String(data) }) };
  }
  if (aksi === "rekan") {
    const { error } = await supabase.rpc("add_peer_reviewer", { p_cycle: cycle, p_orang: String(form.get("orang") ?? ""), p_rekan: String(form.get("rekan") ?? "") });
    if (error) return galat(p, error);
    segar();
    return { pesan: p.rekanDitambah };
  }
  const { error } = await supabase.rpc("close_review_cycle", { p_cycle: cycle });
  if (error) return galat(p, error);
  segar();
  return { pesan: p.ditutup };
}
