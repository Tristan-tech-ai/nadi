// Ekspor Bukti Potong PPh 21 bulanan pegawai tetap (BPMP) dalam susunan template "BPMP Excel to XML v.3" DJP
// (docs/research/coretax-bpmp.md). Berkas ini diisi NIK oleh akuntan lalu diubah ke XML dengan konverter resmi DJP.
// Nadi tidak menyimpan NIK mentah, jadi kolom NPWP/NIK/TIN sengaja kosong dan diberi catatan per baris.
import ExcelJS from "exceljs";
import { pph21Bulanan, type TabelTer } from "@/lib/gaji/pph21";
import { ringkasKomponen, type Komponen } from "@/lib/gaji/susun";

/** Judul kolom B..N baris 4 sheet DATA template v.3, persis. */
export const JUDUL_BPMP = ["Masa Pajak", "Tahun Pajak", "Status Pegawai", "NPWP/NIK/TIN", "Nomor Passport", "Status", "Posisi", "Sertifikat/Fasilitas",
  "Kode Objek Pajak", "Penghasilan Kotor", "Tarif", "ID TKU", "Tgl Pemotongan"] as const;

export type DataBpmp = {
  bulan: string; status: string | null; identitas: { npwp: string; id_tku: string } | null; bulan_disetujui: string[];
  baris: { orang_id: string; nama: string; id_staf: string | null; ptkp: string | null; nik_akhir: string | null; posisi: string; komponen: { kode: string; label: string; jenis: string; nilai: number; sumber: string }[] }[];
};
export type BarisBpmp = {
  masa: number; tahun: number; statusPegawai: "Resident"; nik: string; paspor: string; ptkp: string; posisi: string; sertifikat: "N/A";
  kodeObjek: "21-100-01"; bruto: number; tarif: number; idTku: string; tanggal: string; nama: string;
};

const akhirBulan = (bulan: string) => {
  const d = new Date(`${bulan.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
};

/** Slip disetujui satu bulan -> baris BPMP. Tarif = TER kategori PTKP atas bruto PPh slip (PP 58/2023). */
export function susunBpmp(d: DataBpmp, aturan: { ter: TabelTer; kategori: Record<string, string> }) {
  const masa = Number(d.bulan.slice(5, 7));
  const tahun = Number(d.bulan.slice(0, 4));
  if (masa === 12) {
    return { baris: [] as BarisBpmp[], perluNik: [] as string[], dilewati: ["Desember tidak diekspor sebagai BPMP: PPh 21 masa terakhir dihitung dengan tarif Pasal 17 setahun (bukti potong A1)."] };
  }
  const baris: BarisBpmp[] = [];
  const perluNik: string[] = [];
  const dilewati: string[] = [];
  for (const b of d.baris) {
    if (!b.ptkp || !aturan.kategori[b.ptkp]) {
      dilewati.push(`${b.nama}: status PTKP belum diisi`);
      continue;
    }
    const bruto = ringkasKomponen(b.komponen as Komponen[]).brutoPph;
    baris.push({ masa, tahun, statusPegawai: "Resident", nik: "", paspor: "", ptkp: b.ptkp, posisi: b.posisi.slice(0, 100), sertifikat: "N/A",
      kodeObjek: "21-100-01", bruto, tarif: pph21Bulanan(bruto, b.ptkp, aturan.ter, aturan.kategori).tarif, idTku: d.identitas?.id_tku ?? "", tanggal: akhirBulan(d.bulan), nama: b.nama });
    perluNik.push(`${b.nama}${b.nik_akhir ? ` (NIK berakhiran ${b.nik_akhir})` : ""}`);
  }
  return { baris, perluNik, dilewati };
}

/** Buku Excel sheet DATA: A1 "NPWP Pemotong", B1 NPWP, judul baris 4 B..N, data mulai baris 5. */
export async function bukuBpmp(npwp: string, baris: BarisBpmp[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("DATA");
  ws.getCell("A1").value = "NPWP Pemotong";
  ws.getCell("B1").value = npwp;
  JUDUL_BPMP.forEach((j, i) => { ws.getRow(4).getCell(i + 2).value = j; });
  baris.forEach((b, i) => {
    const r = ws.getRow(5 + i);
    const nilai = [b.masa, b.tahun, b.statusPegawai, null, null, b.ptkp, b.posisi, b.sertifikat, b.kodeObjek, b.bruto, b.tarif, b.idTku, new Date(`${b.tanggal}T00:00:00Z`)];
    nilai.forEach((v, k) => { r.getCell(k + 2).value = v; });
    r.getCell(5).note = `Isi NIK ${b.nama} (16 angka). Nadi tidak menyimpan NIK lengkap.`;
    r.getCell(14).numFmt = "yyyy-mm-dd";
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
