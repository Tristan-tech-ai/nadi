"use server";

import { revalidatePath } from "next/cache";
import { POLA_KERJA, polaSah, type PolaKerja } from "@/lib/gaji/pola-kerja";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

/** pola dikembalikan agar pilihan tetap tampil setelah galat. */
export type HasilAturanKerja = { pesan: string; pola: PolaKerja } | { galat: string } | null;

/** Pemilik menyimpan pola kerja usaha lewat RPC atur_pola_kerja (hak pemilik aktif dan audit diperiksa database). */
export async function simpanAturanKerja(_: HasilAturanKerja, form: FormData): Promise<HasilAturanKerja> {
  const pola = String(form.get("pola") ?? "");
  const t = ambilKamus(await bahasaAplikasi()).aturanKerja;
  if (!polaSah(pola)) return { galat: t.pilihPola };
  const supabase = await createClient();
  const { error } = await supabase.rpc("atur_pola_kerja", { p_pola: pola, p_diatur_sendiri: form.get("diatur_sendiri") === "on" });
  if (error) {
    return { galat: error.code === "42501" ? t.hanyaUbah : t.gagal };
  }
  revalidatePath("/app/perusahaan");
  revalidatePath("/app/gaji");
  return { pesan: isiTeks(t.tersimpan, { hari: POLA_KERJA[pola].hari }), pola };
}
