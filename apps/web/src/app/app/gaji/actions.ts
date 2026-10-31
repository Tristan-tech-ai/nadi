"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { ringkasKomponen, susunSlip, type DataGaji, type Komponen, type PetaAturan } from "@/lib/gaji/susun";
import { asal } from "@/lib/mcp/http";
import { createClient } from "@/lib/supabase/server";

export type HasilGaji = { pesan: string } | { galat: string } | null;

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

  let ditahan = 0;
  for (const o of digaji) {
    const rw = riwayat.get(o.id);
    const { komponen, peringatan } = susunSlip(o.g, aturan, bln, rw && rw.bulan === 11 ? rw : undefined);
    const { data, error } = await supabase.rpc("simpan_slip", { p_periode: per, p_orang: o.id, p_komponen: komponen, p_peringatan: peringatan });
    if (error) return { galat: error.code === "55000" ? error.message : "Sebagian slip gagal disimpan. Coba siapkan ulang; slip yang sudah tersimpan tidak hilang." };
    if ((data as { ditahan: boolean }).ditahan) ditahan++;
  }
  revalidatePath("/app/gaji");
  return { pesan: `Draf gaji siap untuk ${digaji.length} orang.${ditahan ? ` ${ditahan} ditahan Gerbang Gaji; periksa alasannya.` : ""}` };
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
  return { tautan: `${asal(await headers())}/slip#${data as string}`, nama: String(form.get("nama") ?? "") };
}
