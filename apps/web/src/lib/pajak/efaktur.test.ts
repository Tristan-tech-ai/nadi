import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hitungBaris, jalurElemen, periksaFaktur, siapFaktur, xmlFakturKeluaran, type Identitas, type InvoicePajak, type Pembeli } from "./efaktur";

// Korpus M-09: 20 invoice sintetis (pembeli NPWP, NIK, paspor, lainnya; harga termasuk dan belum termasuk PPN; kode 04 dan 01;
// harga yang tidak habis dibagi; nama dengan &). KORPUS_TULIS=1 menulis fixtures/korpus/efaktur/faktur-NN.xml yang lalu divalidasi
// XSD oleh scripts/pajak/validasi-xsd.py; tanpa itu tes memastikan berkas di repo sama dengan keluaran kode sekarang.
const DIR = join(__dirname, "..", "..", "..", "..", "..", "fixtures", "korpus", "efaktur");
const RESMI = readFileSync(join(DIR, "resmi", "sample-faktur-pk-v1.4.xml"), "utf8");
const ID: Identitas = { npwp: "1091031210912281", nitku: "1091031210912281000000", harga_termasuk_ppn: true, kode_transaksi: "04" };

const PEMBELI: Pembeli[] = [
  { nama: "CV Maju Jaya", jenis_id: "TIN", nomor_id: "0811034248502000", nitku: "0811034248502000000000", alamat: "Jl. Sudirman 5, Denpasar", email: "keu@majujaya.test" },
  { nama: "Bu Rina", jenis_id: "National ID", nomor_id: "5171014507800003", nitku: null, alamat: "Jl. Teuku Umar 8, Denpasar", email: null },
  { nama: "Mr. Tanaka Hiro", jenis_id: "Passport", nomor_id: "TK1234567", nitku: null, alamat: "Hotel Sanur Indah, Denpasar", email: null },
  { nama: "Koperasi Sido & Rukun", jenis_id: "Other ID", nomor_id: "KOP-77/2024", nitku: null, alamat: "Jl. Gatot Subroto 1 <Blok A>", email: null },
];
const BARANG = [["Nasi kotak ayam bakar", 22000, "porsi"], ["Es teh manis", 3000, "pcs"], ["Jasa katering", 1250000, "hari"], ["Tepung terigu", 13500, "kg"], ["Kopi bubuk 250 g", 37333, "pcs"]] as const;

function korpus(): { id: Identitas; faktur: (InvoicePajak & { pembeli: Pembeli })[] }[] {
  return Array.from({ length: 20 }, (_, i) => {
    const id: Identitas = { ...ID, harga_termasuk_ppn: i % 3 !== 0, kode_transaksi: i % 5 === 4 ? "01" : "04" };
    const baris = Array.from({ length: 1 + (i % 3) }, (_, j) => {
      const [uraian, harga, satuan] = BARANG[(i + j) % BARANG.length];
      return { uraian, harga: harga + (i % 4) * 7, jumlah: 1 + ((i * 7 + j * 3) % 30), satuan };
    });
    const tgl = `2026-11-${String(1 + (i % 28)).padStart(2, "0")}`;
    return { id, faktur: [{ nomor: `${String(i + 1).padStart(3, "0")}/INV/XI/2026`, tanggal: tgl, pelanggan: PEMBELI[i % 4].nama, baris, pembeli: PEMBELI[i % 4] }] };
  });
}

describe("XML Faktur Pajak Keluaran Coretax (M-09)", () => {
  it("rumus templat DJP: 04 = 11/12 x DPP, tarif 12; harga termasuk PPN dipisah 1,11", () => {
    expect(hitungBaris({ uraian: "x", jumlah: 10, harga: 12000000 }, { harga_termasuk_ppn: false, kode_transaksi: "04" }))
      .toEqual({ harga: 12000000, qty: 10, diskon: 0, dpp: 120000000, dppLain: 110000000, tarif: 12, ppn: 13200000 });
    const t = hitungBaris({ uraian: "x", jumlah: 30, harga: 22200 }, { harga_termasuk_ppn: true, kode_transaksi: "04" });
    expect(t.harga).toBe(20000);
    expect(t.dpp + t.ppn).toBe(666000);
    expect(hitungBaris({ uraian: "x", jumlah: 1, harga: 112000 }, { harga_termasuk_ppn: true, kode_transaksi: "01" })).toMatchObject({ dpp: 100000, dppLain: 100000, ppn: 12000 });
  });

  it("urutan elemen sama dengan contoh resmi DJP", () => {
    const x = xmlFakturKeluaran(ID, korpus()[0].faktur);
    expect(jalurElemen(x)).toEqual(jalurElemen(RESMI));
  });

  it("contoh resmi DJP lolos pemeriksa aturan (pemeriksa tidak lebih ketat dari DJP)", () => {
    // Contoh resmi memakai tarif 11 untuk kode 07 (tidak diperiksa rumus PPN) dan BuyerCountry IND; keduanya diterima.
    expect(periksaFaktur(RESMI.replace("<BuyerName/>", "<BuyerName>Pembeli</BuyerName>").replace("<BuyerAdress/>", "<BuyerAdress>Alamat</BuyerAdress>"))).toEqual([]);
  });

  it("20 faktur korpus lolos aturan DJP dan sama dengan berkas di repo", () => {
    korpus().forEach(({ id, faktur }, i) => {
      const x = xmlFakturKeluaran(id, faktur);
      expect(periksaFaktur(x), `faktur ${i + 1}`).toEqual([]);
      const f = join(DIR, `faktur-${String(i + 1).padStart(2, "0")}.xml`);
      if (process.env.KORPUS_TULIS === "1") { mkdirSync(DIR, { recursive: true }); writeFileSync(f, x); }
      expect(existsSync(f), f).toBe(true);
      expect(readFileSync(f, "utf8")).toBe(x);
    });
  });

  it("pemeriksa menangkap kesalahan umum", () => {
    const x = xmlFakturKeluaran(ID, korpus()[1].faktur);
    expect(periksaFaktur(x.replace("<TIN>1091031210912281</TIN>", "<TIN>123</TIN>"))).toContain("TIN penjual harus 16 angka");
    expect(periksaFaktur(x.replace("<Unit>UM.0021</Unit>", "<Unit>UM.9999</Unit>")).join()).toContain("satuan di luar referensi");
    expect(periksaFaktur(x.replace(/<VAT>[^<]+<\/VAT>/, "<VAT>1</VAT>")).join()).toContain("PPN = Tarif x DPP Nilai Lain");
    expect(periksaFaktur(x.replace(/<BuyerIDTKU>[^<]+<\/BuyerIDTKU>/, "<BuyerIDTKU>123</BuyerIDTKU>")).join()).toContain("ID TKU pembeli");
  });

  it("karakter khusus di nama dan alamat di-escape", () => {
    const x = xmlFakturKeluaran(ID, korpus()[3].faktur);
    expect(x).toContain("<BuyerName>Koperasi Sido &amp; Rukun</BuyerName>");
    expect(x).toContain("&lt;Blok A&gt;");
  });

  it("invoice tanpa data pembeli dipisah", () => {
    const { siap, kurang } = siapFaktur([{ ...korpus()[0].faktur[0] }, { ...korpus()[0].faktur[0], pembeli: null }]);
    expect([siap.length, kurang.length]).toEqual([1, 1]);
  });
});
