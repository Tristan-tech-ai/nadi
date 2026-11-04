import { BANK_SKN, berkasPayroll, periksaPayroll, type Jalur, type Penerima } from "@/lib/gaji/transfer";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";

// M-10B: unduh berkas payroll CIMB Niaga OCTO Biz (CSV) untuk gaji satu bulan yang sudah disetujui. Inhouse = karyawan berekening
// CIMB Niaga, SKN = bank lain dari daftar SKN. Slip yang ditahan tidak ikut. Nadi tidak mengirim uang; pemilik mengunggah sendiri.
const teks = (isi: string, status: number) => new Response(isi, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" } });
type Rek = { bank: string | null; rekening: string | null; atas_nama: string | null };
type Slip = { neto: number; orang: { nama: string; orang_rahasia: Rek | Rek[] | null } | null };

export async function GET(req: Request) {
  const sesi = await wajibPerusahaan();
  const k = ambilKamus(await bahasaAplikasi(sesi.bahasa)).transferPesan;
  if (sesi.peran !== "pemilik" && sesi.peran !== "admin") return teks(k.hanya, 403);
  const q = new URL(req.url).searchParams;
  const bulan = q.get("bulan") ?? "";
  const jalur = q.get("jalur") as Jalur;
  const rekening = (q.get("rekening") ?? "").replace(/[\s.-]/g, "");
  const nama = (q.get("nama") ?? "").trim();
  const tanggal = q.get("tanggal") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(bulan) || (jalur !== "inhouse" && jalur !== "skn")) return teks(k.rusak, 400);
  if (!/^\d{6,20}$/.test(rekening) || nama.length < 2 || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return teks(k.sumber, 400);
  const supabase = await createClient();
  const { data: per } = await supabase.from("periode_gaji").select("id, status").eq("bulan", `${bulan}-01`).maybeSingle();
  if (!per || per.status !== "disetujui") return teks(k.belumDisetujui, 409);
  const { data } = await supabase.from("slip_gaji").select("neto, orang:orang_id(nama, orang_rahasia(bank, rekening, atas_nama))").eq("periode_id", per.id).eq("ditahan", false).gt("neto", 0);
  const penerima: Penerima[] = [];
  for (const s of (data ?? []) as unknown as Slip[]) {
    const r = Array.isArray(s.orang?.orang_rahasia) ? s.orang?.orang_rahasia[0] : s.orang?.orang_rahasia;
    if (!r?.rekening || !r.bank) continue;
    const cimb = r.bank.toUpperCase().includes("CIMB");
    if ((jalur === "inhouse") !== cimb) continue;
    if (jalur === "skn" && !BANK_SKN.includes(r.bank)) continue;
    penerima.push({ rekening: r.rekening, nama: r.atas_nama ?? s.orang?.nama ?? "", jumlah: s.neto, keterangan: `Gaji ${bulan}`, bank: r.bank });
  }
  if (!penerima.length) return teks(jalur === "inhouse" ? k.kosongInhouse : k.kosongSkn, 422);
  const csv = berkasPayroll(jalur, { rekening, nama, tanggal, keterangan: `Payroll ${bulan}` }, penerima);
  const cek = periksaPayroll(jalur, csv);
  if (!cek.ok) return teks(isiTeks(k.tidakLolos, { galat: cek.galat.slice(0, 5).join("; ") }), 422);
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="payroll-cimb-${jalur}-${bulan}.csv"`, "Cache-Control": "private, no-store" },
  });
}
