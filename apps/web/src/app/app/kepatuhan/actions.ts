"use server";

import { revalidatePath } from "next/cache";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

// M-25: izin usaha (NIB, PIRT, halal, BPOM) dicatat pemilik/admin agar masa berlakunya masuk kalender kepatuhan.
export type HasilIzinUsaha = { pesan: string } | { galat: string } | null;
const JENIS = ["nib", "pirt", "halal", "bpom", "lainnya"];

export async function simpanIzinUsaha(_: HasilIzinUsaha, f: FormData): Promise<HasilIzinUsaha> {
  const k = ambilKamus(await bahasaAplikasi()).kepatuhanPesan;
  const jenis = String(f.get("jenis") ?? "");
  const sampai = String(f.get("berlaku_sampai") ?? "");
  if (!JENIS.includes(jenis)) return { galat: k.jenisTak };
  const supabase = await createClient();
  const { error } = await supabase.rpc("simpan_izin_usaha", {
    p_id: null, p_jenis: jenis, p_nama: String(f.get("nama") ?? ""), p_nomor: String(f.get("nomor") ?? ""),
    p_berlaku_sampai: /^\d{4}-\d{2}-\d{2}$/.test(sampai) ? sampai : null, p_pengingat: Number(f.get("pengingat") || 60), p_aktif: true,
  });
  if (error) return { galat: error.code === "42501" ? k.hanya : k.gagal };
  revalidatePath("/app/kepatuhan");
  return { pesan: k.tersimpan };
}
