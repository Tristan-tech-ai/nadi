"use server";

import { revalidatePath } from "next/cache";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { cekLowongan } from "@/lib/rekrut/bias";
import { bacaRupiahBulat } from "@/lib/rekrut/magang";
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
  // Q-16: kunci dari browser; kiriman ulang berkunci sama ditolak unik oleh database dan dianggap berhasil.
  const kunci = String(form.get("kunci") ?? "");
  const tp = ambilKamus(await bahasaAplikasi()).lowonganPesan;
  if (kunci && !/^[0-9a-f-]{36}$/i.test(kunci)) return { galat: tp.kunciTak };
  if (judul.length < 3) return { galat: tp.judulPendek };
  // F2-06: biaya iklan lowongan ikut dihitung di Biaya per rekrutmen (dibagi rata ke pelamar yang diterima).
  const iklan = bacaRupiahBulat(String(form.get("biaya_iklan") ?? ""));
  if ("galat" in iklan) return { galat: tp.biaya };
  // Penjaga bias: lowongan berperingatan disimpan tertutup; pemilik bisa memperbaiki atau tetap membukanya.
  const peringatan = cekLowongan(`${judul}\n${ringkasan}`);
  const supabase = await createClient();
  // F2-03: pertanyaan wawancara suara diturunkan dari topi (maks 5, lolos penjaga bias).
  const { data: t } = topi ? await supabase.from("topi").select("nama, keahlian, tanggung_jawab").eq("id", topi).maybeSingle() : { data: null };
  const pertanyaan = t ? pertanyaanDariTopi(t) : [];
  const { error } = await supabase.from("lowongan").insert({ perusahaan_id: sesi.perusahaanId, judul, ringkasan: ringkasan || null, topi_id: topi || null, peringatan, buka: peringatan.length === 0, pertanyaan, biaya_iklan: iklan.nilai ?? 0, kunci_klien: kunci || null });
  if (error && !(kunci && error.code === "23505")) return { galat: tp.gagal };
  revalidatePath("/app/orang");
  if (peringatan.length) return { galat: isiTeks(tp.tertahan, { n: peringatan.length }) };
  return { pesan: tp.dibuat };
}

export async function ubahBukaLowongan(form: FormData): Promise<void> {
  const supabase = await createClient();
  await supabase.from("lowongan").update({ buka: form.get("buka") === "1" }).eq("id", String(form.get("id") ?? ""));
  revalidatePath("/app/orang");
}
