"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { angkaIsian } from "@/lib/buku/laporan";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export type HasilCrm = { pesan: string } | { galat: string } | null;

const teks = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const kosong = (f: FormData, k: string) => teks(f, k) || null;
const tanggal = (f: FormData, k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(teks(f, k)) ? teks(f, k) : null);
const uuid = (f: FormData, k: string) => (/^[0-9a-f-]{36}$/i.test(teks(f, k)) ? teks(f, k) : null);

async function siap() {
  const bahasa = await bahasaAplikasi();
  const kamus = ambilKamus(bahasa);
  const k = kamus.crmPesan;
  const supabase = await createClient();
  const salah = (e: { code?: string; message: string }) => ({ galat: e.code === "42501" ? k.hanya : isiTeks(k.galatDb, { pesan: e.message }) });
  return { k, t: kamus.crm, supabase, salah };
}
const segarkan = () => revalidatePath("/app/pelanggan");

export async function simpanPelanggan(_: HasilCrm, f: FormData): Promise<HasilCrm> {
  const { k, supabase, salah } = await siap();
  const { error } = await supabase.rpc("save_customer", {
    p_id: null, p_nama: teks(f, "nama"), p_jenis: teks(f, "jenis") || "perusahaan", p_induk: uuid(f, "induk"), p_hp: kosong(f, "hp"),
    p_email: kosong(f, "email"), p_kota: kosong(f, "kota"), p_segmen: kosong(f, "segmen"),
  });
  if (error) return salah(error);
  segarkan();
  return { pesan: isiTeks(k.pelanggan, { nama: teks(f, "nama") }) };
}

export async function simpanDeal(_: HasilCrm, f: FormData): Promise<HasilCrm> {
  const { k, supabase, salah } = await siap();
  const nilai = angkaIsian(teks(f, "nilai"));
  if (nilai === null || nilai < 0) return { galat: k.angka };
  if (!uuid(f, "pelanggan")) return { galat: k.isian };
  const { error } = await supabase.rpc("save_deal", { p_id: null, p_customer: uuid(f, "pelanggan"), p_judul: teks(f, "judul"), p_nilai: nilai, p_sales: uuid(f, "sales"), p_tutup: tanggal(f, "tutup") });
  if (error) return salah(error);
  segarkan();
  return { pesan: k.deal };
}

export async function pindahDeal(_: HasilCrm, f: FormData): Promise<HasilCrm> {
  const { k, t, supabase, salah } = await siap();
  const tahap = teks(f, "tahap") as keyof typeof t.tahap;
  const { error } = await supabase.rpc("move_deal", { p_deal: uuid(f, "deal"), p_tahap: tahap, p_alasan: kosong(f, "alasan") });
  if (error) return salah(error);
  segarkan();
  return { pesan: isiTeks(k.pindah, { tahap: (t.tahap[tahap] ?? tahap).toLowerCase() }) };
}

export async function penawaranDeal(_: HasilCrm, f: FormData): Promise<HasilCrm> {
  const { k, supabase, salah } = await siap();
  const harga = angkaIsian(teks(f, "harga"));
  const jumlah = Number(teks(f, "jumlah").replace(",", "."));
  if (harga === null || harga <= 0 || !Number.isFinite(jumlah) || jumlah <= 0) return { galat: k.angka };
  const { data, error } = await supabase.rpc("deal_to_quote", {
    p_deal: uuid(f, "deal"), p_baris: [{ uraian: teks(f, "uraian"), jumlah, harga }], p_berlaku: tanggal(f, "berlaku"), p_kunci: uuid(f, "kunci") ?? randomUUID(),
  });
  if (error) return salah(error);
  segarkan();
  revalidatePath("/app/jual");
  return { pesan: isiTeks(k.penawaran, { nomor: String((data as { nomor?: string })?.nomor ?? "") }) };
}

export async function catatAktivitas(_: HasilCrm, f: FormData): Promise<HasilCrm> {
  const { k, supabase } = await siap();
  const lat = Number(teks(f, "lat"));
  const lng = Number(teks(f, "lng"));
  const izin = teks(f, "izin_lokasi") === "ya" && Number.isFinite(lat) && Number.isFinite(lng) && teks(f, "lat") !== "";
  const { error } = await supabase.rpc("add_deal_activity", {
    p_deal: uuid(f, "deal"), p_jenis: teks(f, "jenis"), p_isi: teks(f, "isi"), p_jatuh_tempo: teks(f, "jenis") === "tugas" ? tanggal(f, "jatuh") : null,
    p_lokasi: izin ? { lat, lng, akurasi: Number(teks(f, "akurasi")) || 0 } : null, p_izin_lokasi: izin,
  });
  if (error) return { galat: error.code === "42501" ? k.hanyaSales : isiTeks(k.galatDb, { pesan: error.message }) };
  segarkan();
  return { pesan: k.aktivitas };
}

export async function selesaiTugas(_: HasilCrm, f: FormData): Promise<HasilCrm> {
  const { k, supabase, salah } = await siap();
  const { error } = await supabase.rpc("complete_deal_task", { p_id: uuid(f, "id") });
  if (error) return salah(error);
  segarkan();
  return { pesan: k.selesai };
}

export async function simpanTarget(_: HasilCrm, f: FormData): Promise<HasilCrm> {
  const { k, supabase, salah } = await siap();
  const nominal = angkaIsian(teks(f, "nominal"));
  if (nominal === null || nominal < 0) return { galat: k.angka };
  const { error } = await supabase.rpc("set_sales_target", { p_orang: uuid(f, "orang"), p_bulan: tanggal(f, "bulan"), p_nominal: nominal });
  if (error) return salah(error);
  segarkan();
  return { pesan: k.target };
}
