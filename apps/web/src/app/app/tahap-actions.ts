"use server";

import { revalidatePath } from "next/cache";
import { hariIni } from "@/lib/izin";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { tahapSah, type Tahap } from "@/lib/rekrut/keputusan";
import { formatLamaMenit, menitSah } from "@/lib/rekrut/magang";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { zonaUsaha } from "@/lib/zona-usaha";

export type HasilKeputusan = { pesan: string } | { galat: string } | null;

const ID_SAH = /^[0-9a-f-]{36}$/i;

async function teksTahap() {
  const bahasa = await bahasaAplikasi();
  const kamus = ambilKamus(bahasa);
  const w = kamus.wawancara;
  const label: Record<Tahap, string> = { masuk: w.tMasuk, ditinjau: w.tDitinjau, ditawari: w.tDitawari, diterima: w.tDiterima, ditolak: w.tDitolak };
  return { ...kamus.wawancaraPesan, label, bahasa, db: (pesan: string) => isiTeks(kamus.wawancaraPesan.galatDb, { pesan }) };
}

/** Ubah tahap lamaran (F2-05). Database memeriksa pemilik/admin dan usaha yang sama; pesan maks 500 huruf. */
export async function ubahTahap(_: HasilKeputusan, form: FormData): Promise<HasilKeputusan> {
  const k = await teksTahap();
  const sesi = await wajibPerusahaan();
  const lamaran = String(form.get("lamaran") ?? "");
  const tahap = String(form.get("tahap") ?? "");
  const pesan = String(form.get("pesan") ?? "").trim();
  if (!ID_SAH.test(lamaran) || !tahapSah(tahap)) return { galat: k.pilihanTak };
  if (pesan.length > 500) return { galat: isiTeks(k.pesanPanjang, { n: pesan.length }) };
  // F2-06: menit menilai (boleh kosong) masuk buku jam rekrutmen sebagai jenis penilai untuk lamaran ini.
  const menitTeks = String(form.get("menit") ?? "").trim();
  const menit = menitTeks ? Number(menitTeks) : null;
  if (menit !== null && !menitSah(menit)) return { galat: k.menitSalah };
  const supabase = await createClient();
  const { error } = await supabase.rpc("ubah_tahap_lamaran", { p_lamaran: lamaran, p_tahap: tahap, p_pesan: pesan || null });
  if (error) return { galat: error.code === "42501" ? k.hanyaPutus : isiTeks(k.galatCoba, { pesan: error.message }) };
  revalidatePath(`/app/wawancara/${lamaran}`);
  revalidatePath("/app/orang");
  const tersimpan = isiTeks(k.tersimpanTahap, { tahap: k.label[tahap].toLowerCase() });
  if (menit !== null) {
    const { error: e2 } = await supabase.rpc("catat_jam_rekrut", { p_jenis: "penilai", p_rencana: null, p_lamaran: lamaran, p_tanggal: hariIni(new Date(), await zonaUsaha(supabase, sesi.perusahaanId)), p_menit: menit, p_catatan: null });
    if (e2) return { galat: isiTeks(k.menitGagal, { tersimpan, n: menit }) };
    revalidatePath("/app/magang");
    return { pesan: isiTeks(k.menitTercatat, { tersimpan, lama: formatLamaMenit(menit, k.bahasa) }) };
  }
  return { pesan: tersimpan };
}

/** F2-07: pelamar yang diterima dicatat sebagai karyawan (orang baru bertanggal mulai, topi lowongannya), lamaran tertaut ke orang. */
export async function catatKaryawan(_: HasilKeputusan, form: FormData): Promise<HasilKeputusan> {
  const k = await teksTahap();
  await wajibPerusahaan();
  const lamaran = String(form.get("lamaran") ?? "");
  const mulai = String(form.get("mulai") ?? "");
  if (!ID_SAH.test(lamaran)) return { galat: k.pilihanTakSingkat };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(mulai)) return { galat: k.pilihTanggal };
  const supabase = await createClient();
  const { error } = await supabase.rpc("jadikan_karyawan", { p_lamaran: lamaran, p_mulai: mulai });
  if (error) return { galat: error.code === "42501" ? k.hanyaCatat : error.code === "22023" ? k.db(error.message) : k.gagalCatat };
  revalidatePath(`/app/wawancara/${lamaran}`);
  revalidatePath("/app/orang");
  return { pesan: k.tercatat };
}
