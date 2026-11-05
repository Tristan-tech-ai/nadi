"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { kenali, uraiCsv } from "@/lib/pindah/format";
import { createClient } from "@/lib/supabase/server";

export type HasilPindah = { pesan: string } | { galat: string } | null;

// Batas body server action Next bawaan 1 MB (termasuk overhead multipart), jadi berkas dibatasi 900 KB.
const BATAS_BYTE = 900 * 1024;

function nilaiSel(v: ExcelJS.CellValue): unknown {
  if (v === null || v === undefined) return "";
  if (v instanceof Date || typeof v !== "object") return v;
  if ("richText" in v) return v.richText.map((r) => r.text).join("");
  if ("result" in v) return v.result ?? "";
  if ("text" in v) return v.text;
  return "";
}

export async function pindahkan(_: HasilPindah, form: FormData): Promise<HasilPindah> {
  const k = ambilKamus(await bahasaAplikasi());
  const p = k.pindahPesan;
  const berkas = form.get("berkas");
  if (!(berkas instanceof File) || berkas.size === 0) return { galat: p.pilihBerkas };
  if (berkas.size > BATAS_BYTE) return { galat: p.terlaluBesar };
  let rows: unknown[][];
  try {
    if (/\.xlsx$/i.test(berkas.name)) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await berkas.arrayBuffer());
      const ws = wb.worksheets[0];
      rows = [];
      ws?.eachRow({ includeEmpty: false }, (r) => rows.push((r.values as ExcelJS.CellValue[]).slice(1).map(nilaiSel)));
    } else if (/\.(csv|txt)$/i.test(berkas.name)) {
      rows = uraiCsv(await berkas.text());
    } else return { galat: p.jenisBerkas };
  } catch {
    return { galat: p.rusak };
  }
  const h = kenali(rows);
  if (!h) return { galat: p.tidakDikenali };
  if ("belum" in h) return { galat: p.penagihanBelum };
  if (h.baris.length === 0) return { galat: p.kosong };
  const supabase = await createClient();
  const { error } = await supabase.rpc("propose_migration", { p_format: h.format, p_berkas: berkas.name, p_baris: h.baris });
  if (error) return { galat: ["22023", "23505", "42501"].includes(error.code ?? "") ? isiTeks(p.galatDb, { pesan: error.message }) : p.gagal };
  revalidatePath("/app/pindah");
  return { pesan: isiTeks(p.diajukan, { n: h.baris.length, jenis: k.pindah.formatNama[h.format], lewat: h.dilewati }) };
}
