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

/**
 * X-10 tim kerja: daftar pelaksana dengan porsi (jumlah 100) dan satu PIC. Isian: orang_<i>, porsi_<i>, pic (orang_id).
 * Database (atur_pelaksana_kerja) memeriksa ulang semuanya; di sini hanya disusun dan dihitung jumlahnya untuk pesan cepat.
 */
export async function aturTim(_: HasilKerja, form: FormData): Promise<HasilKerja> {
  const k = await teksKerja();
  const kerja = teks(form, "kerja");
  if (!ID_SAH.test(kerja)) return { galat: k.t.gagal };
  const pic = teks(form, "pic");
  const daftar: { orang_id: string; porsi: number; pic: boolean }[] = [];
  for (let i = 0; i < 10; i++) {
    const orang = teks(form, `orang_${i}`);
    if (!orang) continue;
    if (!ID_SAH.test(orang)) return { galat: k.t.gagal };
    const porsi = Number(teks(form, `porsi_${i}`));
    daftar.push({ orang_id: orang, porsi: Number.isFinite(porsi) ? porsi : 0, pic: orang === pic });
  }
  const jumlah = daftar.reduce((a, x) => a + x.porsi, 0);
  if (!daftar.length) return { galat: k.bahasa === "en" ? "Pick at least one person." : "Pilih minimal satu orang." };
  if (jumlah !== 100) return { galat: k.bahasa === "en" ? `Shares must add up to 100% (now ${jumlah}%).` : `Jumlah porsi harus 100% (sekarang ${jumlah}%).` };
  if (!daftar.some((x) => x.pic)) return { galat: k.bahasa === "en" ? "Choose one person in charge (PIC)." : "Pilih satu PIC." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("atur_pelaksana_kerja", { p_kerja: kerja, p_daftar: daftar });
  if (error) return { galat: galatDb(error, "pemilikAdmin", k) };
  revalidatePath("/app/kerja");
  return { pesan: k.bahasa === "en" ? "Team saved." : "Tim tersimpan.", id: kerja };
}

/** Checklist kerja: tambah butir atau centang/lepas centang (pengelola atau pelaksana kerja itu; database yang memutuskan). */
export async function aturButir(_: HasilKerja, form: FormData): Promise<HasilKerja> {
  const k = await teksKerja();
  const supabase = await createClient();
  const aksi = teks(form, "aksi");
  const { error } = aksi === "tambah"
    ? await supabase.rpc("tambah_butir_kerja", { p_kerja: teks(form, "kerja"), p_judul: teks(form, "judul") })
    : aksi === "centang" && ID_SAH.test(teks(form, "butir"))
      ? await supabase.rpc("centang_butir_kerja", { p_butir: teks(form, "butir"), p_selesai: teks(form, "selesai") === "ya" })
      : { error: { code: "22023", message: k.t.gagal } };
  if (error) return { galat: error.code === "P0429" ? error.message : galatDb(error, "pemilikAdmin", k) };
  revalidatePath("/app/kerja");
  return { pesan: aksi === "tambah" ? (k.bahasa === "en" ? "Item added." : "Butir ditambah.") : (k.bahasa === "en" ? "Saved." : "Tersimpan.") };
}

/** X-11: pelaksana mengirim hasil (tautan https dan/atau catatan); kerja masuk review dan menjadi kartu Feed. */
export async function kirimHasil(_: HasilKerja, form: FormData): Promise<HasilKerja> {
  const k = await teksKerja();
  const supabase = await createClient();
  const { error } = await supabase.rpc("kirim_hasil_kerja", { p_kerja: teks(form, "kerja"), p_tautan: teks(form, "tautan") || null, p_catatan: teks(form, "catatan") || null });
  if (error) return { galat: galatDb(error, "pemilikAdmin", k) };
  revalidatePath("/app/kerja");
  return { pesan: k.bahasa === "en" ? "Result sent for review." : "Hasil terkirim untuk direview." };
}

/** X-11: ajukan geser tenggat (baseline tetap); jadi kartu Feed untuk pemilik/admin. */
export async function ajukanGeserTenggat(_: HasilKerja, form: FormData): Promise<HasilKerja> {
  const k = await teksKerja();
  const sesi = await wajibPerusahaan();
  const supabase = await createClient();
  const iso = waktuLokalKeIso(teks(form, "tenggat"), await zonaUsaha(supabase, sesi.perusahaanId));
  if (!iso) return { galat: k.bahasa === "en" ? "Pick a valid new deadline." : "Pilih tenggat baru yang sah." };
  const { error } = await supabase.rpc("ajukan_geser_tenggat", { p_kerja: teks(form, "kerja"), p_tenggat: iso, p_alasan: teks(form, "alasan") });
  if (error) return { galat: galatDb(error, "pemilikAdmin", k) };
  revalidatePath("/app/kerja");
  return { pesan: k.bahasa === "en" ? "Request sent to the owner." : "Pengajuan terkirim ke pemilik." };
}

/** X-11: minta revisi dari kartu Feed, wajib beralasan. */
export async function mintaRevisi(_: HasilKerja, form: FormData): Promise<HasilKerja> {
  const k = await teksKerja();
  const supabase = await createClient();
  const { error } = await supabase.rpc("minta_revisi_kerja", { p_usulan: teks(form, "usulan"), p_alasan: teks(form, "alasan") });
  if (error) return { galat: galatDb(error, "pemilikAdmin", k) };
  revalidatePath("/app");
  revalidatePath("/app/kerja");
  return { pesan: k.bahasa === "en" ? "Revision requested." : "Revisi diminta." };
}

// X-13 kepala divisi atau pemegang izin kerja.kelola menerima hasil kerja (Feed tetap untuk pemilik/admin).
export async function terimaHasil(_: HasilKerja, form: FormData): Promise<HasilKerja> {
  const k = await teksKerja();
  const usulan = teks(form, "usulan");
  if (!ID_SAH.test(usulan)) return { galat: k.t.gagal };
  const supabase = await createClient();
  const { error } = await supabase.rpc("terima_hasil_kerja", { p_usulan: usulan });
  if (error) return { galat: galatDb(error, "pemilikAdmin", k) };
  revalidatePath("/app");
  revalidatePath("/app/kerja");
  return { pesan: k.bahasa === "en" ? "Result accepted. The work is done." : "Hasil diterima. Kerja selesai." };
}
