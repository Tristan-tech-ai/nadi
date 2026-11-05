"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { HasilForm } from "@/lib/auth-pesan";
import { ambilKamus, isiTeks, type Kamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { cocokkanUsaha } from "@/lib/paket/cocok";
import { hasilUlangPutusan } from "@/lib/putusan";
import { createClient } from "@/lib/supabase/server";

const INDUSTRI = new Set(["fnb", "toko", "kantor", "bengkel", "klinik", "konstruksi", "logistik", "hotel", "salon", "laundry", "produksi", "pertanian", "pendidikan", "lainnya"]);

/** Buat perusahaan lewat RPC (menulis klaim pid/prn ke app_metadata), lalu segarkan sesi agar JWT membawa klaim baru. */
export async function buatPerusahaan(_: HasilForm, form: FormData): Promise<HasilForm> {
  const k = ambilKamus(await bahasaAplikasi()).mulaiPesan;
  const nama = String(form.get("nama") ?? "").trim();
  const pilihan = String(form.get("industri") ?? "");
  const cerita = String(form.get("cerita") ?? "").trim();
  const konteks = {
    skala: String(form.get("skala") ?? "") || null, cabang: Number(form.get("cabang") ?? 1) || 1,
    kota: String(form.get("kota") ?? "").trim(), negara: String(form.get("negara") ?? "ID") || "ID", zona: String(form.get("zona") ?? "") || null,
  };
  const isianKembali = { nama, industri: pilihan, cerita, skala: konteks.skala ?? "", cabang: String(konteks.cabang), kota: konteks.kota, negara: konteks.negara, zona: konteks.zona ?? "" };
  if (nama.length < 2) return { galat: k.namaPendek, isian: isianKembali };
  if (!INDUSTRI.has(pilihan)) return { galat: k.pilihJenis, isian: isianKembali };
  if (pilihan === "lainnya" && cerita.length < 10) return { galat: k.ceritaPendek, isian: isianKembali };
  // W-06: "Lainnya" dipetakan aturan (tanpa model) ke paket terdekat; topi baru menjadi usulan di Feed.
  const cocok = pilihan === "lainnya" ? cocokkanUsaha(cerita) : null;
  const industri = cocok ? cocok.paket : pilihan;
  const supabase = await createClient();
  const { error } = await supabase.rpc("buat_perusahaan", { p_nama: nama, p_industri: industri });
  if (error) return { galat: error.code === "54000" ? k.batas : k.gagal, isian: isianKembali };
  await supabase.auth.refreshSession();
  // Topi bawaan jenis usaha (paket industri); butuh klaim pid baru, jadi setelah refreshSession.
  await supabase.rpc("pasang_paket", { p_kode: industri });
  if (cocok) await supabase.rpc("usul_topi_baru", { p_cerita: cerita, p_paket: cocok.paket, p_yakin: cocok.yakin, p_topi: cocok.topi });
  // W-03: skala, cabang, kota, negara; mata uang dan zona waktu bawaan dari negara (zona bisa dipilih untuk Indonesia).
  await supabase.rpc("atur_konteks_usaha", { p_skala: konteks.skala, p_cabang: konteks.cabang, p_kota: konteks.kota || null, p_negara: konteks.negara,
    p_zona: konteks.negara === "ID" ? konteks.zona : null });
  redirect("/app");
}

export async function tambahOrang(_: HasilForm, form: FormData): Promise<HasilForm> {
  const nama = String(form.get("nama") ?? "").trim();
  const t = ambilKamus(await bahasaAplikasi()).orangPesan;
  if (nama.length < 2) return { galat: t.namaPendek };
  const supabase = await createClient();
  const { data: sesi } = await supabase.auth.getClaims();
  const pid = (sesi?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  const { error } = await supabase.from("orang").insert({ perusahaan_id: pid, nama });
  if (error) return { galat: t.gagalTambah };
  revalidatePath("/app/orang");
  return {};
}

export async function buatAkunStaf(_: HasilForm, form: FormData): Promise<HasilForm> {
  const orang = String(form.get("orang") ?? "");
  const pin = String(form.get("pin") ?? "");
  const t = ambilKamus(await bahasaAplikasi()).orangPesan;
  if (!/^\d{6}$/.test(pin)) return { galat: t.pin };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("buat_akun_staf", { p_orang: orang, p_pin: pin });
  if (error) return { galat: error.code === "42501" ? t.hanyaPengelola : t.gagalAkun };
  const r = data as { kode: string; id_staf: string };
  revalidatePath("/app/orang");
  return { info: isiTeks(t.akunSiap, { kode: r.kode, id: r.id_staf }) };
}

export async function pindahPerusahaan(form: FormData) {
  const id = String(form.get("perusahaan") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("pindah_perusahaan", { p_perusahaan: id });
  if (!error) await supabase.auth.refreshSession();
  // Tujuan setelah pindah hanya dari daftar putih (bukan URL bebas dari formulir).
  const ke = form.get("ke") === "/app/akuntan" ? "/app/akuntan" : "/app";
  redirect(error ? "/app/perusahaan?galat=1" : ke);
}

export type HasilPutusan = { galat?: string; pesan?: string; status?: "diterima" | "ditolak" };

type TeksPutusan = Kamus["putusan"];
const PESAN_AKSI: Record<string, (t: TeksPutusan, n: number, lewat: number) => string> = {
  "orang.buat": (t) => t.orangBuat,
  "orang.impor": (t, n, lewat) => (lewat ? isiTeks(t.orangImporLewat, { n, lewat }) : isiTeks(t.orangImpor, { n })),
  "rekrut.pelamar": (t) => t.pelamar,
  "absen.impor": (t, n) => isiTeks(t.absenImpor, { n }),
  "uang.mutasi": (t, n) => isiTeks(t.mutasi, { n }),
};

export type HasilTutupInfo = { ok?: boolean; galat?: string };

/** F3-07B: pemilik menutup kartu info (Beban dan kabar tim) lewat RPC tandai_ditangani; tercatat siapa dan kapan. */
export async function tutupKartuInfo(_: HasilTutupInfo, form: FormData): Promise<HasilTutupInfo> {
  const supabase = await createClient();
  const [{ error }, bahasa] = await Promise.all([supabase.rpc("tandai_ditangani", { p_usulan: String(form.get("usulan") ?? "") }), bahasaAplikasi()]);
  const t = ambilKamus(bahasa).kartuInfo;
  if (error) return { galat: error.code === "42501" ? t.hanyaPemilik : t.gagal };
  return { ok: true };
}

/** Setujui atau tolak satu usulan Feed lewat RPC putuskan_usulan (pemeriksaan peran ada di database). */
export async function putuskan(_: HasilPutusan, form: FormData): Promise<HasilPutusan> {
  const id = String(form.get("usulan") ?? "");
  const setuju = form.get("keputusan") === "setuju";
  const supabase = await createClient();
  const [{ data, error }, bahasa] = await Promise.all([supabase.rpc("putuskan_usulan", { p_usulan: id, p_setuju: setuju }), bahasaAplikasi()]);
  const t = ambilKamus(bahasa).putusan;
  if (error) return { galat: error.code === "42501" ? t.hanyaPengelola : t.gagal };
  // Kiriman ulang (Q-16): usulan sudah diputuskan; tampilkan keputusan yang tersimpan, bukan tombol yang baru diklik.
  if (data.sudah) return hasilUlangPutusan(String(data.status), t);
  // Tanpa revalidatePath: kartu tetap tampil dengan cap hasilnya sampai Feed dimuat ulang, supaya keputusan terlihat.
  if (!setuju) return { status: "ditolak", pesan: t.ditolak };
  if (data.aksi === "dokumen.surat") {
    // Agenda didaftarkan trigger agenda_dari_usulan di transaksi yang sama (F4-03).
    const { data: ag } = await supabase.from("agenda_surat").select("nomor_agenda").eq("usulan_id", id).maybeSingle();
    return { status: "diterima", pesan: ag ? isiTeks(t.agenda, { nomor: ag.nomor_agenda }) : t.agendaSama };
  }
  const buat = PESAN_AKSI[data.aksi as string];
  return { status: "diterima", pesan: buat ? buat(t, data.dibuat, data.dilewati) : t.umum };
}
