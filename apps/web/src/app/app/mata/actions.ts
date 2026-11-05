"use server";

import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";
import type { Zona } from "@/lib/mata/resep";

export type ZonaTersimpan = Zona;
export type HasilZona = { zona: ZonaTersimpan[] } | { galat: string };

async function galatDb(e: { code?: string; message: string }): Promise<string> {
  const k = ambilKamus(await bahasaAplikasi()).mataPesan;
  if (e.code === "42501") return k.hanya;
  if (e.code === "22023" || e.code === "P0002") return isiTeks(k.galatDb, { pesan: e.message });
  return k.gagal;
}

type ZonaDenah = { nama: string; jenis: string; poligon: [number, number][] };

/** T-01D: denah aktif untuk kamera ini (sidik hex dari perangkat), atau null bila kamera belum dikenal. Tanpa model. */
export async function denahKamera(sidik: string): Promise<{ id: string; zona: ZonaDenah[] } | null> {
  await wajibPerusahaan();
  const supabase = await createClient();
  const { data } = await supabase.rpc("camera_layout", { p_sidik: sidik });
  return (data as { id: string; zona: ZonaDenah[] } | null) ?? null;
}

/** T-01D: kamera baru, satu bingkai kecil yang sudah dikaburkan di perangkat; model mengusulkan zona, pengawas tanpa AI memeriksa. */
export async function usulDenah(gambar: string, sidik: string): Promise<{ id: string; zona: ZonaDenah[]; token: number } | { galat: string }> {
  await wajibPerusahaan();
  const k = ambilKamus(await bahasaAplikasi()).mataPesan;
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke("usul-denah", { body: { gambar, sidik } });
  const h = data as { status?: string; id?: string; zona?: ZonaDenah[]; token?: number; alasan?: string[] } | null;
  if (error || !h || h.status !== "draf" || !h.id || !h.zona) return { galat: h?.status === "ditolak" ? k.denahDitolak : k.gagal };
  return { id: h.id, zona: h.zona, token: h.token ?? 0 };
}

/** T-01D: pemilik menyetujui draf denah (boleh sudah disunting), lalu zona itu dipakai Mata untuk usaha ini. */
export async function setujuiDenah(id: string, zona: ZonaDenah[]): Promise<HasilZona> {
  await wajibPerusahaan();
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_camera_layout", { p_id: id, p_zones: zona });
  if (error) return { galat: await galatDb(error) };
  return simpanZona(zona);
}

/** Simpan seluruh daftar zona (zona yang tidak ada di daftar dinonaktifkan database, tidak dihapus). */
export async function simpanZona(zona: { id?: string; nama: string; jenis: string; poligon: [number, number][] }[]): Promise<HasilZona> {
  await wajibPerusahaan();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_vision_zones", { p_zones: zona });
  if (error) return { galat: await galatDb(error) };
  return { zona: data as ZonaTersimpan[] };
}

/** Catat perubahan status zona; database membuang yang tidak berubah. Tidak ada gambar yang ikut. */
export async function catatMata(butir: { zona: string; status?: "kosong" | "terisi"; jumlah?: number }[]): Promise<{ dicatat: number } | { galat: string }> {
  await wajibPerusahaan();
  if (!butir.length) return { dicatat: 0 };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_vision_state", { p_items: butir.slice(0, 50) });
  if (error) return { galat: await galatDb(error) };
  return { dicatat: Number(data) || 0 };
}

type RekapKirim = import("@/lib/mata/jejak").RekapJam;

async function galatKunjungan(e: { code?: string; message: string }): Promise<string> {
  const k = ambilKamus(await bahasaAplikasi()).kunjunganPesan;
  if (e.code === "42501") return k.hanya;
  if (["22023", "P0002", "55000", "54000"].includes(e.code ?? "")) return isiTeks(k.galatDb, { pesan: e.message });
  return k.gagal;
}

/** W-02: pemilik/admin menyatakan papan informasi kamera terpasang (UU 27/2022 Pasal 17 ayat (1) huruf b). */
export async function aturPapan(pasang: boolean): Promise<{ ok: true } | { galat: string }> {
  await wajibPerusahaan();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_vision_notice", { p_on: pasang });
  if (error) return { galat: await galatKunjungan(error) };
  return { ok: true };
}

/** W-02: kirim rekap kunjungan per jam (jumlah dan detik saja). Kunci yang sama tidak dijumlahkan dua kali. */
export async function kirimRekap(rekap: RekapKirim[], kunci: string): Promise<{ sudah: boolean; jam: number } | { galat: string }> {
  await wajibPerusahaan();
  if (!rekap.length) return { sudah: false, jam: 0 };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_vision_visits", { p_hours: rekap.slice(0, 48), p_key: kunci });
  if (error) return { galat: await galatKunjungan(error) };
  return data as { sudah: boolean; jam: number };
}
