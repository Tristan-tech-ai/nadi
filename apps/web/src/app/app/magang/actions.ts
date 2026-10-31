"use server";

import { revalidatePath } from "next/cache";
import { hariIni } from "@/lib/izin";
import { bacaRupiahBulat, formatLamaMenit, menitSah, rapikanMinggu, statusRencanaSah, STATUS_RENCANA, type Peringatan } from "@/lib/rekrut/magang";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";

export type HasilMagang = { pesan: string } | { galat: string } | null;

const ID_SAH = /^[0-9a-f-]{36}$/i;
const TANGGAL_SAH = /^\d{4}-\d{2}-\d{2}$/;
const teks = (form: FormData, nama: string) => String(form.get(nama) ?? "").trim();

function galatDb(e: { code?: string; message: string }, peran: string): string {
  if (e.code === "42501") return `Hanya ${peran} yang bisa melakukannya.`;
  if (e.code === "22023" || e.code === "P0002") return e.message;
  return "Nadi gagal menyimpan. Coba lagi sebentar; isianmu tidak hilang.";
}

/** Buat rencana magang tertulis (pemilik/admin). Peringatan lunak dari database ikut disebut di pesan. */
export async function simpanRencana(_: HasilMagang, form: FormData): Promise<HasilMagang> {
  await wajibPerusahaan();
  const peserta = teks(form, "peserta");
  const mentor = teks(form, "mentor");
  const topi = teks(form, "topi");
  const mulai = teks(form, "mulai");
  const selesai = teks(form, "selesai");
  const tujuan = teks(form, "tujuan");
  if (!ID_SAH.test(peserta)) return { galat: "Pilih peserta magang." };
  if (!ID_SAH.test(mentor)) return { galat: "Pilih mentor." };
  if (peserta === mentor) return { galat: "Mentor dan peserta harus orang yang berbeda." };
  if (topi && !ID_SAH.test(topi)) return { galat: "Topi tujuan tidak dikenal. Muat ulang halaman ini." };
  if (!TANGGAL_SAH.test(mulai) || !TANGGAL_SAH.test(selesai)) return { galat: "Isi tanggal mulai dan selesai." };
  if (selesai < mulai) return { galat: "Tanggal selesai tidak boleh sebelum tanggal mulai." };
  if (tujuan.length < 3) return { galat: "Tulis tujuan magang, misalnya: bisa menyiapkan espresso sendiri." };

  const saku: Record<string, number> = {};
  for (const [kunci, label] of [["transport", "Transport"], ["makan", "Makan"], ["insentif", "Insentif"]] as const) {
    const r = bacaRupiahBulat(teks(form, `saku_${kunci}`));
    if ("galat" in r) return { galat: `${label}: tulis rupiah bulat, misalnya 300.000.` };
    if (r.nilai !== null) saku[kunci] = r.nilai;
  }
  const no = form.getAll("minggu_no").map(String);
  const keahlian = form.getAll("minggu_keahlian").map(String);
  const target = form.getAll("minggu_target").map(String);
  const minggu = rapikanMinggu(no.map((m, i) => ({ minggu: m, keahlian: keahlian[i] ?? "", target: target[i] ?? "" })));
  if ("galat" in minggu) return { galat: minggu.galat };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("simpan_rencana_magang", {
    p_id: null, p_orang: peserta, p_mentor: mentor, p_topi: topi || null, p_mulai: mulai, p_selesai: selesai,
    p_uang_saku: saku, p_tujuan: tujuan, p_minggu: minggu.baris, p_uji_akhir: teks(form, "uji_akhir") || null,
  });
  if (error) return { galat: galatDb(error, "pemilik atau admin") };
  revalidatePath("/app/magang");
  const n = ((data as { peringatan: Peringatan[] }).peringatan ?? []).length;
  return { pesan: `Rencana magang tersimpan.${n ? ` Ada ${n} peringatan; lihat di daftar rencana.` : ""}` };
}

/** Ubah status rencana (dan nilai uji akhir saat selesai). Isian lain disalin dari rencana yang tersimpan. */
export async function ubahStatusRencana(_: HasilMagang, form: FormData): Promise<HasilMagang> {
  await wajibPerusahaan();
  const id = teks(form, "rencana");
  const status = teks(form, "status");
  const nilaiTeks = teks(form, "nilai");
  if (!ID_SAH.test(id) || !statusRencanaSah(status)) return { galat: "Pilihan tidak dikenal. Muat ulang halaman ini." };
  const nilai = nilaiTeks ? Number(nilaiTeks) : null;
  if (nilai !== null && !(Number.isInteger(nilai) && nilai >= 0 && nilai <= 100)) return { galat: "Nilai uji akhir 0 sampai 100." };
  const supabase = await createClient();
  const { data: r } = await supabase.from("rencana_magang").select("orang_id, mentor_id, topi_id, mulai, selesai, uang_saku, tujuan, minggu, uji_akhir").eq("id", id).maybeSingle();
  if (!r) return { galat: "Rencana tidak ditemukan di usahamu." };
  const { error } = await supabase.rpc("simpan_rencana_magang", {
    p_id: id, p_orang: r.orang_id, p_mentor: r.mentor_id, p_topi: r.topi_id, p_mulai: r.mulai, p_selesai: r.selesai,
    p_uang_saku: r.uang_saku, p_tujuan: r.tujuan, p_minggu: r.minggu, p_uji_akhir: r.uji_akhir, p_status: status, p_nilai_akhir: nilai,
  });
  if (error) return { galat: galatDb(error, "pemilik atau admin") };
  revalidatePath("/app/magang");
  return { pesan: `Status: ${STATUS_RENCANA[status].toLowerCase()}.` };
}

/** Catat satu sesi bimbingan (mentor rencana itu, pemilik, atau admin). Tarif usaha disalin database ke baris ini. */
export async function catatSesi(_: HasilMagang, form: FormData): Promise<HasilMagang> {
  await wajibPerusahaan();
  const rencana = teks(form, "rencana");
  const tanggal = teks(form, "tanggal");
  const menit = Number(teks(form, "menit"));
  const catatan = teks(form, "catatan");
  if (!ID_SAH.test(rencana)) return { galat: "Rencana tidak dikenal. Muat ulang halaman ini." };
  if (!TANGGAL_SAH.test(tanggal)) return { galat: "Isi tanggal sesi." };
  if (tanggal > hariIni()) return { galat: "Tanggal sesi tidak boleh di masa depan." };
  if (!menitSah(menit)) return { galat: "Isi lama bimbingan 1 sampai 600 menit." };
  if (catatan.length > 300) return { galat: `Catatan ${catatan.length} huruf. Pendekkan jadi paling banyak 300 huruf.` };
  const supabase = await createClient();
  const { error } = await supabase.rpc("catat_jam_rekrut", { p_jenis: "mentor", p_rencana: rencana, p_lamaran: null, p_tanggal: tanggal, p_menit: menit, p_catatan: catatan || null });
  if (error) return { galat: galatDb(error, "mentor rencana ini, pemilik, atau admin") };
  revalidatePath("/app/magang");
  return { pesan: `Sesi ${formatLamaMenit(menit)} tercatat.` };
}

/** Tarif per jam waktu rekrutmen dan anggaran bulanan (khusus pemilik). Kosong menghapus isian. */
export async function aturDana(_: HasilMagang, form: FormData): Promise<HasilMagang> {
  await wajibPerusahaan();
  const tarif = bacaRupiahBulat(teks(form, "tarif"));
  const anggaran = bacaRupiahBulat(teks(form, "anggaran"));
  if ("galat" in tarif) return { galat: "Tarif per jam: tulis rupiah bulat, misalnya 30.000." };
  if ("galat" in anggaran) return { galat: "Anggaran bulanan: tulis rupiah bulat, misalnya 500.000." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("atur_dana_rekrut", { p_tarif_jam: tarif.nilai, p_anggaran_bulanan: anggaran.nilai });
  if (error) return { galat: galatDb(error, "pemilik") };
  revalidatePath("/app/magang");
  return { pesan: "Dana Rekrutmen tersimpan. Tarif baru dipakai untuk waktu yang dicatat mulai sekarang." };
}
