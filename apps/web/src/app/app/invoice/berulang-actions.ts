"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export type HasilBerulang = { pesan: string } | { galat: string } | null;

async function teks() {
  return ambilKamus(await bahasaAplikasi()).berulangPesan;
}
type K = Awaited<ReturnType<typeof teks>>;
const galat = (k: K, e: { code?: string; message: string }): HasilBerulang =>
  ({ galat: ["22023", "P0002", "23514", "42501"].includes(e.code ?? "") ? isiTeks(k.galatDb, { pesan: e.message }) : k.gagal });

/** Nomor WhatsApp tampilan (08xx, +62, 62xx) menjadi 62xx; kosong = null; rusak = undefined. */
async function nomor62(v: string): Promise<string | null | undefined> {
  const n = v.replace(/\D/g, "");
  if (!n) return null;
  const x = n.startsWith("0") ? `62${n.slice(1)}` : n;
  return /^62\d{8,13}$/.test(x) ? x : undefined;
}

export async function simpanBerulang(_: HasilBerulang, form: FormData): Promise<HasilBerulang> {
  const k = await teks();
  const harga = Number(String(form.get("harga") ?? "").replace(/[.\s]/g, ""));
  if (!Number.isInteger(harga) || harga <= 0) return { galat: k.angkaRusak };
  const hp = await nomor62(String(form.get("hp") ?? ""));
  if (hp === undefined) return { galat: k.hpRusak };
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_recurring_invoice", { p: {
    pelanggan: String(form.get("pelanggan") ?? ""), hp, baris: [{ uraian: String(form.get("uraian") ?? "").trim(), jumlah: 1, harga }],
    tiap: Number(form.get("tiap") ?? 1), mulai: String(form.get("mulai") ?? ""), sampai: String(form.get("sampai") ?? "") || null,
    tempo: Number(form.get("tempo") ?? 7), catatan: String(form.get("catatan") ?? "") || null }, p_kunci: String(form.get("kunci") ?? "") || randomUUID() });
  if (error) return galat(k, error);
  // Periode yang sudah jatuh tempo (misalnya mulai hari ini) langsung terbit.
  const { data: n } = await supabase.rpc("run_recurring_invoices");
  revalidatePath("/app/invoice");
  return { pesan: Number(n) > 0 ? `${k.tersimpan} ${isiTeks(k.terbit, { n: Number(n) })}` : k.tersimpan };
}

export async function ubahBerulang(_: HasilBerulang, form: FormData): Promise<HasilBerulang> {
  const k = await teks();
  const supabase = await createClient();
  const aksi = String(form.get("aksi") ?? "");
  if (aksi === "terbitkan") {
    const { data, error } = await supabase.rpc("run_recurring_invoices");
    if (error) return galat(k, error);
    revalidatePath("/app/invoice");
    return { pesan: Number(data) > 0 ? isiTeks(k.terbit, { n: Number(data) }) : k.tidakAda };
  }
  const { error } = await supabase.rpc("set_recurring_invoice_status", { p_id: String(form.get("id") ?? ""), p_status: aksi === "jeda" ? "jeda" : "aktif" });
  if (error) return galat(k, error);
  revalidatePath("/app/invoice");
  return { pesan: k.diubah };
}
