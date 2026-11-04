"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { hariIni } from "@/lib/izin";
import { uraiTeksNadi } from "@/lib/onboarding/teks-nadi";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { zonaUsahaIni } from "@/lib/zona-usaha";

export type HasilSiapkan = { pesan: string; dibuat: number } | { galat: string } | null;

/** Teks Nadi yang ditempel diurai ulang di server (klien hanya pratinjau), lalu tiap baris dikenali menjadi usulan di Feed. */
export async function jadikanUsulan(_: HasilSiapkan, form: FormData): Promise<HasilSiapkan> {
  const k = ambilKamus(await bahasaAplikasi()).siapkanPesan;
  const sesi = await wajibPerusahaan();
  const teks = String(form.get("teks") ?? "");
  if (teks.length > 20000) return { galat: k.terlaluPanjang };
  const h = uraiTeksNadi(teks, hariIni(new Date(), await zonaUsahaIni(sesi.perusahaanId)));
  if (h.galat === "tanpa_kepala") return { galat: k.tanpaKepala };
  if (h.galat === "json") return { galat: k.jsonRusak };
  if (!h.butir.length) return { galat: k.tidakAda };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("usul_onboarding", { p_butir: h.butir, p_kunci: String(form.get("kunci") ?? "") || randomUUID() });
  if (error) return { galat: error.code === "42501" ? k.hanya : error.code === "22023" || error.code === "P0429" ? isiTeks(k.galatDb, { pesan: error.message }) : k.gagal };
  revalidatePath("/app");
  const d = data as { dibuat: number; sudah: number };
  return { pesan: isiTeks(d.sudah > 0 ? k.jadiSebagian : k.jadi, { n: d.dibuat, old: d.sudah }), dibuat: d.dibuat };
}
