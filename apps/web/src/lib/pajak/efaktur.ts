// M-09: berkas impor XML Faktur Pajak Keluaran Coretax (TaxInvoiceBulk) dari invoice Nadi. Urutan elemen sama persis dengan
// contoh resmi DJP "Sample Faktur PK Template v.1.4.xml" (ConverterEfakturCoretax v1.6, pajak.go.id, diunduh 5 Nov 2026);
// rumus dan aturan isian dari lembar "Keterangan" templat Excel v.1.6.1: DPP = Jumlah x Harga - Diskon, DPP Nilai Lain = 11/12 x DPP
// (kode transaksi 04), Tarif PPN 12, PPN = Tarif x DPP Nilai Lain, maks 2 angka desimal, NITKU 22 angka, NPWP/NIK pembeli 16 angka
// (0000000000000000 bila jenis ID bukan TIN), ID TKU pembeli 000000 bila bukan TIN. DJP tidak menerbitkan XSD; skema turunan
// docs/pajak/coretax/TaxInvoice.xsd ditulis dari contoh dan aturan itu (scripts/pajak/validasi-xsd.py).

export type JenisId = "TIN" | "National ID" | "Passport" | "Other ID";
export type Identitas = { npwp: string; nitku: string; harga_termasuk_ppn: boolean; kode_transaksi: "01" | "04" };
export type Pembeli = { nama: string; jenis_id: JenisId; nomor_id: string; nitku: string | null; alamat: string; email: string | null };
export type BarisInvoice = { uraian: string; jumlah: number; harga: number; satuan?: string; produk?: string };
export type InvoicePajak = { nomor: string; tanggal: string; pelanggan: string; baris: BarisInvoice[]; pembeli: Pembeli | null };

/** Satuan ukur referensi DJP (REF-General templat v.1.6.1). */
export const SATUAN: Record<string, string> = {
  "UM.0001": "Metrik Ton", "UM.0002": "Wet Ton", "UM.0003": "Kilogram", "UM.0004": "Gram", "UM.0005": "Karat", "UM.0006": "Kiloliter", "UM.0007": "Liter",
  "UM.0008": "Barrel", "UM.0009": "MMBTU", "UM.0010": "Ampere", "UM.0011": "Sentimeter Kubik", "UM.0012": "Meter Persegi", "UM.0013": "Meter", "UM.0014": "Inci",
  "UM.0015": "Sentimeter", "UM.0016": "Yard", "UM.0017": "Lusin", "UM.0018": "Unit", "UM.0019": "Set", "UM.0020": "Lembar", "UM.0021": "Piece", "UM.0022": "Boks",
  "UM.0023": "Tahun", "UM.0024": "Bulan", "UM.0025": "Minggu", "UM.0026": "Hari", "UM.0027": "Jam", "UM.0028": "Menit", "UM.0029": "Persen", "UM.0030": "Kegiatan",
  "UM.0031": "Laporan", "UM.0032": "Bahan", "UM.0033": "Lainnya", "UM.0034": "Meter Kubik", "UM.0035": "Sentimeter Persegi", "UM.0036": "Drum", "UM.0037": "Karton",
  "UM.0038": "Kwh", "UM.0039": "Roll",
};
export const KODE_TRANSAKSI = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"];
const SATUAN_NADI: Record<string, string> = { kg: "UM.0003", g: "UM.0004", gram: "UM.0004", l: "UM.0007", liter: "UM.0007", pcs: "UM.0021", buah: "UM.0021",
  unit: "UM.0018", set: "UM.0019", lembar: "UM.0020", lusin: "UM.0017", box: "UM.0022", boks: "UM.0022", jam: "UM.0027", hari: "UM.0026", bulan: "UM.0024", porsi: "UM.0021" };

const dua = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const angka = (n: number) => String(dua(n));
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const el = (t: string, v: string | number | null | undefined, sela: string) => (v === null || v === undefined || v === "" ? `${sela}<${t}/>` : `${sela}<${t}>${esc(String(v))}</${t}>`);

/** Nilai satu baris barang/jasa menurut rumus templat DJP. Harga termasuk PPN dipisah lebih dulu. */
export function hitungBaris(b: BarisInvoice, id: Pick<Identitas, "harga_termasuk_ppn" | "kode_transaksi">) {
  const faktor = id.kode_transaksi === "04" ? 11 / 12 : 1;
  const tarif = 12;
  const pembagi = 1 + (faktor * tarif) / 100; // 04: 1,11; 01: 1,12
  const harga = id.harga_termasuk_ppn ? dua(b.harga / pembagi) : dua(b.harga);
  const dpp = dua(harga * b.jumlah);
  const dppLain = id.kode_transaksi === "04" ? dua((dpp * 11) / 12) : dpp;
  return { harga, qty: dua(b.jumlah), diskon: 0, dpp, dppLain, tarif, ppn: dua((dppLain * tarif) / 100) };
}

export const satuanDari = (s?: string) => SATUAN_NADI[(s ?? "").trim().toLowerCase()] ?? "UM.0021";

/** Susun TaxInvoiceBulk. Invoice tanpa data pembeli tidak boleh masuk; panggil `siapFaktur` dulu. */
export function xmlFakturKeluaran(id: Identitas, faktur: (InvoicePajak & { pembeli: Pembeli })[]): string {
  const isi = faktur.map((f) => {
    const p = f.pembeli;
    const tin = p.jenis_id === "TIN";
    const barang = f.baris.map((b) => {
      const h = hitungBaris(b, id);
      return ["\t\t\t\t<GoodService>", el("Opt", "A", "\t\t\t\t\t"), el("Code", "000000", "\t\t\t\t\t"), el("Name", b.uraian.slice(0, 200), "\t\t\t\t\t"),
        el("Unit", satuanDari(b.satuan), "\t\t\t\t\t"), el("Price", angka(h.harga), "\t\t\t\t\t"), el("Qty", angka(h.qty), "\t\t\t\t\t"),
        el("TotalDiscount", angka(h.diskon), "\t\t\t\t\t"), el("TaxBase", angka(h.dpp), "\t\t\t\t\t"), el("OtherTaxBase", angka(h.dppLain), "\t\t\t\t\t"),
        el("VATRate", h.tarif, "\t\t\t\t\t"), el("VAT", angka(h.ppn), "\t\t\t\t\t"), el("STLGRate", 0, "\t\t\t\t\t"), el("STLG", 0, "\t\t\t\t\t"),
        "\t\t\t\t</GoodService>"].join("\n");
    }).join("\n");
    return ["\t\t<TaxInvoice>", el("TaxInvoiceDate", f.tanggal, "\t\t\t"), el("TaxInvoiceOpt", "Normal", "\t\t\t"), el("TrxCode", id.kode_transaksi, "\t\t\t"),
      el("AddInfo", null, "\t\t\t"), el("CustomDoc", null, "\t\t\t"), el("CustomDocMonthYear", null, "\t\t\t"), el("RefDesc", f.nomor, "\t\t\t"),
      el("FacilityStamp", null, "\t\t\t"), el("SellerIDTKU", id.nitku, "\t\t\t"), el("BuyerTin", tin ? p.nomor_id : "0000000000000000", "\t\t\t"),
      el("BuyerDocument", p.jenis_id, "\t\t\t"), el("BuyerCountry", "IDN", "\t\t\t"), el("BuyerDocumentNumber", tin ? null : p.nomor_id, "\t\t\t"),
      el("BuyerName", p.nama, "\t\t\t"), el("BuyerAdress", p.alamat, "\t\t\t"), el("BuyerEmail", p.email, "\t\t\t"),
      el("BuyerIDTKU", tin ? p.nitku : "000000", "\t\t\t"), "\t\t\t<ListOfGoodService>", barang, "\t\t\t</ListOfGoodService>", "\t\t</TaxInvoice>"].join("\n");
  }).join("\n");
  return `<?xml version="1.0" encoding="utf-8" ?>
<TaxInvoiceBulk xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="TaxInvoice.xsd">
\t<TIN>${id.npwp}</TIN>
\t<ListOfTaxInvoice>
${isi}
\t</ListOfTaxInvoice>
</TaxInvoiceBulk>
`;
}

/** Pisahkan invoice yang siap (punya pembeli) dari yang belum. */
export function siapFaktur(faktur: InvoicePajak[]) {
  const siap = faktur.filter((f): f is InvoicePajak & { pembeli: Pembeli } => f.pembeli !== null);
  return { siap, kurang: faktur.filter((f) => f.pembeli === null) };
}

/** Urutan jalur elemen (tanpa isi) untuk dibandingkan dengan contoh resmi DJP. */
export function jalurElemen(xml: string): string[] {
  const jalur: string[] = [], tumpuk: string[] = [];
  for (const m of xml.replace(/<\?xml[^>]*\?>/, "").matchAll(/<(\/?)([A-Za-z][\w]*)[^>]*?(\/?)>/g)) {
    const [, tutup, nama, kosong] = m;
    if (tutup) { tumpuk.pop(); continue; }
    tumpuk.push(nama);
    jalur.push(tumpuk.join("/"));
    if (kosong) tumpuk.pop();
  }
  return jalur;
}

/** Aturan isian DJP untuk satu berkas; kosong = lolos. */
export function periksaFaktur(xml: string): string[] {
  const masalah: string[] = [];
  const ambil = (blok: string, t: string) => blok.match(new RegExp(`<${t}>([^<]*)</${t}>`))?.[1] ?? (new RegExp(`<${t}/>`).test(blok) ? "" : null);
  const tin = ambil(xml, "TIN");
  if (!tin || !/^\d{16}$/.test(tin)) masalah.push("TIN penjual harus 16 angka");
  [...xml.matchAll(/<TaxInvoice>([\s\S]*?)<\/TaxInvoice>/g)].forEach((m, i) => {
    const f = m[1], n = `faktur ${i + 1}`;
    const v = (t: string) => ambil(f, t);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v("TaxInvoiceDate") ?? "")) masalah.push(`${n}: tanggal YYYY-MM-DD`);
    if (v("TaxInvoiceOpt") !== "Normal") masalah.push(`${n}: TaxInvoiceOpt selalu Normal`);
    if (!KODE_TRANSAKSI.includes(v("TrxCode") ?? "")) masalah.push(`${n}: kode transaksi di luar referensi`);
    if (!/^\d{22}$/.test(v("SellerIDTKU") ?? "") || !(v("SellerIDTKU") ?? "").startsWith(tin ?? "x")) masalah.push(`${n}: ID TKU penjual 22 angka diawali NPWP`);
    const jenis = v("BuyerDocument");
    if (!["TIN", "National ID", "Passport", "Other ID"].includes(jenis ?? "")) masalah.push(`${n}: jenis ID pembeli di luar referensi`);
    if (jenis === "TIN") {
      if (!/^\d{16}$/.test(v("BuyerTin") ?? "") || /^0+$/.test(v("BuyerTin") ?? "")) masalah.push(`${n}: NPWP pembeli 16 angka`);
      if (!/^\d{22}$/.test(v("BuyerIDTKU") ?? "")) masalah.push(`${n}: ID TKU pembeli 22 angka`);
    } else {
      if (v("BuyerTin") !== "0000000000000000") masalah.push(`${n}: NPWP pembeli 0000000000000000 untuk jenis ID selain TIN`);
      if (!(v("BuyerDocumentNumber") ?? "").trim()) masalah.push(`${n}: nomor dokumen pembeli wajib`);
      if (v("BuyerIDTKU") !== "000000") masalah.push(`${n}: ID TKU pembeli 000000 untuk jenis ID selain TIN`);
    }
    if (!(v("BuyerName") ?? "").trim() || !(v("BuyerAdress") ?? "").trim()) masalah.push(`${n}: nama dan alamat pembeli wajib`);
    if (!/^[A-Z]{3}$/.test(v("BuyerCountry") ?? "")) masalah.push(`${n}: kode negara 3 huruf`);
    const barang = [...f.matchAll(/<GoodService>([\s\S]*?)<\/GoodService>/g)];
    if (!barang.length) masalah.push(`${n}: tanpa barang/jasa`);
    barang.forEach((g, j) => {
      const b = (t: string) => Number(ambil(g[1], t));
      const nb = `${n} baris ${j + 1}`;
      if (!["A", "B"].includes(ambil(g[1], "Opt") ?? "")) masalah.push(`${nb}: Barang/Jasa A atau B`);
      if (!SATUAN[ambil(g[1], "Unit") ?? ""]) masalah.push(`${nb}: satuan di luar referensi`);
      for (const t of ["Price", "Qty", "TotalDiscount", "TaxBase", "OtherTaxBase", "VAT", "STLG"]) {
        const s = ambil(g[1], t) ?? "";
        if (!/^\d+(\.\d{1,2})?$/.test(s)) masalah.push(`${nb}: ${t} angka maks 2 desimal`);
      }
      if (Math.abs(b("Qty") * b("Price") - b("TotalDiscount") - b("TaxBase")) > 0.011) masalah.push(`${nb}: DPP = Jumlah x Harga - Diskon`);
      const trx = v("TrxCode");
      if (trx === "04" && Math.abs((b("TaxBase") * 11) / 12 - b("OtherTaxBase")) > 0.011) masalah.push(`${nb}: DPP Nilai Lain = 11/12 x DPP`);
      if (["01", "04", "09"].includes(trx ?? "") && Math.abs((b("OtherTaxBase") * b("VATRate")) / 100 - b("VAT")) > 0.011) masalah.push(`${nb}: PPN = Tarif x DPP Nilai Lain`);
    });
  });
  return masalah;
}
