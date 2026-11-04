// M-09B: berkas impor XML e-Bupot Unifikasi (BpuBulk) dan Retur Faktur Pajak Masukan (InputTaxInvoiceReturn) Coretax.
// Urutan elemen sama dengan contoh resmi DJP: bppu.zip (pajak.go.id/sites/default/files/2024-12/bppu.zip) dan
// "Sample Retur Faktur PM Template v.1.1.xml" (ConverterEfakturCoretax v1.6). Aturan isian dari lembar BPPU templat
// "BPPU Excel to XML v.3.xlsx": NPWP/NIK 16 angka, ID TKU 22 angka, Fasilitas N/A bila tanpa fasilitas, tanggal YYYY-MM-DD,
// GovTreasurerOpt N/A dan SP2DNumber kosong (nil) untuk pemotong bukan instansi pemerintah. Skema turunan di docs/pajak/coretax.

export type Potong = {
  pemasok: string; npwp: string; nitku: string; kode: string; dpp: number; tarif: number; pph: number;
  dokumen: string; nomor: string; tanggal_dokumen: string; tanggal_potong: string; masa: string;
};
export const DOKUMEN_BUPOT = ["CommercialInvoice", "TaxInvoice", "Contract", "PaymentProof", "Other"] as const;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const angka = (n: number) => String(Math.round((n + Number.EPSILON) * 100) / 100);

/** BpuBulk satu masa. Semua bukti potong harus masa yang sama (TaxPeriodMonth/Year dari kolom masa). */
export function xmlBupot(identitas: { npwp: string; nitku: string }, potong: Potong[]): string {
  const isi = potong.map((p) => {
    const [y, m] = p.masa.split("-");
    return `\t\t<Bpu>
\t\t\t<TaxPeriodMonth>${Number(m)}</TaxPeriodMonth>
\t\t\t<TaxPeriodYear>${y}</TaxPeriodYear>
\t\t\t<CounterpartTin>${p.npwp}</CounterpartTin>
\t\t\t<IDPlaceOfBusinessActivityOfIncomeRecipient>${p.nitku}</IDPlaceOfBusinessActivityOfIncomeRecipient>
\t\t\t<TaxCertificate>N/A</TaxCertificate>
\t\t\t<TaxObjectCode>${p.kode}</TaxObjectCode>
\t\t\t<TaxBase>${angka(p.dpp)}</TaxBase>
\t\t\t<Rate>${angka(p.tarif)}</Rate>
\t\t\t<Document>${p.dokumen}</Document>
\t\t\t<DocumentNumber>${esc(p.nomor)}</DocumentNumber>
\t\t\t<DocumentDate>${p.tanggal_dokumen}</DocumentDate>
\t\t\t<IDPlaceOfBusinessActivity>${identitas.nitku}</IDPlaceOfBusinessActivity>
\t\t\t<GovTreasurerOpt>N/A</GovTreasurerOpt>
\t\t\t<SP2DNumber xsi:nil="true"/>
\t\t\t<WithholdingDate>${p.tanggal_potong}</WithholdingDate>
\t\t</Bpu>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<BpuBulk xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
\t<TIN>${identitas.npwp}</TIN>
\t<ListOfBpu>
${isi}
\t</ListOfBpu>
</BpuBulk>
`;
}

/** Aturan isian BPPU untuk satu berkas; kosong = lolos. `kodeSah` = kode objek pajak referensi DJP. */
export function periksaBupot(xml: string, kodeSah?: Set<string>): string[] {
  const masalah: string[] = [];
  const ambil = (b: string, t: string) => b.match(new RegExp(`<${t}>([^<]*)</${t}>`))?.[1] ?? null;
  const tin = ambil(xml, "TIN");
  if (!/^\d{16}$/.test(tin ?? "")) masalah.push("NPWP pemotong 16 angka");
  [...xml.matchAll(/<Bpu>([\s\S]*?)<\/Bpu>/g)].forEach((m, i) => {
    const b = m[1], n = `bukti ${i + 1}`;
    const bulan = Number(ambil(b, "TaxPeriodMonth")), tahun = Number(ambil(b, "TaxPeriodYear"));
    if (!(bulan >= 1 && bulan <= 12) || !(tahun >= 2024 && tahun <= 2100)) masalah.push(`${n}: masa/tahun pajak`);
    if (!/^\d{16}$/.test(ambil(b, "CounterpartTin") ?? "")) masalah.push(`${n}: NPWP/NIK penerima 16 angka`);
    if (!/^\d{22}$/.test(ambil(b, "IDPlaceOfBusinessActivityOfIncomeRecipient") ?? "")) masalah.push(`${n}: ID TKU penerima 22 angka`);
    if (!/^\d{22}$/.test(ambil(b, "IDPlaceOfBusinessActivity") ?? "") || !(ambil(b, "IDPlaceOfBusinessActivity") ?? "").startsWith(tin ?? "x")) masalah.push(`${n}: ID TKU pemotong 22 angka diawali NPWP`);
    const kode = ambil(b, "TaxObjectCode") ?? "";
    if (!/^\d{2}-\d{3}-\d{2}$/.test(kode) || (kodeSah && !kodeSah.has(kode))) masalah.push(`${n}: kode objek pajak di luar referensi`);
    if (!/^\d+(\.\d{1,2})?$/.test(ambil(b, "TaxBase") ?? "") || Number(ambil(b, "TaxBase")) <= 0) masalah.push(`${n}: DPP angka positif`);
    if (!/^\d+(\.\d{1,2})?$/.test(ambil(b, "Rate") ?? "")) masalah.push(`${n}: tarif angka`);
    if (!(DOKUMEN_BUPOT as readonly string[]).includes(ambil(b, "Document") ?? "") && !/^(Announcement|CurrentAccount|Decree|DeedOfEngagement|DeedOfGeneral|OtherFacilityDoc|StatementLetter|TaxRegulationDoc|TradeConfirmation)$/.test(ambil(b, "Document") ?? "")) masalah.push(`${n}: jenis dokumen di luar referensi`);
    for (const t of ["DocumentDate", "WithholdingDate"]) if (!/^\d{4}-\d{2}-\d{2}$/.test(ambil(b, t) ?? "")) masalah.push(`${n}: ${t} YYYY-MM-DD`);
    const tp = ambil(b, "WithholdingDate") ?? "";
    if (tp && (Number(tp.slice(0, 4)) * 12 + Number(tp.slice(5, 7))) < tahun * 12 + bulan) masalah.push(`${n}: tanggal potong tidak boleh sebelum masa`);
  });
  return masalah;
}

export type ReturBaris = { nama: string; jumlah: number; harga: number; jumlahRetur: number; satuan?: string };
export type Retur = { nomorFaktur: string; npwpPenjual: string; tanggal: string; baris: ReturBaris[]; kodeTransaksi: "01" | "04" };

/** Retur Faktur Pajak Masukan: pembeli (usahamu) mengembalikan barang dari faktur pemasok. Tanggal retur DD-MM-YYYY seperti contoh resmi. */
export function xmlReturMasukan(npwp: string, retur: Retur[]): string {
  const isi = retur.map((r) => {
    const rows = r.baris.map((b) => {
      const dpp = Math.round(b.harga * b.jumlahRetur * 100) / 100;
      const lain = r.kodeTransaksi === "04" ? Math.round(((dpp * 11) / 12) * 100) / 100 : dpp;
      return { b, dpp, lain, ppn: Math.round(lain * 12) / 100 };
    });
    const tot = (k: "dpp" | "lain" | "ppn") => angka(rows.reduce((s, x) => s + x[k], 0));
    const [y, m, d] = r.tanggal.split("-");
    return `\t\t<InputReturnData>
\t\t\t<TransactionDocumentData>
\t\t\t\t<InvoiceNumber>${r.nomorFaktur}</InvoiceNumber>
\t\t\t\t<SellerTIN>${r.npwpPenjual}</SellerTIN>
\t\t\t\t<ReturnDate>${d}-${m}-${y}</ReturnDate>
\t\t\t\t<ReturnTaxBase>${tot("dpp")}</ReturnTaxBase>
\t\t\t\t<ReturnOtherTaxBase>${tot("lain")}</ReturnOtherTaxBase>
\t\t\t\t<ReturnVAT>${tot("ppn")}</ReturnVAT>
\t\t\t\t<ReturnSTLG>0</ReturnSTLG>
\t\t\t</TransactionDocumentData>
\t\t\t<TransactionDetailsData>
${rows.map(({ b, dpp, lain, ppn }) => `\t\t\t\t<Rows>
\t\t\t\t\t<Type>A</Type>
\t\t\t\t\t<Name>${esc(b.nama)}</Name>
\t\t\t\t\t<Code>000000</Code>
\t\t\t\t\t<Quantity>${angka(b.jumlah)}</Quantity>
\t\t\t\t\t<Unit>${b.satuan ?? "UM.0021"}</Unit>
\t\t\t\t\t<UnitPrice>${angka(b.harga)}</UnitPrice>
\t\t\t\t\t<STLGRate>0</STLGRate>
\t\t\t\t\t<ReturnQuantity>${angka(b.jumlahRetur)}</ReturnQuantity>
\t\t\t\t\t<ReturnDiscount>0</ReturnDiscount>
\t\t\t\t\t<ReturnTaxBase>${angka(dpp)}</ReturnTaxBase>
\t\t\t\t\t<ReturnOtherTaxBase>${angka(lain)}</ReturnOtherTaxBase>
\t\t\t\t\t<ReturnOtherTaxBaseCheck>${r.kodeTransaksi === "04" ? "true" : "false"}</ReturnOtherTaxBaseCheck>
\t\t\t\t\t<ReturnVAT>${angka(ppn)}</ReturnVAT>
\t\t\t\t\t<ReturnSTLG>0</ReturnSTLG>
\t\t\t\t</Rows>`).join("\n")}
\t\t\t\t<FooterRow>
\t\t\t\t\t<ReturnTaxBaseTotal>${tot("dpp")}</ReturnTaxBaseTotal>
\t\t\t\t\t<ReturnOtherTaxBaseTotal>${tot("lain")}</ReturnOtherTaxBaseTotal>
\t\t\t\t\t<ReturnVATTotal>${tot("ppn")}</ReturnVATTotal>
\t\t\t\t\t<ReturnSTLGTotal>0</ReturnSTLGTotal>
\t\t\t\t</FooterRow>
\t\t\t</TransactionDetailsData>
\t\t</InputReturnData>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<InputTaxInvoiceReturn>
\t<TIN>${npwp}</TIN>
\t<InputReturnDataList>
${isi}
\t</InputReturnDataList>
</InputTaxInvoiceReturn>
`;
}

/** Hari kerja pertama pada atau setelah tanggal (Sabtu, Minggu, dan tanggal libur digeser; PMK 81/2024 Pasal 100 dan 173). */
export function hariKerja(tgl: string, libur: Set<string>): string {
  const d = new Date(`${tgl}T00:00:00Z`);
  while ([0, 6].includes(d.getUTCDay()) || libur.has(d.toISOString().slice(0, 10))) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
