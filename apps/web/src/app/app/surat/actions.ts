"use server";

import { revalidatePath } from "next/cache";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

const teksAgenda = async () => ambilKamus(await bahasaAplikasi()).agendaPesan;

export type HasilSurat = { pesan: string } | { galat: string } | null;

const STATUS = ["baru", "ditindaklanjuti", "selesai"];

/** Tautkan surat ke orang (atau lepas tautan bila orang kosong); RPC taut_pihak_surat, pemilik/admin. */
export async function tautPihak(_: HasilSurat, form: FormData): Promise<HasilSurat> {
  const t = await teksAgenda();
  const agenda = String(form.get("agenda") ?? "");
  const orang = String(form.get("orang") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("taut_pihak_surat", { p_agenda: agenda, p_orang: orang || null });
  if (error) return { galat: error.code === "42501" ? t.hanyaTaut : t.gagalTaut };
  revalidatePath("/app/surat");
  return { pesan: orang ? t.tertaut : t.dilepas };
}

/** Ubah status tindak lanjut surat dan catatannya; RPC ubah_status_surat, pemilik/admin. */
export async function ubahStatus(_: HasilSurat, form: FormData): Promise<HasilSurat> {
  const t = await teksAgenda();
  const agenda = String(form.get("agenda") ?? "");
  const status = String(form.get("status") ?? "");
  const catatan = String(form.get("catatan") ?? "");
  if (!STATUS.includes(status)) return { galat: t.pilihStatus };
  if (catatan.length > 500) return { galat: t.catatanPanjang };
  const supabase = await createClient();
  const { error } = await supabase.rpc("ubah_status_surat", { p_agenda: agenda, p_status: status, p_catatan: catatan });
  if (error) return { galat: error.code === "42501" ? t.hanyaStatus : t.gagalStatus };
  revalidatePath("/app/surat");
  return { pesan: t.tersimpan };
}
