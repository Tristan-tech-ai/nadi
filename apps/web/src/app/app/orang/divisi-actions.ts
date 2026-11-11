"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// X-13 divisi: pemilik/admin menyimpan nama, kepala, dan anggota sekaligus (database memeriksa peran dan usaha).
export type HasilDivisi = { pesan: string } | { galat: string } | null;
const ID = /^[0-9a-f-]{36}$/i;

export async function simpanDivisi(_: HasilDivisi, f: FormData): Promise<HasilDivisi> {
  const id = String(f.get("id") ?? "");
  const nama = String(f.get("nama") ?? "").trim();
  const kepala = String(f.get("kepala") ?? "");
  const anggota = f.getAll("anggota").map(String).filter((x) => ID.test(x));
  if (nama.length < 2 || nama.length > 60) return { galat: "Nama divisi 2 sampai 60 huruf." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("simpan_divisi", { p_id: ID.test(id) ? id : null, p_nama: nama, p_kepala: ID.test(kepala) ? kepala : null, p_anggota: anggota });
  if (error) {
    if (error.code === "23505") return { galat: `Divisi ${nama} sudah ada. Pakai nama lain atau ubah divisi itu.` };
    return { galat: ["22023", "42501", "P0002"].includes(error.code ?? "") ? error.message : "Nadi gagal menyimpan divisi. Coba lagi sebentar." };
  }
  revalidatePath("/app/orang");
  return { pesan: `Divisi ${nama} tersimpan dengan ${anggota.length} anggota.` };
}
