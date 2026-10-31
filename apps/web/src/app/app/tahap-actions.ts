"use server";

import { revalidatePath } from "next/cache";
import { LABEL_PEMILIK, tahapSah } from "@/lib/rekrut/keputusan";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";

export type HasilKeputusan = { pesan: string } | { galat: string } | null;

const ID_SAH = /^[0-9a-f-]{36}$/i;

/** Ubah tahap lamaran (F2-05). Database memeriksa pemilik/admin dan usaha yang sama; pesan maks 500 huruf. */
export async function ubahTahap(_: HasilKeputusan, form: FormData): Promise<HasilKeputusan> {
  await wajibPerusahaan();
  const lamaran = String(form.get("lamaran") ?? "");
  const tahap = String(form.get("tahap") ?? "");
  const pesan = String(form.get("pesan") ?? "").trim();
  if (!ID_SAH.test(lamaran) || !tahapSah(tahap)) return { galat: "Pilihan tidak dikenal. Muat ulang halaman ini lalu pilih lagi." };
  if (pesan.length > 500) return { galat: `Pesan ${pesan.length} huruf. Pendekkan jadi paling banyak 500 huruf.` };
  const supabase = await createClient();
  const { error } = await supabase.rpc("ubah_tahap_lamaran", { p_lamaran: lamaran, p_tahap: tahap, p_pesan: pesan || null });
  if (error) return { galat: error.code === "42501" ? "Hanya pemilik atau admin yang bisa memutuskan lamaran." : `${error.message} Coba lagi.` };
  revalidatePath(`/app/wawancara/${lamaran}`);
  revalidatePath("/app/orang");
  return { pesan: `Tersimpan: ${LABEL_PEMILIK[tahap].toLowerCase()}. Pelamar melihatnya di tautan statusnya.` };
}
