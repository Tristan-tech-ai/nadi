"use server";

import { revalidatePath } from "next/cache";
import { angkaIsian, JENIS_IZIN, type JenisIzin } from "@/lib/izin";
import { createClient } from "@/lib/supabase/server";

export type HasilAjukan = { status: string; otopilot: boolean; alasan: string; hari: number } | { galat: string } | null;

const jenisSah = (x: string): x is JenisIzin => JENIS_IZIN.some((j) => j.kode === x);
const tanggalSah = (x: string) => /^\d{4}-\d{2}-\d{2}$/.test(x);

/** Staf mengajukan izin; otopilot di database memutuskan atau meneruskan ke Feed. Bukti sudah diunggah dari browser. */
export async function ajukanIzin(_: HasilAjukan, form: FormData): Promise<HasilAjukan> {
  const jenis = String(form.get("jenis") ?? "");
  const mulai = String(form.get("mulai") ?? "");
  const selesai = String(form.get("selesai") ?? "") || mulai;
  const alasan = String(form.get("alasan") ?? "").trim().slice(0, 500);
  const berkas = String(form.get("berkas") ?? "");
  if (!jenisSah(jenis)) return { galat: "Pilih sakit, izin, atau cuti." };
  if (!tanggalSah(mulai) || !tanggalSah(selesai)) return { galat: "Isi tanggal mulai dan selesai." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ajukan_izin", {
    p_jenis: jenis,
    p_mulai: mulai,
    p_selesai: selesai,
    p_alasan: alasan || null,
    p_berkas: /^[0-9a-f-]{36}$/i.test(berkas) ? berkas : null,
  });
  if (error) {
    // Pesan galat dari database sudah ditulis untuk pengguna (tanggal, tumpang tindih, akun staf).
    const dikenal = ["22023", "23505", "42501", "P0002"].includes(error.code ?? "");
    return { galat: dikenal ? error.message : "Nadi gagal menyimpan pengajuan. Coba lagi sebentar; isianmu tidak hilang." };
  }
  const d = data as { status: string; oleh_otopilot: boolean; alasan_putusan: string; hari: number };
  revalidatePath("/app/izin");
  return { status: d.status, otopilot: d.oleh_otopilot, alasan: d.alasan_putusan, hari: d.hari };
}

export type HasilKebijakan = { tersimpan: string } | { galat: string } | null;

/** Pemilik/admin menyimpan kebijakan satu jenis izin. */
export async function aturKebijakan(_: HasilKebijakan, form: FormData): Promise<HasilKebijakan> {
  const jenis = String(form.get("jenis") ?? "");
  if (!jenisSah(jenis)) return { galat: "Jenis izin tidak dikenal." };
  const maksHari = angkaIsian(form.get("maks_hari"), 0, 30);
  const bersamaan = angkaIsian(form.get("maks_bersamaan"), 0, 1000);
  const jatah = jenis === "cuti" ? angkaIsian(form.get("jatah"), 0, 60) : null;
  if (maksHari === "salah" || maksHari === null) return { galat: "Batas hari otomatis diisi angka 0 sampai 30." };
  if (bersamaan === "salah") return { galat: "Batas orang izin bersamaan diisi angka, atau kosongkan bila tanpa batas." };
  if (jatah === "salah") return { galat: "Jatah cuti tahunan diisi angka 0 sampai 60, atau kosongkan." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("atur_kebijakan_izin", {
    p_jenis: jenis,
    p_otomatis: form.get("otomatis") === "on",
    p_maks_hari: maksHari,
    p_butuh_bukti: form.get("butuh_bukti") === "on",
    p_maks_bersamaan: bersamaan,
    p_jatah_tahunan: jatah,
  });
  if (error) return { galat: error.code === "42501" ? "Hanya pemilik atau admin yang bisa mengubah kebijakan." : "Kebijakan gagal disimpan. Coba lagi sebentar." };
  revalidatePath("/app/perusahaan");
  return { tersimpan: `Tersimpan. Kebijakan ${jenis} berlaku untuk pengajuan berikutnya.` };
}
