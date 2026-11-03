"use server";

import { revalidatePath } from "next/cache";
import { ringkasanWawancara } from "@/lib/wawancara/pertanyaan";
import { rapikanTranskrip } from "@/lib/wawancara/transkrip";
import { wajibPerusahaan } from "@/lib/sesi";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

const teksWawancara = async () => ambilKamus(await bahasaAplikasi()).wawancaraPesan;

export type HasilTranskrip = { pesan: string } | { galat: string };

type Topi = { nama: string; keahlian: unknown; tanggung_jawab: unknown };

/** Simpan transkrip satu jawaban beserta nilai rubrik topinya (dihitung di server, bukan dari klien). */
export async function simpanTranskrip(jawabanId: string, teks: string): Promise<HasilTranskrip> {
  const k = await teksWawancara();
  await wajibPerusahaan();
  const transkrip = rapikanTranskrip(teks);
  const supabase = await createClient();
  const { data } = await supabase.from("jawaban_wawancara").select("lamaran_id, lamaran(lowongan(topi(nama, keahlian, tanggung_jawab)))").eq("id", jawabanId).maybeSingle();
  if (!data) return { galat: k.tidakDitemukan };
  const topi = (data as unknown as { lamaran: { lowongan: { topi: Topi | null } | null } | null }).lamaran?.lowongan?.topi;
  const nilai = topi ? ringkasanWawancara(topi, [{ transkrip }]).nilai : null;
  const { error } = await supabase.rpc("simpan_transkrip", { p_jawaban: jawabanId, p_transkrip: transkrip, p_nilai: nilai });
  if (error) return { galat: error.code === "42501" ? k.hanyaTranskrip : k.gagalTranskrip };
  revalidatePath(`/app/wawancara/${data.lamaran_id}`);
  return { pesan: transkrip ? k.transkripTersimpan : k.tanpaUcapan };
}
