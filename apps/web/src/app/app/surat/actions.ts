"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type HasilSurat = { pesan: string } | { galat: string } | null;

const STATUS = ["baru", "ditindaklanjuti", "selesai"];

/** Tautkan surat ke orang (atau lepas tautan bila orang kosong); RPC taut_pihak_surat, pemilik/admin. */
export async function tautPihak(_: HasilSurat, form: FormData): Promise<HasilSurat> {
  const agenda = String(form.get("agenda") ?? "");
  const orang = String(form.get("orang") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("taut_pihak_surat", { p_agenda: agenda, p_orang: orang || null });
  if (error) return { galat: error.code === "42501" ? "Hanya pemilik atau admin yang bisa menautkan pihak surat." : "Pihak gagal ditautkan. Coba lagi sebentar." };
  revalidatePath("/app/surat");
  return { pesan: orang ? "Pihak tertaut." : "Tautan pihak dilepas." };
}

/** Ubah status tindak lanjut surat dan catatannya; RPC ubah_status_surat, pemilik/admin. */
export async function ubahStatus(_: HasilSurat, form: FormData): Promise<HasilSurat> {
  const agenda = String(form.get("agenda") ?? "");
  const status = String(form.get("status") ?? "");
  const catatan = String(form.get("catatan") ?? "");
  if (!STATUS.includes(status)) return { galat: "Pilih status surat." };
  if (catatan.length > 500) return { galat: "Catatan paling panjang 500 huruf." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("ubah_status_surat", { p_agenda: agenda, p_status: status, p_catatan: catatan });
  if (error) return { galat: error.code === "42501" ? "Hanya pemilik atau admin yang bisa mengubah status surat." : "Status gagal disimpan. Coba lagi sebentar." };
  revalidatePath("/app/surat");
  return { pesan: "Tersimpan." };
}
