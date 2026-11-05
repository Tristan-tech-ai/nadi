"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { nomorWa } from "@/lib/tanda";
import { createClient } from "@/lib/supabase/server";

export type HasilServis = { pesan: string } | { galat: string } | null;

async function teks() {
  return ambilKamus(await bahasaAplikasi()).servisPesan;
}
type K = Awaited<ReturnType<typeof teks>>;
const galat = (k: K, e: { code?: string; message: string }): HasilServis =>
  ({ galat: e.code === "42501" ? k.hanya : ["22023", "P0002", "23514"].includes(e.code ?? "") ? isiTeks(k.galatDb, { pesan: e.message }) : k.gagal });
const rupiah = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").replace(/[.\s]/g, "");
  return s === "" ? null : /^\d+$/.test(s) ? Number(s) : NaN;
};

export async function terimaBarang(_: HasilServis, form: FormData): Promise<HasilServis> {
  const k = await teks();
  const est = rupiah(form.get("estimasi"));
  if (Number.isNaN(est)) return { galat: k.angkaRusak };
  const hpIsi = String(form.get("hp") ?? "").trim();
  const hp = hpIsi ? nomorWa(hpIsi) : null;
  if (hpIsi && !hp) return { galat: k.hpRusak };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_service_order", { p: { pelanggan: String(form.get("pelanggan") ?? ""), hp, item: String(form.get("item") ?? ""),
    keluhan: String(form.get("keluhan") ?? "") || null, estimasi: est, janji: String(form.get("janji") ?? "") || null }, p_kunci: String(form.get("kunci") ?? "") || randomUUID() });
  if (error) return galat(k, error);
  revalidatePath("/app/servis");
  return { pesan: isiTeks(k.tersimpan, { nomor: String((data as { nomor: string }).nomor) }) };
}

export async function ubahStatusServis(_: HasilServis, form: FormData): Promise<HasilServis> {
  const k = await teks();
  const status = String(form.get("status") ?? "");
  const alasan = String(form.get("alasan") ?? "").trim();
  if (status === "batal" && alasan.length < 3) return { galat: k.alasanKurang };
  const supabase = await createClient();
  const { error } = await supabase.rpc("advance_service_order", { p_id: String(form.get("id") ?? ""), p_status: status, p_catatan: alasan || null });
  if (error) return galat(k, error);
  revalidatePath("/app/servis");
  return { pesan: k.diubah };
}

export async function tagihServis(_: HasilServis, form: FormData): Promise<HasilServis> {
  const k = await teks();
  const harga = rupiah(form.get("harga"));
  if (!harga || Number.isNaN(harga)) return { galat: k.angkaRusak };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invoice_from_service_order", { p_id: String(form.get("id") ?? ""),
    p_baris: [{ uraian: String(form.get("uraian") ?? "").trim(), jumlah: 1, harga }], p_jatuh_tempo: null });
  if (error) return galat(k, error);
  revalidatePath("/app/servis");
  revalidatePath("/app/invoice");
  return { pesan: isiTeks(k.ditagih, { nomor: String((data as { nomor: string }).nomor) }) };
}
