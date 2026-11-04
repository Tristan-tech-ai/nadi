import { periksaFaktur, siapFaktur, xmlFakturKeluaran, type Identitas, type InvoicePajak } from "@/lib/pajak/efaktur";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";

// M-09: unduh berkas impor XML Faktur Pajak Keluaran Coretax untuk satu bulan (?bulan=YYYY-MM). Hanya invoice yang data
// pembelinya lengkap; berkas diperiksa aturan DJP sebelum dikirim. Nadi tidak mengunggah ke Coretax.
const teks = (isi: string, status: number) => new Response(isi, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(req: Request) {
  const sesi = await wajibPerusahaan();
  const k = ambilKamus(await bahasaAplikasi(sesi.bahasa)).fakturPesan;
  const bulan = new URL(req.url).searchParams.get("bulan") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(bulan)) return teks(k.bulanRusak, 400);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("data_faktur_keluaran", { p_bulan: `${bulan}-01` });
  if (error) return teks(error.code === "42501" ? k.hanya : k.gagal, error.code === "42501" ? 403 : 500);
  const d = data as { identitas: Identitas | null; faktur: InvoicePajak[] };
  if (!d.identitas) return teks(k.tanpaIdentitas, 409);
  const { siap } = siapFaktur(d.faktur);
  if (!siap.length) return teks(k.tanpaSiap, 422);
  const xml = xmlFakturKeluaran(d.identitas, siap);
  const masalah = periksaFaktur(xml);
  if (masalah.length) return teks(`${k.tidakLolos} ${masalah.slice(0, 5).join("; ")}`, 422);
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Content-Disposition": `attachment; filename="faktur-keluaran-${bulan}.xml"`, "Cache-Control": "private, no-store" },
  });
}
