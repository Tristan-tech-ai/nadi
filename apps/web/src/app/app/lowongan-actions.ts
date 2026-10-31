"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";

export type HasilLowongan = { pesan: string } | { galat: string } | null;

/** Buat lowongan dari topi (posisi). Kode publik dibuat database. */
export async function buatLowongan(_: HasilLowongan, form: FormData): Promise<HasilLowongan> {
  const sesi = await wajibPerusahaan();
  const judul = String(form.get("judul") ?? "").trim();
  const ringkasan = String(form.get("ringkasan") ?? "").trim().slice(0, 1000);
  const topi = String(form.get("topi") ?? "");
  if (judul.length < 3) return { galat: "Tulis judul lowongan, misalnya Pelayan shift malam." };
  const supabase = await createClient();
  const { error } = await supabase.from("lowongan").insert({ perusahaan_id: sesi.perusahaanId, judul, ringkasan: ringkasan || null, topi_id: topi || null });
  if (error) return { galat: "Lowongan gagal dibuat. Hanya pemilik atau admin yang bisa membuatnya." };
  revalidatePath("/app/orang");
  return { pesan: "Lowongan dibuat. Bagikan tautannya di bawah." };
}

export async function ubahBukaLowongan(form: FormData): Promise<void> {
  const supabase = await createClient();
  await supabase.from("lowongan").update({ buka: form.get("buka") === "1" }).eq("id", String(form.get("id") ?? ""));
  revalidatePath("/app/orang");
}
