"use server";

import { revalidatePath } from "next/cache";
import { angkaIsian, barisSaldoAwal } from "@/lib/buku/laporan";
import { formatRupiah } from "@/lib/format";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export type HasilBuku = { pesan: string } | { galat: string } | null;

async function teksBuku() {
  const bahasa = await bahasaAplikasi();
  const t = ambilKamus(bahasa).bukuPesan;
  return { ...t, bahasa, db: (pesan: string) => isiTeks(t.galatDb, { pesan }), hanya: ambilKamus(bahasa).buku.hanyaPemilikAkuntan };
}

/** Saldo awal (M-01): satu isian per akun neraca, positif di sisi normal akun. Pemilik atau akuntan. */
export async function simpanSaldoAwal(_: HasilBuku, form: FormData): Promise<HasilBuku> {
  const k = await teksBuku();
  const tanggal = String(form.get("tanggal") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return { galat: k.tanggal };
  const isian: { kode: string; saldo_normal: string; nilai: number }[] = [];
  for (const [kunci, nilai] of form.entries()) {
    const m = /^saldo:([0-9A-Za-z.-]{1,20}):(debit|kredit)$/.exec(kunci);
    if (!m) continue;
    const n = angkaIsian(String(nilai));
    if (n === null) return { galat: isiTeks(k.angkaRusak, { kode: m[1] }) };
    isian.push({ kode: m[1], saldo_normal: m[2], nilai: n });
  }
  const baris = barisSaldoAwal(isian);
  if (!baris.length) return { galat: k.isiSatu };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("atur_saldo_awal", { p_tanggal: tanggal, p_baris: baris });
  if (error) return { galat: error.code === "42501" ? k.hanya : k.db(error.message) };
  revalidatePath("/app/buku");
  return { pesan: isiTeks(k.saldoTersimpan, { rp: formatRupiah(Math.abs(Number((data as { penyeimbang?: number })?.penyeimbang ?? 0)), { bahasa: k.bahasa }) }) };
}

/** Tutup buku tahunan (M-01). Pemilik atau akuntan, hanya tahun yang sudah lewat. */
export async function tutupBuku(_: HasilBuku, form: FormData): Promise<HasilBuku> {
  const k = await teksBuku();
  const tahun = Number(form.get("tahun"));
  if (!Number.isInteger(tahun) || tahun < 2000) return { galat: k.tahun };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tutup_buku", { p_tahun: tahun });
  if (error) return { galat: error.code === "42501" ? k.hanya : error.code === "22023" ? k.tahun : k.db(error.message) };
  const r = data as { baru?: boolean; kosong?: boolean; laba?: number };
  revalidatePath("/app/buku");
  if (r.kosong) return { pesan: isiTeks(k.tutupKosong, { tahun }) };
  if (!r.baru) return { pesan: isiTeks(k.tutupSudah, { tahun }) };
  return { pesan: isiTeks(k.tutupSelesai, { tahun, rp: formatRupiah(Number(r.laba ?? 0), { bahasa: k.bahasa }) }) };
}
