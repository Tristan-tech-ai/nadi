import ExcelJS from "exceljs";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { hariIni } from "@/lib/izin";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { zonaUsahaIni } from "@/lib/zona-usaha";

// M-24: unduh semua data usaha dalam satu XLSX, satu lembar per tabel, dibaca lewat RLS pemilik (sama dengan yang terlihat di layar).
// Data rahasia gaji/rekening (orang_rahasia) dan rahasia teknis (token, kunci) tidak ikut. Maks 20.000 baris per lembar.
const LEMBAR: { nama: string; tabel: string; kolom: string; urut: string }[] = [
  { nama: "Akun", tabel: "akun", kolom: "id, kode, nama, golongan, saldo_normal, aktif", urut: "kode" },
  { nama: "Jurnal", tabel: "jurnal", kolom: "id, tanggal, keterangan, sumber, dibalik_oleh, dibuat_at", urut: "tanggal" },
  { nama: "Baris jurnal", tabel: "jurnal_baris", kolom: "jurnal_id, akun_id, debit, kredit, keterangan", urut: "jurnal_id" },
  { nama: "Invoice", tabel: "invoice", kolom: "nomor, pelanggan, tanggal, jatuh_tempo, total, status, lunas_tanggal, lunas_cara", urut: "tanggal" },
  { nama: "Tagihan pemasok", tabel: "tagihan_beli", kolom: "pemasok, nomor_pemasok, tanggal, jatuh_tempo, total, terbayar, dikurangi, status", urut: "tanggal" },
  { nama: "Pelanggan", tabel: "customer", kolom: "nama, jenis, hp, email, kota, segmen, aktif", urut: "nama" },
  { nama: "Produk", tabel: "produk", kolom: "kode, nama, jenis, satuan, kategori, harga_jual, aktif", urut: "kode" },
  { nama: "Stok", tabel: "stok", kolom: "produk_id, gudang_id, jumlah, nilai, lokasi", urut: "produk_id" },
  { nama: "Orang", tabel: "orang", kolom: "id, nama, jenis, status, telepon, email, dibuat_at", urut: "nama" },
  { nama: "Lembur", tabel: "lembur", kolom: "orang_id, tanggal, jenis, jam, catatan", urut: "tanggal" },
  { nama: "Izin", tabel: "pengajuan_izin", kolom: "orang_id, jenis, mulai, selesai, hari, alasan, status, dibuat_at", urut: "dibuat_at" },
  { nama: "Kerja", tabel: "kerja", kolom: "judul, jenis, status, tenggat, selesai_at, dibuat_at", urut: "dibuat_at" },
];

const teks = (pesan: string, status: number) => new Response(pesan, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
const sel = (v: unknown) => (v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : (v as string | number | boolean));

export async function GET() {
  const sesi = await wajibPerusahaan();
  const t = ambilKamus(await bahasaAplikasi(sesi.bahasa)).pindah;
  if (sesi.peran !== "pemilik") return teks(t.eksporHanyaPemilik, 403);
  const supabase = await createClient();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Nadi";
  for (const l of LEMBAR) {
    const { data, error } = await supabase.from(l.tabel).select(l.kolom).order(l.urut).limit(20000);
    const ws = wb.addWorksheet(l.nama);
    const baris = (error ? [] : (data ?? [])) as unknown as Record<string, unknown>[];
    const kolom = l.kolom.split(",").map((x) => x.trim());
    ws.addRow(kolom);
    for (const b of baris) ws.addRow(kolom.map((k) => sel(b[k])));
    if (error) ws.addRow([t.lembarGagal]);
  }
  const hari = hariIni(new Date(), await zonaUsahaIni(sesi.perusahaanId));
  return new Response(Buffer.from(await wb.xlsx.writeBuffer()), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="nadi-semua-data-${hari}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
