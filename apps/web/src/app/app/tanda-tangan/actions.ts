"use server";

import { revalidatePath } from "next/cache";
import { angkaIsian } from "@/lib/buku/laporan";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { uraiPenanda } from "@/lib/tanda";

export type Tautan = { nama: string; kontak: string | null; token: string; kode: string };
export type HasilTanda = { pesan: string; tautan?: Tautan[] } | { galat: string } | null;

const teks = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const tanggal = (f: FormData, k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(teks(f, k)) ? teks(f, k) : null);

async function siap() {
  const k = ambilKamus(await bahasaAplikasi()).tandaPesan;
  const supabase = await createClient();
  const salah = (e: { code?: string; message: string }) => ({ galat: e.code === "42501" ? k.hanya : isiTeks(k.galatDb, { pesan: e.message }) });
  return { k, supabase, salah };
}
const segarkan = () => revalidatePath("/app/tanda-tangan");

/** Simpan lalu kirim: tautan sekali pakai dikembalikan sekali untuk dibagikan pengirim sendiri. */
export async function simpanKirim(_: HasilTanda, f: FormData): Promise<HasilTanda> {
  const { k, supabase, salah } = await siap();
  const penanda = uraiPenanda(teks(f, "penanda"));
  if (!penanda.length) return { galat: k.penanda };
  const nilai = teks(f, "nilai") ? angkaIsian(teks(f, "nilai")) : null;
  const { data: id, error } = await supabase.rpc("save_sign_document", {
    p_judul: teks(f, "judul"), p_isi: teks(f, "isi"), p_jenis: teks(f, "jenis") || "lain", p_nilai: nilai, p_cap: f.get("cap") === "on",
    p_berakhir: tanggal(f, "berakhir"), p_pengingat: 30, p_kedaluwarsa_hari: Number(teks(f, "berlaku")) || 14, p_penanda: penanda,
  });
  if (error) return salah(error);
  const { data, error: e2 } = await supabase.rpc("send_sign_document", { p_id: id });
  if (e2) return salah(e2);
  const r = data as { kode: string; penanda: { nama: string; kontak: string | null; token: string }[] };
  segarkan();
  return { pesan: k.terkirim, tautan: r.penanda.map((p) => ({ ...p, kode: r.kode })) };
}

export async function simpanTemplatTanda(_: HasilTanda, f: FormData): Promise<HasilTanda> {
  const { k, supabase, salah } = await siap();
  const { error } = await supabase.rpc("save_sign_template", { p_judul: teks(f, "judul"), p_isi: teks(f, "isi"), p_jenis: teks(f, "jenis") || "lain" });
  if (error) return salah(error);
  segarkan();
  return { pesan: k.templat };
}

export async function kirimMassal(_: HasilTanda, f: FormData): Promise<HasilTanda> {
  const { k, supabase, salah } = await siap();
  const penerima = uraiPenanda(teks(f, "penerima"));
  if (!penerima.length) return { galat: k.penanda };
  const { data, error } = await supabase.rpc("send_from_template", { p_template: teks(f, "templat"), p_penerima: penerima, p_cap: f.get("cap") === "on", p_berakhir: tanggal(f, "berakhir") });
  if (error) return salah(error);
  const r = data as Tautan[];
  segarkan();
  return { pesan: isiTeks(k.massal, { n: r.length }), tautan: r };
}

export async function batalTanda(_: HasilTanda, f: FormData): Promise<HasilTanda> {
  const { k, supabase, salah } = await siap();
  const { error } = await supabase.rpc("cancel_sign_document", { p_id: teks(f, "id") });
  if (error) return salah(error);
  segarkan();
  return { pesan: k.batal };
}
