"use server";

import { revalidatePath } from "next/cache";
import { angkaIsian } from "@/lib/buku/laporan";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export type HasilJanji = { pesan: string } | { galat: string } | null;

const teks = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const uuid = (f: FormData, k: string) => (/^[0-9a-f-]{36}$/i.test(teks(f, k)) ? teks(f, k) : null);

async function siap() {
  const k = ambilKamus(await bahasaAplikasi()).janjiPesan;
  const supabase = await createClient();
  const salah = (e: { code?: string; message: string }) => ({ galat: e.code === "42501" ? k.hanya : isiTeks(k.galatDb, { pesan: e.message }) });
  return { k, supabase, salah };
}
const segarkan = () => revalidatePath("/app/janji-temu");

export async function simpanAturJanji(_: HasilJanji, f: FormData): Promise<HasilJanji> {
  const { k, supabase, salah } = await siap();
  const hari = f.getAll("hari").map(Number).filter((n) => n >= 1 && n <= 7);
  const { error } = await supabase.rpc("save_booking_setting", { p_aktif: f.get("aktif") === "on", p_mulai: teks(f, "mulai"), p_selesai: teks(f, "selesai"), p_hari: hari, p_jeda: Number(teks(f, "jeda")) });
  if (error) return salah(error);
  segarkan();
  return { pesan: k.atur };
}

export async function simpanLayananJanji(_: HasilJanji, f: FormData): Promise<HasilJanji> {
  const { k, supabase, salah } = await siap();
  const harga = angkaIsian(teks(f, "harga")) ?? -1;
  const { error } = await supabase.rpc("save_appointment_service", { p_id: null, p_nama: teks(f, "nama"), p_durasi: Number(teks(f, "durasi")), p_harga: harga, p_aktif: true });
  if (error) return salah(error);
  segarkan();
  return { pesan: k.layanan };
}

export async function statusJanji(_: HasilJanji, f: FormData): Promise<HasilJanji> {
  const { k, supabase, salah } = await siap();
  const { error } = await supabase.rpc("set_appointment_status", { p_id: uuid(f, "id"), p_status: teks(f, "status") });
  if (error) return salah(error);
  segarkan();
  return { pesan: k.status };
}

export async function simpanKatalog(_: HasilJanji, f: FormData): Promise<HasilJanji> {
  const { k, supabase, salah } = await siap();
  const { error } = await supabase.rpc("save_catalog_setting", { p_aktif: f.get("aktif") === "on", p_wa: teks(f, "wa") });
  if (error) return salah(error);
  segarkan();
  return { pesan: k.katalog };
}

export async function simpanPoin(_: HasilJanji, f: FormData): Promise<HasilJanji> {
  const { k, supabase, salah } = await siap();
  const { error } = await supabase.rpc("save_loyalty_setting", { p_aktif: true, p_rp: angkaIsian(teks(f, "rp")) ?? 0 });
  if (error) return salah(error);
  segarkan();
  return { pesan: k.poin };
}

export async function tukarPoin(_: HasilJanji, f: FormData): Promise<HasilJanji> {
  const { k, supabase, salah } = await siap();
  const { data, error } = await supabase.rpc("redeem_points", { p_pelanggan: teks(f, "pelanggan"), p_poin: Number(teks(f, "poin")), p_keterangan: teks(f, "untuk") });
  if (error) return salah(error);
  segarkan();
  return { pesan: isiTeks(k.tukar, { n: Number(data) }) };
}
