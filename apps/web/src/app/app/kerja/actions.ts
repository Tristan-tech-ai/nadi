"use server";

import { revalidatePath } from "next/cache";
import { bacaPoin, menitDariPoin, teksPoin, teksSelesai, type Estimasi } from "@/lib/kerja/poin";
import { waktuLokalKeIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { zonaUsaha } from "@/lib/zona-usaha";

export type HasilKerja = { pesan: string; id?: string; aksi?: string } | { galat: string } | null;

const ID_SAH = /^[0-9a-f-]{36}$/i;
const AKSI = ["mulai", "tunggu", "lanjut", "selesai", "batal"] as const;
const teks = (form: FormData, nama: string) => String(form.get(nama) ?? "").trim();

function galatDb(e: { code?: string; message: string }, peran: string): string {
  if (e.code === "42501") return `Hanya ${peran} yang bisa melakukannya.`;
  if (e.code === "22023" || e.code === "P0002" || e.code === "55000") return e.message;
  return "Nadi gagal menyimpan. Coba lagi sebentar; isianmu tidak hilang.";
}

/**
 * Tambah kerja (pemilik/admin). Database mencoba estimasi riwayat (0 token); bila riwayat kurang, Edge Function estimasi-kerja
 * dipanggil sekali dengan JWT pengguna. Kerja tetap tersimpan walau model gagal; layar lalu jujur meminta isi manual.
 */
export async function tambahKerja(_: HasilKerja, form: FormData): Promise<HasilKerja> {
  const sesi = await wajibPerusahaan();
  const judul = teks(form, "judul");
  const topi = teks(form, "topi");
  const pelaksana = teks(form, "pelaksana");
  const tenggat = teks(form, "tenggat");
  const kunci = teks(form, "kunci");
  if (judul.length < 3) return { galat: "Tulis judul kerja, misalnya Cek stok beras." };
  if (judul.length > 300) return { galat: `Judul ${judul.length} huruf. Pendekkan jadi paling banyak 300 huruf.` };
  if ((topi && !ID_SAH.test(topi)) || (pelaksana && !ID_SAH.test(pelaksana)) || (kunci && !ID_SAH.test(kunci))) return { galat: "Pilihan tidak dikenal. Muat ulang halaman ini." };
  if (tenggat && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(tenggat)) return { galat: "Isi tenggat dengan tanggal dan jam, atau kosongkan." };

  const supabase = await createClient();
  // Isian datetime-local tanpa zona = jam dinding usaha (perusahaan.zona_waktu, sumber yang sama dengan app.zona), dikirim sebagai ISO UTC.
  const tenggatIso = tenggat ? waktuLokalKeIso(tenggat, await zonaUsaha(supabase, sesi.perusahaanId)) : null;
  if (tenggat && !tenggatIso) return { galat: "Tanggal atau jam tenggat tidak ada di kalender. Periksa lagi, atau kosongkan." };
  const { data, error } = await supabase.rpc("buat_kerja", {
    p_judul: judul, p_topi: topi || null, p_pelaksana: pelaksana || null,
    p_tenggat: tenggatIso,
    // Kunci idempoten dari browser: kiriman ulang mengembalikan kerja yang sama (migrasi papan_kerja_idempoten).
    p_kunci: kunci || null,
  });
  if (error) return { galat: galatDb(error, "pemilik atau admin") };
  const hasil = data as { id: string; estimasi: Estimasi | null; perlu_model: boolean };
  let estimasi = hasil.estimasi;
  if (hasil.perlu_model) {
    const { data: m, error: em } = await supabase.functions.invoke<{ estimasi?: Estimasi }>("estimasi-kerja", { body: { kerja_id: hasil.id }, timeout: 20_000 });
    if (!em && m?.estimasi) estimasi = m.estimasi;
  }
  revalidatePath("/app/kerja");
  return {
    id: hasil.id,
    pesan: estimasi ? `Tersimpan. ${teksPoin(estimasi)}.` : "Tersimpan. Poin belum diperkirakan; isi manual lewat Ubah poin.",
  };
}

/** Mulai, Tunggu dulu, Lanjut, Selesai (pelaksana sendiri atau pemilik/admin), Batalkan (pemilik/admin). */
export async function ubahStatus(_: HasilKerja, form: FormData): Promise<HasilKerja> {
  await wajibPerusahaan();
  const id = teks(form, "kerja");
  const aksi = teks(form, "aksi") as (typeof AKSI)[number];
  if (!ID_SAH.test(id) || !AKSI.includes(aksi)) return { galat: "Pilihan tidak dikenal. Muat ulang halaman ini." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ubah_status_kerja", { p_kerja: id, p_aksi: aksi });
  if (error) return { galat: galatDb(error, "pemilik atau admin") };
  revalidatePath("/app/kerja");
  const r = data as { aktual_menit: number | null; estimasi: Estimasi | null };
  const pesan = {
    mulai: "Dimulai. Tekan Selesai bila sudah beres.",
    tunggu: "Ditunda. Waktu menunggu tidak dihitung.",
    lanjut: "Dilanjutkan.",
    selesai: `${teksSelesai(r.aktual_menit, r.estimasi?.menit ?? null)}.`,
    batal: "Kerja dibatalkan.",
  }[aksi];
  return { pesan, id, aksi };
}

/** Ubah poin (pemilik/admin): sumber manual, tetap ikut kalibrasi. */
export async function ubahPoin(_: HasilKerja, form: FormData): Promise<HasilKerja> {
  await wajibPerusahaan();
  const id = teks(form, "kerja");
  const poin = bacaPoin(teks(form, "poin"));
  const alasan = teks(form, "alasan");
  if (!ID_SAH.test(id)) return { galat: "Kerja tidak dikenal. Muat ulang halaman ini." };
  if (poin === null) return { galat: "Isi poin 0,25 sampai 99, misalnya 2 atau 1,5 (1 poin = 15 menit)." };
  if (alasan.length > 300) return { galat: `Alasan ${alasan.length} huruf. Pendekkan jadi paling banyak 300 huruf.` };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("simpan_estimasi_kerja", { p_kerja: id, p_menit: menitDariPoin(poin), p_sumber: "manual", p_alasan: alasan || null });
  if (error) return { galat: galatDb(error, "pemilik atau admin") };
  revalidatePath("/app/kerja");
  return { pesan: `Tersimpan. ${teksPoin(data as Estimasi)}.`, id };
}

export type HasilUsulan = { orang: string; nama: string; alasan: string } | { kosong: string } | { galat: string };

/**
 * Usulan pelaksana untuk kerja baru bertopi `topi` (pemilik/admin): orang bertopi cocok dengan beban per jam paling ringan,
 * beserta alasan satu kalimat dari public.usulan_pelaksana (aturan sama dengan src/lib/kerja/adil.ts). Hanya membaca, jadi
 * tidak butuh kunci idempoten. Pemilik bebas memilih orang lain.
 */
export async function usulkanPelaksana(topi: string): Promise<HasilUsulan> {
  await wajibPerusahaan();
  if (!ID_SAH.test(topi)) return { galat: "Topi tidak dikenal. Muat ulang halaman ini." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("usulan_pelaksana", { p_topi: topi, p_poin: null });
  if (error) return { galat: error.code === "42501" ? "Usulan pelaksana hanya untuk pemilik atau admin." : error.code === "P0002" ? error.message : "Usulan pelaksana gagal dimuat. Pilih pelaksana sendiri, atau coba lagi." };
  if (!data) return { kosong: "Belum ada orang aktif yang memakai topi ini. Pilih pelaksana sendiri, atau biarkan kosong." };
  const u = data as { orang_id: string; nama: string; alasan: string };
  return { orang: u.orang_id, nama: u.nama, alasan: u.alasan };
}

/**
 * "Ada yang keliru?" (F3-03): staf menandai kerjanya sendiri yang keliru dihitung di Kerjamu minggu ini. Menjadi usulan
 * kpi.banding untuk pemilik lewat public.banding_kpi. Kunci idempoten dari browser: kiriman ulang useOffline mengembalikan usulan
 * yang sama, bukan usulan kembar.
 */
export async function tandaiKeliru(_: HasilKerja, form: FormData): Promise<HasilKerja> {
  await wajibPerusahaan();
  const kerja = teks(form, "kerja");
  const alasan = teks(form, "alasan");
  const kunci = teks(form, "kunci");
  if (!ID_SAH.test(kerja)) return { galat: "Pilih kerja yang keliru dihitung dulu." };
  if (kunci && !ID_SAH.test(kunci)) return { galat: "Pilihan tidak dikenal. Muat ulang halaman ini." };
  if (alasan.length < 3) return { galat: "Tulis alasannya, misalnya Tenggatnya diundur pemilik hari Senin." };
  if (alasan.length > 500) return { galat: `Alasan ${alasan.length} huruf. Pendekkan jadi paling banyak 500 huruf.` };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("banding_kpi", { p_kerja: kerja, p_alasan: alasan, p_kunci: kunci || null });
  if (error) {
    if (error.code === "42501" || error.code === "22023" || error.code === "P0002") return { galat: error.message };
    return { galat: "Nadi gagal menyimpan. Coba lagi sebentar; isianmu tidak hilang." };
  }
  revalidatePath("/app/kerja");
  const r = data as { id: string; sudah: boolean };
  return { id: r.id, pesan: r.sudah ? "Kerja ini sudah ditandai. Pemilik akan melihatnya di Feed." : "Terkirim ke pemilik. Pemilik akan melihat tandamu di Feed." };
}

/**
 * "Pasang topi X ke Y" (F3-04, peta organisasi): membuat usulan orang.topi untuk pemilik lewat public.usulkan_pasang_topi, bukan
 * memasang langsung. Database memeriksa ulang dasarnya (lintas topi >= 30% poin orang itu 4 minggu terakhir). Kunci idempoten dari
 * browser: kiriman ulang useOffline mengembalikan usulan yang sama.
 */
export async function usulkanTopi(_: HasilKerja, form: FormData): Promise<HasilKerja> {
  await wajibPerusahaan();
  const orang = teks(form, "orang");
  const topi = teks(form, "topi");
  const kunci = teks(form, "kunci");
  if (!ID_SAH.test(orang) || !ID_SAH.test(topi) || (kunci && !ID_SAH.test(kunci))) return { galat: "Pilihan tidak dikenal. Muat ulang halaman ini." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("usulkan_pasang_topi", { p_orang: orang, p_topi: topi, p_kunci: kunci || null });
  if (error) {
    if (error.code === "42501" || error.code === "22023") return { galat: error.message };
    return { galat: "Nadi gagal menyimpan usulan. Coba lagi sebentar." };
  }
  // Tanpa revalidatePath: penyegaran halaman yang sedang dilihat akan mengganti tombol dengan teks "sudah menunggu" sebelum pesan
  // hasil terbaca (role=status). Feed dan peta dirender per permintaan (staleTimes.dynamic bawaan 0), jadi kunjungan berikutnya
  // sudah memuat usulan ini.
  const r = data as { id: string; sudah: boolean };
  return { id: r.id, pesan: r.sudah ? "Usulan ini sudah ada di Feed pemilik." : "Terkirim ke Feed pemilik. Topi dipasang setelah pemilik menyetujui." };
}
