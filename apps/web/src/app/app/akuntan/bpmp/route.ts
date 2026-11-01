import type { TabelTer } from "@/lib/gaji/pph21";
import { bukuBpmp, susunBpmp, type DataBpmp } from "@/lib/pajak/bpmp";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";

// F4-08: unduh BPMP satu bulan (susunan template "BPMP Excel to XML v.3" DJP) untuk usaha yang sedang dibuka. Pemilik, admin,
// akuntan. Kolom NIK dikosongkan dan diberi catatan (Nadi tidak menyimpan NIK lengkap); diisi akuntan sebelum konverter DJP.
const teks = (pesan: string, status: number) => new Response(pesan, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(request: Request) {
  const sesi = await wajibPerusahaan();
  if (!["pemilik", "admin", "akuntan"].includes(sesi.peran)) return teks("Ekspor bukti potong hanya untuk pemilik, admin, dan akuntan.", 403);
  const bulan = new URL(request.url).searchParams.get("bulan") ?? "";
  if (!/^\d{4}-\d{2}$/.test(bulan)) return teks("Pilih bulan (YYYY-MM).", 400);
  const supabase = await createClient();
  const akhir = new Date(Date.UTC(Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const [{ data, error }, { data: aturan }] = await Promise.all([
    supabase.rpc("data_bpmp", { p_bulan: `${bulan}-01` }),
    supabase.from("aturan_bertanggal").select("kunci, nilai, berlaku_dari").in("kunci", ["pph21.ter", "pph21.kategori"]).eq("terverifikasi", true)
      .lte("berlaku_dari", akhir).order("berlaku_dari", { ascending: false }),
  ]);
  if (error || !data) return teks("Data gaji belum bisa dibaca. Coba lagi sebentar.", 500);
  const d = data as DataBpmp;
  if (d.status !== "disetujui") return teks("Gaji bulan ini belum disetujui, jadi bukti potongnya belum bisa diekspor.", 409);
  if (!d.identitas?.npwp) return teks("Isi NPWP pemotong dan ID TKU di Ruang Akuntan dulu.", 409);
  const ambil = (k: string) => (aturan ?? []).find((a) => a.kunci === k)?.nilai;
  const ter = ambil("pph21.ter") as TabelTer | undefined;
  const kategori = ambil("pph21.kategori") as Record<string, string> | undefined;
  if (!ter || !kategori) return teks("Tarif TER untuk bulan ini belum terverifikasi di Nadi.", 409);
  const h = susunBpmp(d, { ter, kategori });
  if (h.baris.length === 0) return teks(h.dilewati.join("\n") || "Tidak ada slip untuk diekspor.", 409);
  const buku = await bukuBpmp(d.identitas.npwp, h.baris);
  return new Response(new Uint8Array(buku), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="BPMP-${bulan}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
