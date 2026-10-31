"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { JenisHariLembur } from "@/lib/gaji/bpjs-lembur";
import { ringkasKomponen, susunSlip, type DataGaji, type Komponen, type LemburHari, type PetaAturan } from "@/lib/gaji/susun";
import { JENIS_LEMBUR } from "@/lib/gaji/lembur";
import { asalTautan } from "@/lib/mcp/http";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";

/** isian: nilai formulir yang dikembalikan saat galat, karena React mengosongkan formulir setelah action. */
export type HasilGaji = { pesan: string } | { galat: string; isian?: Record<string, string> } | null;

const bulanSah = (x: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(x);

/** Siapkan (atau hitung ulang) draf gaji satu bulan untuk semua karyawan aktif bergaji. */
export async function siapkanGaji(_: HasilGaji, form: FormData): Promise<HasilGaji> {
  const bulan = String(form.get("bulan") ?? "");
  if (!bulanSah(bulan)) return { galat: "Pilih bulan gaji." };
  const [tahun, bln] = bulan.split("-").map(Number);
  const awal = `${bulan}-01`;
  const akhir = new Date(Date.UTC(tahun, bln, 0)).toISOString().slice(0, 10);
  const supabase = await createClient();

  const { data: per, error: e1 } = await supabase.rpc("mulai_periode_gaji", { p_bulan: awal });
  if (e1 || !per) return { galat: e1?.code === "42501" ? "Hanya pemilik atau admin yang bisa menyiapkan gaji." : "Periode gaji gagal dibuka. Coba lagi sebentar." };

  const { data: baris } = await supabase.from("aturan_bertanggal").select("kunci, nilai, terverifikasi, berlaku_dari").lte("berlaku_dari", akhir).order("berlaku_dari", { ascending: false });
  const aturan: PetaAturan = {};
  for (const a of baris ?? []) if (!aturan[a.kunci]) aturan[a.kunci] = { nilai: a.nilai, terverifikasi: a.terverifikasi };

  const { data: orang } = await supabase.from("orang").select("id, nama, orang_rahasia(gaji)").eq("status", "aktif").overlaps("jenis", ["karyawan", "magang"]);
  const digaji = (orang ?? []).flatMap((o) => {
    const r = Array.isArray(o.orang_rahasia) ? o.orang_rahasia[0] : o.orang_rahasia;
    const g = (r?.gaji ?? {}) as DataGaji;
    return Number(g.pokok) > 0 ? [{ id: o.id as string, g: { ...g, pokok: Number(g.pokok), tunjangan_tetap: Number(g.tunjangan_tetap ?? 0) } }] : [];
  });
  if (!digaji.length) return { galat: "Belum ada karyawan dengan gaji pokok. Isi gaji di halaman Orang dulu." };

  // Riwayat Januari s.d. bulan sebelumnya (untuk masa Desember).
  const riwayat = new Map<string, { brutoPph: number; pphDipotong: number; iuranPegawai: number; bulan: number }>();
  if (bln === 12) {
    const { data: lalu } = await supabase.from("slip_gaji").select("orang_id, komponen, periode_gaji!inner(bulan, status)").gte("periode_gaji.bulan", `${tahun}-01-01`).lt("periode_gaji.bulan", awal).eq("periode_gaji.status", "disetujui");
    for (const s of lalu ?? []) {
      const r = ringkasKomponen(s.komponen as Komponen[]);
      const x = riwayat.get(s.orang_id) ?? { brutoPph: 0, pphDipotong: 0, iuranPegawai: 0, bulan: 0 };
      riwayat.set(s.orang_id, { brutoPph: x.brutoPph + r.brutoPph, pphDipotong: x.pphDipotong + r.pph, iuranPegawai: x.iuranPegawai + r.iuranPegawai, bulan: x.bulan + 1 });
    }
  }

  // Lembur bulan ini per orang (tabel lembur; jam 0 = dibatalkan).
  const { data: lem } = await supabase.from("lembur").select("orang_id, tanggal, jenis, jam").gte("tanggal", awal).lte("tanggal", akhir).gt("jam", 0);
  const lemburDari = new Map<string, LemburHari[]>();
  for (const l of lem ?? []) lemburDari.set(l.orang_id, [...(lemburDari.get(l.orang_id) ?? []), { tanggal: l.tanggal, jenis: l.jenis as JenisHariLembur, jam: l.jam }]);

  // Insentif beban kerja dari kolam yang disetujui untuk bulan ini (F3-05; RLS kolam_bagian: pemilik/admin).
  const { data: kb } = await supabase.from("kolam_bagian").select("orang_id, rupiah, kolam_bonus!inner(bulan, status)").eq("kolam_bonus.bulan", awal).eq("kolam_bonus.status", "disetujui");
  const insentifDari = new Map<string, number>((kb ?? []).map((b) => [b.orang_id as string, Number(b.rupiah)]));

  let ditahan = 0;
  for (const o of digaji) {
    const rw = riwayat.get(o.id);
    const { komponen, peringatan } = susunSlip(o.g, aturan, bln, rw && rw.bulan === 11 ? rw : undefined, lemburDari.get(o.id), insentifDari.get(o.id) ?? 0);
    const { data, error } = await supabase.rpc("simpan_slip", { p_periode: per, p_orang: o.id, p_komponen: komponen, p_peringatan: peringatan });
    if (error) return { galat: error.code === "55000" ? error.message : "Sebagian slip gagal disimpan. Coba siapkan ulang; slip yang sudah tersimpan tidak hilang." };
    if ((data as { ditahan: boolean }).ditahan) ditahan++;
  }
  revalidatePath("/app/gaji");
  const tanpaSlip = [...insentifDari.keys()].filter((id) => !digaji.some((o) => o.id === id)).length;
  return {
    pesan: `Draf gaji siap untuk ${digaji.length} orang.${ditahan ? ` ${ditahan} ditahan Gerbang Gaji; periksa alasannya.` : ""}${
      tanpaSlip ? ` ${tanpaSlip} orang punya insentif beban kerja bulan ini tetapi gaji pokoknya belum diisi, jadi slipnya belum dibuat.` : ""}`,
  };
}

export async function setujuiGaji(_: HasilGaji, form: FormData): Promise<HasilGaji> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("setujui_periode_gaji", { p_periode: String(form.get("periode") ?? "") });
  if (error) return { galat: error.code === "42501" ? "Hanya pemilik atau admin yang bisa menyetujui gaji." : error.message };
  const d = data as { slip: number; ditahan: number };
  revalidatePath("/app/gaji");
  return { pesan: `Gaji disetujui untuk ${d.slip - d.ditahan} orang.${d.ditahan ? ` ${d.ditahan} masih ditahan sampai kamu lepaskan.` : ""}` };
}

export async function lepasTahan(_: HasilGaji, form: FormData): Promise<HasilGaji> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("lepas_tahan_slip", { p_slip: String(form.get("slip") ?? ""), p_alasan: String(form.get("alasan") ?? "") });
  if (error) return { galat: error.message };
  revalidatePath("/app/gaji");
  return { pesan: "Dilepas. Alasanmu tercatat di slip." };
}

export type HasilTautanSlip = { tautan: string; nama: string } | { galat: string } | null;

/** Tautan slip 30 hari untuk dibagikan (token di fragmen URL agar tidak masuk log server). */
export async function bagikanSlip(_: HasilTautanSlip, form: FormData): Promise<HasilTautanSlip> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("buat_tautan_slip", { p_slip: String(form.get("slip") ?? "") });
  if (error || !data) return { galat: error?.message ?? "Tautan slip gagal dibuat." };
  return { tautan: `${asalTautan(await headers())}/slip#${data as string}`, nama: String(form.get("nama") ?? "") };
}

const PTKP = ["TK/0", "TK/1", "TK/2", "TK/3", "K/0", "K/1", "K/2", "K/3"];
const RISIKO = ["sangat_rendah", "rendah", "sedang", "tinggi", "sangat_tinggi"];
const rupiahIsian = (x: FormDataEntryValue | null) => {
  const t = String(x ?? "").replace(/[^\d]/g, "");
  return t === "" ? 0 : Number(t);
};

/** Gaji pokok, tunjangan tetap, status PTKP, dan risiko JKK satu orang (orang_rahasia.gaji; RLS khusus pengelola). */
export async function aturGajiOrang(_: HasilGaji, form: FormData): Promise<HasilGaji> {
  const sesi = await wajibPerusahaan();
  const orang = String(form.get("orang") ?? "");
  const pokok = rupiahIsian(form.get("pokok"));
  const tunjangan = rupiahIsian(form.get("tunjangan_tetap"));
  const ptkp = String(form.get("ptkp") ?? "");
  const risiko = String(form.get("risiko_jkk") ?? "sangat_rendah");
  if (pokok <= 0 || pokok > 1_000_000_000) return { galat: "Isi gaji pokok dalam rupiah, misalnya 3500000." };
  if (ptkp && !PTKP.includes(ptkp)) return { galat: "Status PTKP tidak dikenal." };
  if (!RISIKO.includes(risiko)) return { galat: "Tingkat risiko kerja tidak dikenal." };
  const supabase = await createClient();
  const { data: lama } = await supabase.from("orang_rahasia").select("gaji").eq("orang_id", orang).maybeSingle();
  const gaji = { ...((lama?.gaji as Record<string, unknown>) ?? {}), pokok, tunjangan_tetap: tunjangan, ptkp: ptkp || null, risiko_jkk: risiko };
  const { error } = await supabase.from("orang_rahasia").upsert({ orang_id: orang, perusahaan_id: sesi.perusahaanId, gaji }, { onConflict: "orang_id" });
  if (error) return { galat: "Gaji gagal disimpan. Hanya pemilik atau admin yang bisa mengubahnya." };
  revalidatePath("/app/orang");
  return { pesan: "Tersimpan." };
}

/** Catat jam lembur satu orang satu hari (RPC catat_lembur memeriksa batas PP 35/2021 dan kunci bulan yang sudah disetujui). */
export async function catatLembur(_: HasilGaji, form: FormData): Promise<HasilGaji> {
  const orang = String(form.get("orang") ?? "");
  const tanggal = String(form.get("tanggal") ?? "");
  const jenis = String(form.get("jenis") ?? "");
  const jam = Number(form.get("jam"));
  const isian = { orang, tanggal, jenis, jam: String(form.get("jam") ?? "") };
  if (!orang) return { galat: "Pilih orang yang lembur.", isian };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return { galat: "Pilih tanggal lembur.", isian };
  if (!(jenis in JENIS_LEMBUR)) return { galat: "Pilih jenis hari.", isian };
  if (!Number.isInteger(jam) || jam < 0 || jam > 12) return { galat: "Isi jam lembur 1 sampai 12, atau 0 untuk membatalkan.", isian };
  const supabase = await createClient();
  const { error } = await supabase.rpc("catat_lembur", { p_orang: orang, p_tanggal: tanggal, p_jenis: jenis, p_jam: jam });
  if (error) return { galat: error.code === "42501" ? "Hanya pemilik atau admin yang bisa mencatat lembur." : error.message, isian };
  revalidatePath("/app/gaji");
  return { pesan: jam ? "Lembur tercatat. Hitung ulang draf supaya masuk slip." : "Lembur dibatalkan. Hitung ulang draf supaya slip ikut berubah." };
}
