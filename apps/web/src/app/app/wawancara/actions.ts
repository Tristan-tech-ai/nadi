"use server";

import { revalidatePath } from "next/cache";
import { ringkasanWawancara } from "@/lib/wawancara/pertanyaan";
import { rapikanTranskrip } from "@/lib/wawancara/transkrip";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";

export type HasilTranskrip = { pesan: string } | { galat: string };

type Topi = { nama: string; keahlian: unknown; tanggung_jawab: unknown };

/** Simpan transkrip satu jawaban beserta nilai rubrik topinya (dihitung di server, bukan dari klien). */
export async function simpanTranskrip(jawabanId: string, teks: string): Promise<HasilTranskrip> {
  await wajibPerusahaan();
  const transkrip = rapikanTranskrip(teks);
  const supabase = await createClient();
  const { data } = await supabase.from("jawaban_wawancara").select("lamaran_id, lamaran(lowongan(topi(nama, keahlian, tanggung_jawab)))").eq("id", jawabanId).maybeSingle();
  if (!data) return { galat: "Jawaban ini tidak ditemukan atau bukan milik usahamu." };
  const topi = (data as unknown as { lamaran: { lowongan: { topi: Topi | null } | null } | null }).lamaran?.lowongan?.topi;
  const nilai = topi ? ringkasanWawancara(topi, [{ transkrip }]).nilai : null;
  const { error } = await supabase.rpc("simpan_transkrip", { p_jawaban: jawabanId, p_transkrip: transkrip, p_nilai: nilai });
  if (error) return { galat: error.code === "42501" ? "Hanya pemilik atau admin yang bisa menyimpan transkrip." : "Transkrip gagal disimpan. Coba lagi sebentar." };
  revalidatePath(`/app/wawancara/${data.lamaran_id}`);
  return { pesan: transkrip ? "Transkrip tersimpan." : "Tidak ada ucapan yang terdengar di klip ini." };
}
