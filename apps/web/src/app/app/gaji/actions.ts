"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { JenisHariLembur } from "@/lib/gaji/bpjs-lembur";
import { cicilanKasbon, type KasbonAktif } from "@/lib/gaji/kasbon";
import { ringkasKomponen, susunSlip, type DataGaji, type Komponen, type LemburHari, type PetaAturan } from "@/lib/gaji/susun";
import { JENIS_LEMBUR } from "@/lib/gaji/lembur";
import { ambilKamus, isiTeks, type Kamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { asalTautan } from "@/lib/mcp/http";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";

/** isian: nilai formulir yang dikembalikan saat galat, karena React mengosongkan formulir setelah action. */
export type HasilGaji = { pesan: string } | { galat: string; isian?: Record<string, string> } | null;

const bulanSah = (x: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(x);

/** Pesan gaji dalam bahasa pengguna. Pesan galat dari database ditulis dalam bahasa Indonesia, jadi di bahasa lain dibungkus. */
async function teksGaji(): Promise<Kamus["gajiPesan"] & { db: (pesan: string) => string }> {
  const t = ambilKamus(await bahasaAplikasi()).gajiPesan;
  return { ...t, db: (pesan: string) => isiTeks(t.galatDb, { pesan }) };
}

/** Siapkan (atau hitung ulang) draf gaji satu bulan untuk semua karyawan aktif bergaji. */
export async function siapkanGaji(_: HasilGaji, form: FormData): Promise<HasilGaji> {
  const bulan = String(form.get("bulan") ?? "");
  const t = await teksGaji();
  if (!bulanSah(bulan)) return { galat: t.pilihBulan };
  const [tahun, bln] = bulan.split("-").map(Number);
  const awal = `${bulan}-01`;
  const akhir = new Date(Date.UTC(tahun, bln, 0)).toISOString().slice(0, 10);
  const supabase = await createClient();

  const { data: per, error: e1 } = await supabase.rpc("mulai_periode_gaji", { p_bulan: awal });
  if (e1 || !per) return { galat: e1?.code === "42501" ? t.hanyaSiapkan : t.gagalPeriode };

  const { data: baris } = await supabase.from("aturan_bertanggal").select("kunci, nilai, terverifikasi, berlaku_dari").lte("berlaku_dari", akhir).order("berlaku_dari", { ascending: false });
  const aturan: PetaAturan = {};
  for (const a of baris ?? []) if (!aturan[a.kunci]) aturan[a.kunci] = { nilai: a.nilai, terverifikasi: a.terverifikasi };

  const { data: orang } = await supabase.from("orang").select("id, nama, orang_rahasia(gaji)").eq("status", "aktif").overlaps("jenis", ["karyawan", "magang"]);
  const digaji = (orang ?? []).flatMap((o) => {
    const r = Array.isArray(o.orang_rahasia) ? o.orang_rahasia[0] : o.orang_rahasia;
    const g = (r?.gaji ?? {}) as DataGaji;
    return Number(g.pokok) > 0 ? [{ id: o.id as string, g: { ...g, pokok: Number(g.pokok), tunjangan_tetap: Number(g.tunjangan_tetap ?? 0) } }] : [];
  });
  if (!digaji.length) return { galat: t.belumAdaPokok };

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

  // M-10B: cicilan kasbon yang belum lunas (RLS kasbon: pemilik/admin); sisa baru berkurang saat periode disetujui.
  const { data: kas } = await supabase.from("kasbon").select("orang_id, cicilan, sisa").gt("sisa", 0);
  const kasbonDari = new Map<string, KasbonAktif[]>();
  for (const x of kas ?? []) kasbonDari.set(x.orang_id as string, [...(kasbonDari.get(x.orang_id as string) ?? []), { cicilan: Number(x.cicilan), sisa: Number(x.sisa) }]);

  // M-18: klaim yang disetujui dan belum dibayar ikut dibayar lewat slip sebagai penggantian biaya (bukan upah).
  const { data: kl } = await supabase.from("klaim").select("orang_id, jumlah, terbayar").eq("status", "disetujui");
  const gantiDari = new Map<string, number>();
  for (const x of kl ?? []) gantiDari.set(x.orang_id as string, (gantiDari.get(x.orang_id as string) ?? 0) + Number(x.jumlah) - Number(x.terbayar));

  // W-07C: komisi bulan ini per orang dari kasir dan invoice lunas (RPC pemilik/admin; galat = tanpa komisi, slip tetap disusun).
  const { data: km } = await supabase.rpc("commission_summary", { p_mulai: awal, p_sampai: akhir });
  const komisiDari = new Map<string, number>(((km ?? []) as { orang: string; komisi: number }[]).map((x) => [x.orang, Number(x.komisi)]));

  let ditahan = 0;
  for (const o of digaji) {
    const rw = riwayat.get(o.id);
    const { komponen, peringatan } = susunSlip(o.g, aturan, bln, rw && rw.bulan === 11 ? rw : undefined, lemburDari.get(o.id), insentifDari.get(o.id) ?? 0, komisiDari.get(o.id) ?? 0);
    const cil = cicilanKasbon(komponen, kasbonDari.get(o.id) ?? []);
    if (cil.komponen) komponen.push(cil.komponen);
    // Peringatan slip ditulis dalam bahasa Indonesia seperti peringatan susunSlip (ditampilkan dengan lang="id").
    const ganti = gantiDari.get(o.id) ?? 0;
    if (ganti > 0) komponen.push({ kode: "penggantian", label: "Penggantian biaya (klaim)", jenis: "pendapatan", nilai: ganti, sumber: "klaim disetujui" });
    if (cil.dibatasi) peringatan.push(`Cicilan kasbon dibatasi menjadi Rp${(cil.komponen?.nilai ?? 0).toLocaleString("id-ID")} dari Rp${cil.diminta.toLocaleString("id-ID")} agar potongan tidak melebihi 50% upah (PP 36/2021 Pasal 65).`);
    const { data, error } = await supabase.rpc("simpan_slip", { p_periode: per, p_orang: o.id, p_komponen: komponen, p_peringatan: peringatan });
    if (error) return { galat: error.code === "55000" ? t.db(error.message) : t.gagalSlip };
    if ((data as { ditahan: boolean }).ditahan) ditahan++;
  }
  revalidatePath("/app/gaji");
  const tanpaSlip = [...insentifDari.keys()].filter((id) => !digaji.some((o) => o.id === id)).length;
  return {
    pesan: `${isiTeks(t.drafSiap, { n: digaji.length })}${ditahan ? isiTeks(t.ditahan, { n: ditahan }) : ""}${tanpaSlip ? isiTeks(t.tanpaSlip, { n: tanpaSlip }) : ""}`,
  };
}

export async function setujuiGaji(_: HasilGaji, form: FormData): Promise<HasilGaji> {
  const supabase = await createClient();
  const t = await teksGaji();
  const { data, error } = await supabase.rpc("setujui_periode_gaji", { p_periode: String(form.get("periode") ?? "") });
  if (error) return { galat: error.code === "42501" ? t.hanyaSetujui : t.db(error.message) };
  const d = data as { slip: number; ditahan: number };
  revalidatePath("/app/gaji");
  return { pesan: `${isiTeks(t.disetujui, { n: d.slip - d.ditahan })}${d.ditahan ? isiTeks(t.masihDitahan, { n: d.ditahan }) : ""}` };
}

export async function lepasTahan(_: HasilGaji, form: FormData): Promise<HasilGaji> {
  const supabase = await createClient();
  const t = await teksGaji();
  const { error } = await supabase.rpc("lepas_tahan_slip", { p_slip: String(form.get("slip") ?? ""), p_alasan: String(form.get("alasan") ?? "") });
  if (error) return { galat: t.db(error.message) };
  revalidatePath("/app/gaji");
  return { pesan: t.dilepas };
}

export type HasilTautanSlip = { tautan: string; nama: string } | { galat: string } | null;

/** Tautan slip 30 hari untuk dibagikan (token di fragmen URL agar tidak masuk log server). */
export async function bagikanSlip(_: HasilTautanSlip, form: FormData): Promise<HasilTautanSlip> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("buat_tautan_slip", { p_slip: String(form.get("slip") ?? "") });
  if (error || !data) {
    const t = await teksGaji();
    return { galat: error?.message ? t.db(error.message) : t.gagalTautan };
  }
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
  const mulai = String(form.get("mulai") ?? "");
  const t = await teksGaji();
  if (pokok <= 0 || pokok > 1_000_000_000) return { galat: t.isiPokok };
  if (ptkp && !PTKP.includes(ptkp)) return { galat: t.ptkpTak };
  if (!RISIKO.includes(risiko)) return { galat: t.risikoTak };
  if (mulai && !/^\d{4}-\d{2}-\d{2}$/.test(mulai)) return { galat: t.tanggalMulai };
  // M-10B: rekening untuk berkas transfer (RLS orang_rahasia: pemilik/admin) dan tanda harian lepas untuk THR.
  const bank = String(form.get("bank") ?? "").trim().toUpperCase();
  const rekening = String(form.get("rekening") ?? "").replace(/[\s.-]/g, "");
  const atasNama = String(form.get("atas_nama") ?? "").trim();
  if (rekening && (!/^\d{6,20}$/.test(rekening) || bank.length < 2 || bank.length > 40)) return { galat: t.rekeningTak };
  if (atasNama.length > 40) return { galat: t.rekeningTak };
  const supabase = await createClient();
  const { data: lama } = await supabase.from("orang_rahasia").select("gaji").eq("orang_id", orang).maybeSingle();
  const gaji = { ...((lama?.gaji as Record<string, unknown>) ?? {}), pokok, tunjangan_tetap: tunjangan, ptkp: ptkp || null, risiko_jkk: risiko, harian_lepas: form.get("harian_lepas") === "on" };
  const { error } = await supabase.from("orang_rahasia").upsert(
    { orang_id: orang, perusahaan_id: sesi.perusahaanId, gaji, bank: rekening ? bank : null, rekening: rekening || null, atas_nama: rekening ? atasNama || null : null },
    { onConflict: "orang_id" },
  );
  if (error) return { galat: t.gagalGaji };
  // Tanggal mulai kerja di orang.data.mulai (dibaca juga oleh Gerbang Gaji dan cadangan pesangon); kosong = tidak diubah.
  if (mulai) {
    const { data: o } = await supabase.from("orang").select("data").eq("id", orang).maybeSingle();
    const { error: e2 } = await supabase.from("orang").update({ data: { ...((o?.data as Record<string, unknown>) ?? {}), mulai } }).eq("id", orang);
    if (e2) return { galat: t.gagalMulai };
  }
  revalidatePath("/app/orang");
  revalidatePath("/app/gaji");
  return { pesan: t.tersimpan };
}

/** Saldo cadangan pesangon yang sudah disisihkan (pemilik saja; RPC atur_saldo_pesangon). */
export async function aturSaldoPesangon(_: HasilGaji, form: FormData): Promise<HasilGaji> {
  const teks = String(form.get("saldo") ?? "");
  const saldo = rupiahIsian(teks);
  const t = await teksGaji();
  if (teks.trim() === "" || saldo > 100_000_000_000) return { galat: t.isiSaldo, isian: { saldo: teks } };
  const supabase = await createClient();
  const { error } = await supabase.rpc("atur_saldo_pesangon", { p_saldo: saldo });
  if (error) return { galat: error.code === "42501" ? t.hanyaSaldo : t.gagalSaldo, isian: { saldo: teks } };
  revalidatePath("/app/gaji");
  return { pesan: t.saldoTersimpan };
}

/** F4-09B: iuran dana pensiun yang sudah dibayar usaha untuk satu orang (UU 27/2026 Pasal 248; bukan BPJS JP), pemilik saja.
 * Kartu cadangan pesangon berbahasa Indonesia (dibungkus lang=id di mode lain), jadi pesannya juga. */
export async function aturIuranPensiun(_: HasilGaji, form: FormData): Promise<HasilGaji> {
  const orang = String(form.get("orang") ?? "");
  const teks = String(form.get("iuran") ?? "");
  const nilai = rupiahIsian(teks);
  if (teks.trim() === "" || !/^[\d.\s]+$/.test(teks.replace(/^Rp/i, "")) || nilai > 100_000_000_000) {
    return { galat: "Isi iuran dalam rupiah bulat, 0 atau lebih.", isian: { iuran: teks } };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("atur_iuran_pensiun", { p_orang: orang, p_nilai: nilai });
  if (error) return { galat: error.code === "42501" ? "Hanya pemilik yang mengisi iuran dana pensiun." : "Iuran belum tersimpan. Coba lagi sebentar; isianmu tidak hilang.", isian: { iuran: teks } };
  revalidatePath("/app/gaji");
  return { pesan: "Iuran tersimpan." };
}

/** Catat jam lembur satu orang satu hari (RPC catat_lembur memeriksa batas UU 27/2026 Pasal 116 dan kunci bulan yang sudah disetujui). */
export async function catatLembur(_: HasilGaji, form: FormData): Promise<HasilGaji> {
  const orang = String(form.get("orang") ?? "");
  const tanggal = String(form.get("tanggal") ?? "");
  const jenis = String(form.get("jenis") ?? "");
  const jam = Number(form.get("jam"));
  const isian = { orang, tanggal, jenis, jam: String(form.get("jam") ?? "") };
  const t = await teksGaji();
  if (!orang) return { galat: t.pilihOrang, isian };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return { galat: t.pilihTanggal, isian };
  if (!(jenis in JENIS_LEMBUR)) return { galat: t.pilihJenis, isian };
  if (!Number.isInteger(jam) || jam < 0 || jam > 12) return { galat: t.isiJam, isian };
  const supabase = await createClient();
  const { error } = await supabase.rpc("catat_lembur", { p_orang: orang, p_tanggal: tanggal, p_jenis: jenis, p_jam: jam });
  if (error) return { galat: error.code === "42501" ? t.hanyaLembur : t.db(error.message), isian };
  revalidatePath("/app/gaji");
  return { pesan: jam ? t.lemburTercatat : t.lemburBatal };
}
