"use server";

import { revalidatePath } from "next/cache";
import { bacaPengecualian, rupiahIsian, type Pengecualian } from "@/lib/gaji/kolam";
import { bacaPoin, menitDariPoin, teksPoin, teksSelesai, type Estimasi } from "@/lib/kerja/poin";
import { waktuLokalKeIso } from "@/lib/format";
import { ambilKamus, isiTeks, type Kamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { zonaUsaha } from "@/lib/zona-usaha";

export type HasilKerja = { pesan: string; id?: string; aksi?: string } | { galat: string } | null;

const ID_SAH = /^[0-9a-f-]{36}$/i;
const AKSI = ["mulai", "tunggu", "lanjut", "selesai", "batal"] as const;
const teks = (form: FormData, nama: string) => String(form.get(nama) ?? "").trim();

/** Pesan kerja dalam bahasa pengguna; pesan database (bahasa Indonesia) dibungkus di bahasa lain. */
async function teksKerja() {
  const bahasa = await bahasaAplikasi();
  const t: Kamus["kerjaPesan"] = ambilKamus(bahasa).kerjaPesan;
  const db = (pesan: string) => (bahasa === "id" ? pesan : isiTeks(t.galatDb, { pesan }));
  return { t, bahasa, db };
}

function galatDb(e: { code?: string; message: string }, peran: "pemilikAdmin" | "pemilik", k: Awaited<ReturnType<typeof teksKerja>>): string {
  if (e.code === "42501") return isiTeks(k.t.hanya, { peran: k.t[peran] });
  if (e.code === "22023" || e.code === "P0002" || e.code === "55000") return k.db(e.message);
  return k.t.gagal;
}

/**
 * Tambah kerja (pemilik/admin). Database mencoba estimasi riwayat (0 token); bila riwayat kurang, Edge Function estimasi-kerja
 * dipanggil sekali dengan JWT pengguna. Kerja tetap tersimpan walau model gagal; layar lalu jujur meminta isi manual.
 */
export async function tambahKerja(_: HasilKerja, form: FormData): Promise<HasilKerja> {
  const k = await teksKerja();
  const sesi = await wajibPerusahaan();
  const judul = teks(form, "judul");
  const topi = teks(form, "topi");
  const pelaksana = teks(form, "pelaksana");
  const tenggat = teks(form, "tenggat");
  const kunci = teks(form, "kunci");
  if (judul.length < 3) return { galat: k.t.judulPendek };
  if (judul.length > 300) return { galat: isiTeks(k.t.judulPanjang, { n: judul.length }) };
  if ((topi && !ID_SAH.test(topi)) || (pelaksana && !ID_SAH.test(pelaksana)) || (kunci && !ID_SAH.test(kunci))) return { galat: k.t.pilihanTak };
  if (tenggat && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(tenggat)) return { galat: k.t.tenggatFormat };

  const supabase = await createClient();
  // Isian datetime-local tanpa zona = jam dinding usaha (perusahaan.zona_waktu, sumber yang sama dengan app.zona), dikirim sebagai ISO UTC.
  const tenggatIso = tenggat ? waktuLokalKeIso(tenggat, await zonaUsaha(supabase, sesi.perusahaanId)) : null;
  if (tenggat && !tenggatIso) return { galat: k.t.tenggatTak };
  const { data, error } = await supabase.rpc("buat_kerja", {
    p_judul: judul, p_topi: topi || null, p_pelaksana: pelaksana || null,
    p_tenggat: tenggatIso,
    // Kunci idempoten dari browser: kiriman ulang mengembalikan kerja yang sama (migrasi papan_kerja_idempoten).
    p_kunci: kunci || null,
  });
  if (error) return { galat: galatDb(error, "pemilikAdmin", k) };
  const hasil = data as { id: string; estimasi: Estimasi | null; perlu_model: boolean };
  let estimasi = hasil.estimasi;
  if (hasil.perlu_model) {
    const { data: m, error: em } = await supabase.functions.invoke<{ estimasi?: Estimasi }>("estimasi-kerja", { body: { kerja_id: hasil.id }, timeout: 20_000 });
    if (!em && m?.estimasi) estimasi = m.estimasi;
  }
  revalidatePath("/app/kerja");
  return {
    id: hasil.id,
    pesan: estimasi ? isiTeks(k.t.tersimpanPoin, { poin: teksPoin(estimasi, k.bahasa) }) : k.t.tersimpanTanpa,
  };
}

/** Mulai, Tunggu dulu, Lanjut, Selesai (pelaksana sendiri atau pemilik/admin), Batalkan (pemilik/admin). */
export async function ubahStatus(_: HasilKerja, form: FormData): Promise<HasilKerja> {
  const k = await teksKerja();
  await wajibPerusahaan();
  const id = teks(form, "kerja");
  const aksi = teks(form, "aksi") as (typeof AKSI)[number];
  if (!ID_SAH.test(id) || !AKSI.includes(aksi)) return { galat: k.t.pilihanTak };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ubah_status_kerja", { p_kerja: id, p_aksi: aksi });
  if (error) return { galat: galatDb(error, "pemilikAdmin", k) };
  revalidatePath("/app/kerja");
  const r = data as { aktual_menit: number | null; estimasi: Estimasi | null };
  const pesan = {
    mulai: k.t.dimulai,
    tunggu: k.t.ditunda,
    lanjut: k.t.dilanjutkan,
    selesai: `${teksSelesai(r.aktual_menit, r.estimasi?.menit ?? null, k.bahasa)}.`,
    batal: k.t.dibatalkan,
  }[aksi];
  return { pesan, id, aksi };
}

/** Ubah poin (pemilik/admin): sumber manual, tetap ikut kalibrasi. */
export async function ubahPoin(_: HasilKerja, form: FormData): Promise<HasilKerja> {
  const k = await teksKerja();
  await wajibPerusahaan();
  const id = teks(form, "kerja");
  const poin = bacaPoin(teks(form, "poin"));
  const alasan = teks(form, "alasan");
  if (!ID_SAH.test(id)) return { galat: k.t.kerjaTak };
  if (poin === null) return { galat: k.t.isiPoin };
  if (alasan.length > 300) return { galat: isiTeks(k.t.alasanPanjang, { n: alasan.length, maks: 300 }) };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("simpan_estimasi_kerja", { p_kerja: id, p_menit: menitDariPoin(poin), p_sumber: "manual", p_alasan: alasan || null });
  if (error) return { galat: galatDb(error, "pemilikAdmin", k) };
  revalidatePath("/app/kerja");
  return { pesan: isiTeks(k.t.tersimpanPoin, { poin: teksPoin(data as Estimasi, k.bahasa) }), id };
}

export type HasilUsulan = { orang: string; nama: string; alasan: string } | { kosong: string } | { galat: string };

/**
 * Usulan pelaksana untuk kerja baru bertopi `topi` (pemilik/admin): orang bertopi cocok dengan beban per jam paling ringan,
 * beserta alasan satu kalimat dari public.usulan_pelaksana (aturan sama dengan src/lib/kerja/adil.ts). Hanya membaca, jadi
 * tidak butuh kunci idempoten. Pemilik bebas memilih orang lain.
 */
export async function usulkanPelaksana(topi: string): Promise<HasilUsulan> {
  const k = await teksKerja();
  await wajibPerusahaan();
  if (!ID_SAH.test(topi)) return { galat: k.t.topiTak };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("usulan_pelaksana", { p_topi: topi, p_poin: null });
  if (error) return { galat: error.code === "42501" ? k.t.usulanHanya : error.code === "P0002" ? k.db(error.message) : k.t.usulanGagal };
  if (!data) return { kosong: k.t.usulanKosong };
  const u = data as { orang_id: string; nama: string; alasan: string };
  return { orang: u.orang_id, nama: u.nama, alasan: u.alasan };
}

/**
 * "Ada yang keliru?" (F3-03): staf menandai kerjanya sendiri yang keliru dihitung di Kerjamu minggu ini. Menjadi usulan
 * kpi.banding untuk pemilik lewat public.banding_kpi. Kunci idempoten dari browser: kiriman ulang useOffline mengembalikan usulan
 * yang sama, bukan usulan kembar.
 */
export async function tandaiKeliru(_: HasilKerja, form: FormData): Promise<HasilKerja> {
  const k = await teksKerja();
  await wajibPerusahaan();
  const kerja = teks(form, "kerja");
  const alasan = teks(form, "alasan");
  const kunci = teks(form, "kunci");
  if (!ID_SAH.test(kerja)) return { galat: k.t.pilihKeliru };
  if (kunci && !ID_SAH.test(kunci)) return { galat: k.t.pilihanTak };
  if (alasan.length < 3) return { galat: k.t.tulisAlasan };
  if (alasan.length > 500) return { galat: isiTeks(k.t.alasanPanjang, { n: alasan.length, maks: 500 }) };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("banding_kpi", { p_kerja: kerja, p_alasan: alasan, p_kunci: kunci || null });
  if (error) {
    if (error.code === "42501" || error.code === "22023" || error.code === "P0002") return { galat: k.db(error.message) };
    return { galat: k.t.gagal };
  }
  revalidatePath("/app/kerja");
  const r = data as { id: string; sudah: boolean };
  return { id: r.id, pesan: r.sudah ? k.t.sudahDitandai : k.t.terkirimTanda };
}

/**
 * "Pasang topi X ke Y" (F3-04, peta organisasi): membuat usulan orang.topi untuk pemilik lewat public.usulkan_pasang_topi, bukan
 * memasang langsung. Database memeriksa ulang dasarnya (lintas topi >= 30% poin orang itu 4 minggu terakhir). Kunci idempoten dari
 * browser: kiriman ulang useOffline mengembalikan usulan yang sama.
 */
export async function usulkanTopi(_: HasilKerja, form: FormData): Promise<HasilKerja> {
  const k = await teksKerja();
  await wajibPerusahaan();
  const orang = teks(form, "orang");
  const topi = teks(form, "topi");
  const kunci = teks(form, "kunci");
  if (!ID_SAH.test(orang) || !ID_SAH.test(topi) || (kunci && !ID_SAH.test(kunci))) return { galat: k.t.pilihanTak };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("usulkan_pasang_topi", { p_orang: orang, p_topi: topi, p_kunci: kunci || null });
  if (error) {
    if (error.code === "42501" || error.code === "22023") return { galat: k.db(error.message) };
    return { galat: k.t.gagalUsulan };
  }
  // Tanpa revalidatePath: penyegaran halaman yang sedang dilihat akan mengganti tombol dengan teks "sudah menunggu" sebelum pesan
  // hasil terbaca (role=status). Feed dan peta dirender per permintaan (staleTimes.dynamic bawaan 0), jadi kunjungan berikutnya
  // sudah memuat usulan ini.
  const r = data as { id: string; sudah: boolean };
  return { id: r.id, pesan: r.sudah ? k.t.usulanAda : k.t.usulanTerkirim };
}

/**
 * Setujui pembagian kolam bonus beban (F3-05, pemilik saja): simpan_kolam (draf, kunci idempoten dari browser) lalu
 * setujui_kolam. Database menghitung ulang dan menolak bila kerja berubah sejak pratinjau, bila gaji bulan itu sudah disetujui,
 * atau bila kurang dari 5 kerja berpoin.
 */
export async function setujuiKolam(_: HasilKerja, form: FormData): Promise<HasilKerja> {
  const k = await teksKerja();
  await wajibPerusahaan();
  const bulan = teks(form, "bulan");
  const jumlah = rupiahIsian(teks(form, "jumlah"));
  const kunci = teks(form, "kunci");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(bulan) || !jumlah) return { galat: k.t.isiKolam };
  if (kunci && !ID_SAH.test(kunci)) return { galat: k.t.pilihanTak };
  let dikecualikan: Pengecualian[];
  try {
    dikecualikan = bacaPengecualian((JSON.parse(teks(form, "dikecualikan") || "[]") as Pengecualian[]).map((x) => `${x.orang_id}~${x.alasan}`));
  } catch {
    return { galat: k.t.kecualiTak };
  }
  const supabase = await createClient();
  const { data: d, error: e1 } = await supabase.rpc("simpan_kolam", { p_bulan: `${bulan}-01`, p_jumlah: jumlah, p_dikecualikan: dikecualikan, p_kunci: kunci || null });
  if (e1) return { galat: galatDb(e1, "pemilik", k) };
  const { data, error } = await supabase.rpc("setujui_kolam", { p_kolam: (d as { id: string }).id });
  if (error) return { galat: galatDb(error, "pemilik", k) };
  const r = data as { slip: number };
  revalidatePath("/app/kerja");
  revalidatePath("/app/gaji");
  return {
    pesan: r.slip
      ? isiTeks(k.t.kolamSlip, { n: r.slip })
      : k.t.kolamNanti,
  };
}

/** Batalkan pembagian yang disetujui (pemilik, dengan alasan) selama gaji bulan itu belum disetujui. */
export async function batalkanKolam(_: HasilKerja, form: FormData): Promise<HasilKerja> {
  const k = await teksKerja();
  await wajibPerusahaan();
  const kolam = teks(form, "kolam");
  if (!ID_SAH.test(kolam)) return { galat: k.t.pilihanTak };
  const supabase = await createClient();
  const { error } = await supabase.rpc("batal_kolam", { p_kolam: kolam, p_alasan: teks(form, "alasan") });
  if (error) return { galat: galatDb(error, "pemilik", k) };
  revalidatePath("/app/kerja");
  revalidatePath("/app/gaji");
  return { pesan: k.t.kolamBatal };
}
