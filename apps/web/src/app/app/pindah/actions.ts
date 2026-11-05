"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { kenali, uraiCsv } from "@/lib/pindah/format";
import { ringkasKolom, terapkanPeta, type Peta } from "@/lib/pindah/peta";
import { createClient } from "@/lib/supabase/server";

export type HasilPindah = { pesan: string; asal?: "aturan" | "model"; token?: number } | { galat: string } | null;

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
  const supabase = await createClient();
  let h = kenali(rows);
  // T-01C: judul kolom tidak dikenali -> peta yang sudah dipelajari usaha ini (aktif: tanpa model), atau model lewat pelajari-tanya
  // pindah sekali (hanya judul + tipe kolom yang dikirim, bukan isi baris), disimpan bayangan, aktif setelah cocok 2 kali.
  let asal: { asal: "aturan" | "model"; token: number } | null = null;
  if (!h) {
    const r = ringkasKolom(rows);
    if (r) {
      const { data: tersimpan } = await supabase.from("pindah_peta").select("id, format, peta, status").eq("sidik", r.sidik).in("status", ["aktif", "bayangan"]).maybeSingle();
      let peta: Peta | null = null;
      if (tersimpan?.status === "aktif") {
        peta = { format: tersimpan.format as Peta["format"], kolom: tersimpan.peta as Record<string, string> };
        asal = { asal: "aturan", token: 0 };
      } else {
        const { data: b } = await supabase.functions.invoke("pelajari-pindah", { body: { ringkas: { baris_judul: r.baris_judul, judul: r.judul, tipe: r.tipe }, peta_id: tersimpan?.id } });
        const hasil = b as { peta: Peta | null; token?: number } | null;
        if (hasil?.peta) { peta = hasil.peta; asal = { asal: "model", token: hasil.token ?? 0 }; }
      }
      if (peta) {
        const t = terapkanPeta(rows, r, peta);
        h = { format: peta.format, sumber: "umum", baris: t.baris, dilewati: t.dilewati };
      }
    }
  }
  if (!h) return { galat: p.tidakDikenali };
  if ("belum" in h) return { galat: p.penagihanBelum };
  if (h.baris.length === 0) return { galat: p.kosong };
  const { error } = await supabase.rpc("propose_migration", { p_format: h.format, p_berkas: berkas.name, p_baris: h.baris });
  if (error) return { galat: ["22023", "23505", "42501"].includes(error.code ?? "") ? isiTeks(p.galatDb, { pesan: error.message }) : p.gagal };
  revalidatePath("/app/pindah");
  const pesan = isiTeks(p.diajukan, { n: h.baris.length, jenis: k.pindah.formatNama[h.format], lewat: h.dilewati });
  return asal ? { pesan: `${pesan} ${asal.asal === "model" ? p.belajar : p.tanpaAi}`, ...asal } : { pesan };
}
