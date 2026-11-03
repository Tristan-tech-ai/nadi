"use server";

import { revalidatePath } from "next/cache";
import { hariIni } from "@/lib/izin";
import { bacaRupiahBulat, formatLamaMenit, menitSah, rapikanMinggu, statusRencanaSah, type Peringatan } from "@/lib/rekrut/magang";
import { ambilKamus, isiTeks, type Kamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { zonaUsaha } from "@/lib/zona-usaha";

export type HasilMagang = { pesan: string } | { galat: string } | null;

const ID_SAH = /^[0-9a-f-]{36}$/i;
const TANGGAL_SAH = /^\d{4}-\d{2}-\d{2}$/;
const teks = (form: FormData, nama: string) => String(form.get(nama) ?? "").trim();

/** Pesan magang dalam bahasa pengguna; pesan database (bahasa Indonesia) dibungkus di bahasa lain. */
async function teksMagang() {
  const bahasa = await bahasaAplikasi();
  const kamus = ambilKamus(bahasa);
  const t: Kamus["magangPesan"] = kamus.magangPesan;
  const db = (pesan: string) => (bahasa === "id" ? pesan : isiTeks(t.galatDb, { pesan }));
  return { t, bahasa, db, kamus };
}

function galatDb(e: { code?: string; message: string }, peran: "pemilikAdmin" | "pemilik" | "mentorPengelola", k: Awaited<ReturnType<typeof teksMagang>>): string {
  if (e.code === "42501") return isiTeks(k.t.hanya, { peran: k.t[peran] });
  if (e.code === "22023" || e.code === "P0002") return k.db(e.message);
  return k.t.gagal;
}

/** Buat rencana magang tertulis (pemilik/admin). Peringatan lunak dari database ikut disebut di pesan. */
export async function simpanRencana(_: HasilMagang, form: FormData): Promise<HasilMagang> {
  const k = await teksMagang();
  await wajibPerusahaan();
  const peserta = teks(form, "peserta");
  const mentor = teks(form, "mentor");
  const topi = teks(form, "topi");
  const mulai = teks(form, "mulai");
  const selesai = teks(form, "selesai");
  const tujuan = teks(form, "tujuan");
  const kunci = teks(form, "kunci");
  if (kunci && !ID_SAH.test(kunci)) return { galat: k.t.isianTak };
  if (!ID_SAH.test(peserta)) return { galat: k.t.pilihPeserta };
  if (!ID_SAH.test(mentor)) return { galat: k.t.pilihMentor };
  if (peserta === mentor) return { galat: k.t.beda };
  if (topi && !ID_SAH.test(topi)) return { galat: k.t.topiTak };
  if (!TANGGAL_SAH.test(mulai) || !TANGGAL_SAH.test(selesai)) return { galat: k.t.isiTanggal };
  if (selesai < mulai) return { galat: k.t.selesaiSebelum };
  if (tujuan.length < 3) return { galat: k.t.tujuan };

  const saku: Record<string, number> = {};
  for (const kunci of ["transport", "makan", "insentif"] as const) {
    const r = bacaRupiahBulat(teks(form, `saku_${kunci}`));
    if ("galat" in r) return { galat: isiTeks(k.t.saku, { label: k.kamus.magangForm[kunci] }) };
    if (r.nilai !== null) saku[kunci] = r.nilai;
  }
  const no = form.getAll("minggu_no").map(String);
  const keahlian = form.getAll("minggu_keahlian").map(String);
  const target = form.getAll("minggu_target").map(String);
  const minggu = rapikanMinggu(no.map((m, i) => ({ minggu: m, keahlian: keahlian[i] ?? "", target: target[i] ?? "" })));
  if ("galat" in minggu) return { galat: k.db(minggu.galat) };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("simpan_rencana_magang", {
    p_id: null, p_orang: peserta, p_mentor: mentor, p_topi: topi || null, p_mulai: mulai, p_selesai: selesai,
    p_uang_saku: saku, p_tujuan: tujuan, p_minggu: minggu.baris, p_uji_akhir: teks(form, "uji_akhir") || null,
    p_kunci: kunci || null,
  });
  if (error) return { galat: galatDb(error, "pemilikAdmin", k) };
  revalidatePath("/app/magang");
  const n = ((data as { peringatan: Peringatan[] }).peringatan ?? []).length;
  return { pesan: `${k.t.tersimpan}${n ? isiTeks(k.t.adaPeringatan, { n }) : ""}` };
}

/** Ubah status rencana (dan nilai uji akhir saat selesai). Isian lain disalin dari rencana yang tersimpan. */
export async function ubahStatusRencana(_: HasilMagang, form: FormData): Promise<HasilMagang> {
  const k = await teksMagang();
  await wajibPerusahaan();
  const id = teks(form, "rencana");
  const status = teks(form, "status");
  const nilaiTeks = teks(form, "nilai");
  if (!ID_SAH.test(id) || !statusRencanaSah(status)) return { galat: k.t.pilihanTak };
  const nilai = nilaiTeks ? Number(nilaiTeks) : null;
  if (nilai !== null && !(Number.isInteger(nilai) && nilai >= 0 && nilai <= 100)) return { galat: k.t.nilai };
  const supabase = await createClient();
  const { data: r } = await supabase.from("rencana_magang").select("orang_id, mentor_id, topi_id, mulai, selesai, uang_saku, tujuan, minggu, uji_akhir").eq("id", id).maybeSingle();
  if (!r) return { galat: k.t.tidakDitemukan };
  const { error } = await supabase.rpc("simpan_rencana_magang", {
    p_id: id, p_orang: r.orang_id, p_mentor: r.mentor_id, p_topi: r.topi_id, p_mulai: r.mulai, p_selesai: r.selesai,
    p_uang_saku: r.uang_saku, p_tujuan: r.tujuan, p_minggu: r.minggu, p_uji_akhir: r.uji_akhir, p_status: status, p_nilai_akhir: nilai,
  });
  if (error) return { galat: galatDb(error, "pemilikAdmin", k) };
  revalidatePath("/app/magang");
  return { pesan: isiTeks(k.t.statusJadi, { status: k.kamus.magang.status[status].toLowerCase() }) };
}

/** Catat satu sesi bimbingan (mentor rencana itu, pemilik, atau admin). Tarif usaha disalin database ke baris ini. */
export async function catatSesi(_: HasilMagang, form: FormData): Promise<HasilMagang> {
  const k = await teksMagang();
  const sesi = await wajibPerusahaan();
  const rencana = teks(form, "rencana");
  const tanggal = teks(form, "tanggal");
  const menit = Number(teks(form, "menit"));
  const catatan = teks(form, "catatan");
  if (!ID_SAH.test(rencana)) return { galat: k.t.rencanaTak };
  if (!TANGGAL_SAH.test(tanggal)) return { galat: k.t.isiTanggalSesi };
  if (tanggal > hariIni(new Date(), await zonaUsaha(await createClient(), sesi.perusahaanId))) return { galat: k.t.masaDepan };
  if (!menitSah(menit)) return { galat: k.t.menit };
  if (catatan.length > 300) return { galat: isiTeks(k.t.catatanPanjang, { n: catatan.length }) };
  const supabase = await createClient();
  const { error } = await supabase.rpc("catat_jam_rekrut", { p_jenis: "mentor", p_rencana: rencana, p_lamaran: null, p_tanggal: tanggal, p_menit: menit, p_catatan: catatan || null });
  if (error) return { galat: galatDb(error, "mentorPengelola", k) };
  revalidatePath("/app/magang");
  return { pesan: isiTeks(k.t.sesiTercatat, { lama: formatLamaMenit(menit, k.bahasa) }) };
}

/** Tarif per jam waktu rekrutmen dan anggaran bulanan (khusus pemilik). Kosong menghapus isian. */
export async function aturDana(_: HasilMagang, form: FormData): Promise<HasilMagang> {
  const k = await teksMagang();
  await wajibPerusahaan();
  const tarif = bacaRupiahBulat(teks(form, "tarif"));
  const anggaran = bacaRupiahBulat(teks(form, "anggaran"));
  if ("galat" in tarif) return { galat: k.t.tarif };
  if ("galat" in anggaran) return { galat: k.t.anggaran };
  const supabase = await createClient();
  const { error } = await supabase.rpc("atur_dana_rekrut", { p_tarif_jam: tarif.nilai, p_anggaran_bulanan: anggaran.nilai });
  if (error) return { galat: galatDb(error, "pemilik", k) };
  revalidatePath("/app/magang");
  return { pesan: k.t.danaTersimpan };
}
