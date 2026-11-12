"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { TEKS_DIVISI } from "@/components/app/divisi-teks";

// X-13 divisi: pemilik/admin menyimpan nama, kepala, dan anggota sekaligus (database memeriksa peran dan usaha).
export type HasilDivisi = { pesan: string } | { galat: string } | null;
const ID = /^[0-9a-f-]{36}$/i;

export async function simpanDivisi(_: HasilDivisi, f: FormData): Promise<HasilDivisi> {
  const id = String(f.get("id") ?? "");
  const nama = String(f.get("nama") ?? "").trim();
  const kepala = String(f.get("kepala") ?? "");
  const anggota = f.getAll("anggota").map(String).filter((x) => ID.test(x));
  const t = TEKS_DIVISI[await bahasaAplikasi()];
  if (nama.length < 2 || nama.length > 60) return { galat: t.namaPanjang };
  const supabase = await createClient();
  const { error } = await supabase.rpc("simpan_divisi", { p_id: ID.test(id) ? id : null, p_nama: nama, p_kepala: ID.test(kepala) ? kepala : null, p_anggota: anggota });
  if (error) {
    if (error.code === "23505") return { galat: t.sudahAda.replace("{nama}", nama) };
    return { galat: ["22023", "42501", "P0002"].includes(error.code ?? "") ? error.message : t.gagal };
  }
  revalidatePath("/app/orang");
  return { pesan: t.tersimpan.replace("{nama}", nama).replace("{n}", String(anggota.length)) };
}
