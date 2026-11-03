"use server";

import { revalidatePath } from "next/cache";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { angkaIsian, GALAT_IZIN_DB, JENIS_IZIN, type JenisIzin } from "@/lib/izin";
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
  const bahasa = await bahasaAplikasi();
  const t = ambilKamus(bahasa).izin;
  if (!jenisSah(jenis)) return { galat: t.pilihJenis };
  if (!tanggalSah(mulai) || !tanggalSah(selesai)) return { galat: t.isiTanggal };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ajukan_izin", {
    p_jenis: jenis,
    p_mulai: mulai,
    p_selesai: selesai,
    p_alasan: alasan || null,
    p_berkas: /^[0-9a-f-]{36}$/i.test(berkas) ? berkas : null,
  });
  if (error) {
    // Pesan galat dari database sudah ditulis untuk pengguna dalam bahasa Indonesia; bahasa lain memakai pesan per kode.
    const kode = GALAT_IZIN_DB[error.code ?? ""];
    if (!kode) return { galat: t.gagal };
    return { galat: bahasa === "id" ? error.message : t.galatDb[kode] };
  }
  const d = data as { status: string; oleh_otopilot: boolean; alasan_putusan: string; hari: number };
  revalidatePath("/app/izin");
  return { status: d.status, otopilot: d.oleh_otopilot, alasan: d.alasan_putusan, hari: d.hari };
}

export type HasilKebijakan = { tersimpan: string } | { galat: string } | null;

/** Pemilik/admin menyimpan kebijakan satu jenis izin. */
export async function aturKebijakan(_: HasilKebijakan, form: FormData): Promise<HasilKebijakan> {
  const jenis = String(form.get("jenis") ?? "");
  const k = ambilKamus(await bahasaAplikasi());
  const t = k.kebijakanIzin;
  if (!jenisSah(jenis)) return { galat: t.jenisTak };
  const maksHari = angkaIsian(form.get("maks_hari"), 0, 30);
  const bersamaan = angkaIsian(form.get("maks_bersamaan"), 0, 1000);
  const jatah = jenis === "cuti" ? angkaIsian(form.get("jatah"), 0, 60) : null;
  if (maksHari === "salah" || maksHari === null) return { galat: t.maksHari };
  if (bersamaan === "salah") return { galat: t.maksBersamaan };
  if (jatah === "salah") return { galat: t.maksJatah };
  const supabase = await createClient();
  const { error } = await supabase.rpc("atur_kebijakan_izin", {
    p_jenis: jenis,
    p_otomatis: form.get("otomatis") === "on",
    p_maks_hari: maksHari,
    p_butuh_bukti: form.get("butuh_bukti") === "on",
    p_maks_bersamaan: bersamaan,
    p_jatah_tahunan: jatah,
  });
  if (error) return { galat: error.code === "42501" ? t.hanyaPengelola : t.gagal };
  revalidatePath("/app/perusahaan");
  return { tersimpan: isiTeks(t.tersimpan, { jenis: k.izin.jenis[jenis].toLowerCase() }) };
}
