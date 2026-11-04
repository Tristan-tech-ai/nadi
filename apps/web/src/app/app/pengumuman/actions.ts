"use server";

import { revalidatePath } from "next/cache";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

// M-11: pengumuman (pemilik/admin menulis, semua anggota sasaran membaca dan menandai dibaca).
export type HasilPengumuman = { pesan: string } | { galat: string } | null;
const PERAN = ["pemilik", "admin", "akuntan", "staf"];

export async function buatPengumuman(_: HasilPengumuman, f: FormData): Promise<HasilPengumuman> {
  const k = ambilKamus(await bahasaAplikasi()).hrPesan;
  const untuk = f.getAll("untuk").map(String).filter((p) => PERAN.includes(p));
  const supabase = await createClient();
  const { error } = await supabase.rpc("buat_pengumuman", {
    p_judul: String(f.get("judul") ?? ""), p_isi: String(f.get("isi") ?? ""), p_untuk: untuk.length ? untuk : null, p_kunci: String(f.get("kunci") ?? ""),
  });
  if (error) return { galat: error.code === "42501" ? k.hanya : error.code === "22023" ? error.message : k.gagal };
  revalidatePath("/app/pengumuman");
  return { pesan: k.pengumumanTerkirim };
}

export async function tandaiBaca(_: HasilPengumuman, f: FormData): Promise<HasilPengumuman> {
  const k = ambilKamus(await bahasaAplikasi()).hrPesan;
  const supabase = await createClient();
  const { error } = await supabase.rpc("tandai_pengumuman_dibaca", { p_pengumuman: String(f.get("id") ?? "") });
  if (error) return { galat: k.gagal };
  revalidatePath("/app/pengumuman");
  revalidatePath("/app");
  return { pesan: k.dibaca };
}
