import { periksaBupot, xmlBupot, type Potong } from "@/lib/pajak/bupot";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";

// M-09B: unduh berkas impor XML e-Bupot Unifikasi (BpuBulk) untuk satu masa (?bulan=YYYY-MM). Diperiksa aturan BPPU sebelum dikirim.
const teks = (isi: string, status: number) => new Response(isi, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(req: Request) {
  const sesi = await wajibPerusahaan();
  const k = ambilKamus(await bahasaAplikasi(sesi.bahasa)).fakturPesan;
  const bulan = new URL(req.url).searchParams.get("bulan") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(bulan)) return teks(k.bulanRusak, 400);
  const supabase = await createClient();
  const [{ data, error }, { data: kode }] = await Promise.all([
    supabase.rpc("data_bupot", { p_bulan: `${bulan}-01` }),
    supabase.from("kode_objek_pajak").select("kode"),
  ]);
  if (error) return teks(error.code === "42501" ? k.hanya : k.gagal, error.code === "42501" ? 403 : 500);
  const d = data as { identitas: { npwp: string; nitku: string } | null; potong: Potong[] };
  if (!d.identitas) return teks(k.tanpaIdentitas, 409);
  if (!d.potong.length) return teks(k.tanpaPotong, 422);
  const xml = xmlBupot(d.identitas, d.potong);
  const masalah = periksaBupot(xml, new Set(((kode ?? []) as { kode: string }[]).map((x) => x.kode)));
  if (masalah.length) return teks(`${k.tidakLolos} ${masalah.slice(0, 5).join("; ")}`, 422);
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Content-Disposition": `attachment; filename="bupot-unifikasi-${bulan}.xml"`, "Cache-Control": "private, no-store" },
  });
}
