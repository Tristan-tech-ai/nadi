"use server";

import { revalidatePath } from "next/cache";
import { pesanTersimpan, polaSah, type PolaKerja } from "@/lib/gaji/pola-kerja";
import { createClient } from "@/lib/supabase/server";

/** pola dikembalikan agar pilihan tetap tampil setelah galat. */
export type HasilAturanKerja = { pesan: string; pola: PolaKerja } | { galat: string } | null;

/** Pemilik menyimpan pola kerja usaha lewat RPC atur_pola_kerja (hak pemilik aktif dan audit diperiksa database). */
export async function simpanAturanKerja(_: HasilAturanKerja, form: FormData): Promise<HasilAturanKerja> {
  const pola = String(form.get("pola") ?? "");
  if (!polaSah(pola)) return { galat: "Pilih 6 hari atau 5 hari seminggu." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("atur_pola_kerja", { p_pola: pola, p_diatur_sendiri: form.get("diatur_sendiri") === "on" });
  if (error) {
    return { galat: error.code === "42501" ? "Hanya pemilik yang bisa mengubah aturan kerja." : "Aturan kerja belum tersimpan. Coba lagi; pilihanmu masih ada." };
  }
  revalidatePath("/app/perusahaan");
  revalidatePath("/app/gaji");
  return { pesan: pesanTersimpan(pola), pola };
}
