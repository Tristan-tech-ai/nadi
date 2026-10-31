"use server";

import { revalidatePath } from "next/cache";
import { hariIni } from "@/lib/izin";
import { LABEL_PEMILIK, tahapSah } from "@/lib/rekrut/keputusan";
import { formatLamaMenit, menitSah } from "@/lib/rekrut/magang";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { zonaUsaha } from "@/lib/zona-usaha";

export type HasilKeputusan = { pesan: string } | { galat: string } | null;

const ID_SAH = /^[0-9a-f-]{36}$/i;

/** Ubah tahap lamaran (F2-05). Database memeriksa pemilik/admin dan usaha yang sama; pesan maks 500 huruf. */
export async function ubahTahap(_: HasilKeputusan, form: FormData): Promise<HasilKeputusan> {
  const sesi = await wajibPerusahaan();
  const lamaran = String(form.get("lamaran") ?? "");
  const tahap = String(form.get("tahap") ?? "");
  const pesan = String(form.get("pesan") ?? "").trim();
  if (!ID_SAH.test(lamaran) || !tahapSah(tahap)) return { galat: "Pilihan tidak dikenal. Muat ulang halaman ini lalu pilih lagi." };
  if (pesan.length > 500) return { galat: `Pesan ${pesan.length} huruf. Pendekkan jadi paling banyak 500 huruf.` };
  // F2-06: menit menilai (boleh kosong) masuk buku jam rekrutmen sebagai jenis penilai untuk lamaran ini.
  const menitTeks = String(form.get("menit") ?? "").trim();
  const menit = menitTeks ? Number(menitTeks) : null;
  if (menit !== null && !menitSah(menit)) return { galat: "Menit menilai 1 sampai 600, atau kosongkan." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("ubah_tahap_lamaran", { p_lamaran: lamaran, p_tahap: tahap, p_pesan: pesan || null });
  if (error) return { galat: error.code === "42501" ? "Hanya pemilik atau admin yang bisa memutuskan lamaran." : `${error.message} Coba lagi.` };
  revalidatePath(`/app/wawancara/${lamaran}`);
  revalidatePath("/app/orang");
  const tersimpan = `Tersimpan: ${LABEL_PEMILIK[tahap].toLowerCase()}. Pelamar melihatnya di tautan statusnya.`;
  if (menit !== null) {
    const { error: e2 } = await supabase.rpc("catat_jam_rekrut", { p_jenis: "penilai", p_rencana: null, p_lamaran: lamaran, p_tanggal: hariIni(new Date(), await zonaUsaha(supabase, sesi.perusahaanId)), p_menit: menit, p_catatan: null });
    if (e2) return { galat: `${tersimpan} Tapi ${menit} menit menilai belum tercatat; isi lagi lalu simpan.` };
    revalidatePath("/app/magang");
    return { pesan: `${tersimpan} ${formatLamaMenit(menit)} menilai tercatat di Dana Rekrutmen.` };
  }
  return { pesan: tersimpan };
}
