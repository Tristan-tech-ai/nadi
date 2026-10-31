"use server";

import { revalidatePath } from "next/cache";
import { cekLowongan } from "@/lib/rekrut/bias";
import { pertanyaanDariTopi } from "@/lib/wawancara/pertanyaan";
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
  // Penjaga bias: lowongan berperingatan disimpan tertutup; pemilik bisa memperbaiki atau tetap membukanya.
  const peringatan = cekLowongan(`${judul}\n${ringkasan}`);
  const supabase = await createClient();
  // F2-03: pertanyaan wawancara suara diturunkan dari topi (maks 5, lolos penjaga bias).
  const { data: t } = topi ? await supabase.from("topi").select("nama, keahlian, tanggung_jawab").eq("id", topi).maybeSingle() : { data: null };
  const pertanyaan = t ? pertanyaanDariTopi(t) : [];
  const { error } = await supabase.from("lowongan").insert({ perusahaan_id: sesi.perusahaanId, judul, ringkasan: ringkasan || null, topi_id: topi || null, peringatan, buka: peringatan.length === 0, pertanyaan });
  if (error) return { galat: "Lowongan gagal dibuat. Hanya pemilik atau admin yang bisa membuatnya." };
  revalidatePath("/app/orang");
  if (peringatan.length) return { galat: `Lowongan disimpan tapi belum dibuka: ada ${peringatan.length} syarat yang bisa melanggar aturan rekrutmen. Lihat catatannya di bawah.` };
  return { pesan: "Lowongan dibuat. Bagikan tautannya di bawah." };
}

export async function ubahBukaLowongan(form: FormData): Promise<void> {
  const supabase = await createClient();
  await supabase.from("lowongan").update({ buka: form.get("buka") === "1" }).eq("id", String(form.get("id") ?? ""));
  revalidatePath("/app/orang");
}
