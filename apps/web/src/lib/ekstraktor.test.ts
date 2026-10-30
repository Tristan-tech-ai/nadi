import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { unzipSync } from "fflate";
import { extractText, getDocumentProxy } from "unpdf";
import { describe, expect, it } from "vitest";
import { SKEMA_ATURAN, akurasi, aturanDari, cocok, jalankan, konsisten, perbaikiTipe, samaNilai, sidik, ubah, ujiAturan, type Aturan, type AturanMentah } from "../../../../supabase/functions/baca-berkas/ekstraktor";
import { BIDANG, nilai, rapikan, xlsxKeTeks, type Hasil, type Jenis } from "../../../../supabase/functions/baca-berkas/inti";

const KORPUS = join(__dirname, "..", "..", "..", "..", "fixtures", "korpus");
const jawaban = (j: string, f: string) => JSON.parse(readFileSync(join(KORPUS, j, f.replace(/\.\w+$/, ".json")), "utf8")).bidang;
async function teksPdf(jalur: string) {
  const { text } = await extractText(await getDocumentProxy(new Uint8Array(readFileSync(jalur))), { mergePages: true });
  return text as string;
}

// Aturan yang setara dengan tulisan model sekali per tata letak (F0-07B akan memintanya ke model; di sini ditulis tangan sebagai acuan).
const INVOICE: Aturan = {
  bentuk: "teks", jenis: "invoice",
  jangkar: ["INVOICE", "Jatuh tempo", "Kepada:", "Total tagihan"],
  bidang: {
    penjual: { pola: "^(.+)\\n\\s*NPWP", tipe: "teks" },
    nomor: { pola: "^No\\.\\s+(\\S+)", tipe: "teks" },
    tanggal: { pola: "^Tanggal\\s+(.+)$", tipe: "tanggal" },
    jatuh_tempo: { pola: "^Jatuh tempo\\s+(.+)$", tipe: "tanggal" },
    pembeli: { pola: "^Kepada:\\s*(.+)$", tipe: "teks" },
    total: { pola: "^Total tagihan\\s+(Rp[\\d.,]+)", tipe: "rupiah" },
  },
  tabel: { pola: "^(?<nama>.+?)\\s+(?<qty>\\d+)\\s+(?<harga>Rp[\\d.,]+)\\s+(?<jumlah>Rp[\\d.,]+)$", setelah: "Uraian Qty", sebelum: "Total tagihan", tipe: { qty: "angka", harga: "rupiah", jumlah: "rupiah" } },
};
const SLIP: Aturan = {
  bentuk: "teks", jenis: "slip_gaji",
  jangkar: ["SLIP GAJI", "ID karyawan:", "Pendapatan", "Potongan", "Diterima:"],
  bidang: {
    nama: { pola: "^Nama:\\s*(.+)$", tipe: "teks" },
    periode: { pola: "SLIP GAJI\\s+([A-Z]+\\s+\\d{4})", tipe: "periode" },
    gaji_pokok: { pola: "^Gaji pokok\\s+(Rp[\\d.,]+)", tipe: "rupiah" },
    "tunjangan.transport": { pola: "^Transport\\s+(Rp[\\d.,]+)", tipe: "rupiah" },
    "tunjangan.makan": { pola: "^Makan\\s+(Rp[\\d.,]+)", tipe: "rupiah" },
    bruto: { pola: "^Makan.*\\n(?:.*\\n)*?Total\\s+(Rp[\\d.,]+)", tipe: "rupiah" },
    "potongan.bpjs_kesehatan": { pola: "^Bpjs kesehatan\\s+(Rp[\\d.,]+)", tipe: "rupiah" },
    "potongan.jht": { pola: "^Jht\\s+(Rp[\\d.,]+)", tipe: "rupiah" },
    "potongan.jp": { pola: "^Jp\\s+(Rp[\\d.,]+)", tipe: "rupiah" },
    "potongan.pph21": { pola: "^Pph21\\s+(Rp[\\d.,]+)", tipe: "rupiah" },
    "potongan.kasbon": { pola: "^Kasbon\\s+(Rp[\\d.,]+)", tipe: "rupiah", opsional: true },
    lembur: { pola: "^Lembur\\s+(Rp[\\d.,]+)", tipe: "rupiah", opsional: true },
    neto: { pola: "^Diterima:\\s*(Rp[\\d.,]+)", tipe: "rupiah" },
  },
};
const MUTASI: Aturan = {
  bentuk: "kolom", jenis: "mutasi",
  jangkar: ["Tanggal", "Keterangan", "Jumlah", "DB/CR", "Saldo"],
  kolom: {
    tanggal: { judul: "Tanggal", tipe: "tanggal" }, keterangan: { judul: "Keterangan", tipe: "teks" }, cabang: { judul: "Cabang", tipe: "teks" },
    jumlah: { judul: "Jumlah", tipe: "rupiah" }, arah: { judul: "DB/CR", tipe: "teks" }, saldo: { judul: "Saldo", tipe: "rupiah" },
  },
};
const ABSEN: Aturan = {
  bentuk: "kolom", jenis: "absen",
  jangkar: ["Nama", "Tanggal", "Masuk", "Pulang"],
  kolom: {
    nama: { judul: "Nama", tipe: "teks" }, tanggal: { judul: "Tanggal", tipe: "tanggal" }, masuk: { judul: "Masuk", tipe: "jam" },
    pulang: { judul: "Pulang", tipe: "jam" }, keterangan: { judul: "Keterangan", tipe: "teks" },
  },
};

describe("ubah", () => {
  it("rupiah EYD, desimal CSV, tanggal Indonesia, periode, jam", () => {
    expect(ubah("Rp1.687.000", "rupiah")).toBe(1687000);
    expect(ubah("2503000.00", "rupiah")).toBe(2503000);
    expect(ubah("Rp12.500,50", "rupiah")).toBe(12500.5);
    expect(ubah("4 November 2026", "tanggal")).toBe("2026-11-04");
    expect(ubah("07/10/2026", "tanggal")).toBe("2026-10-07");
    expect(ubah("OKTOBER 2026", "periode")).toBe("2026-10");
    expect(ubah("7.15", "jam")).toBe("07.15");
    expect(ubah("tiga ratus", "rupiah")).toBeNull();
    expect(ubah("31 Bulan 2026", "tanggal")).toBeNull();
  });
});

describe("aturan tata letak sama dipakai ulang tanpa model", () => {
  const kasus: [Aturan, string, (f: string) => Promise<string>][] = [
    [INVOICE, "invoice", (f) => teksPdf(f)],
    [SLIP, "slip_gaji", (f) => teksPdf(f)],
    [MUTASI, "mutasi", async (f) => readFileSync(f, "utf8")],
    [ABSEN, "absen", async (f) => xlsxKeTeks(unzipSync(readFileSync(f)))],
  ];
  for (const [aturan, folder, baca] of kasus) {
    it(`${folder}: semua berkas korpus cocok, lengkap, konsisten, akurasi bidang >= 95%`, async () => {
      let cocokBidang = 0;
      let totalBidang = 0;
      const berkas = readdirSync(join(KORPUS, folder)).filter((f) => !f.endsWith(".json"));
      for (const f of berkas) {
        const teks = await baca(join(KORPUS, folder, f));
        expect(cocok(aturan, teks), f).toBe(true);
        const h = jalankan(aturan, teks);
        expect(h.gagal, f).toEqual([]);
        expect(konsisten(aturan.jenis, h.bidang), f).toEqual([]);
        const rapi = rapikan(BIDANG[aturan.jenis as Jenis], h.bidang) as Record<string, unknown>;
        const hasil: Hasil = { jenis: aturan.jenis as Jenis, keyakinan: 1, ringkasan: "", bidang: rapi };
        expect(nilai(aturan.jenis, jawaban(folder, f), hasil).salah, f).toEqual([]);
        const a = akurasi(jawaban(folder, f), rapi);
        cocokBidang += a.cocok;
        totalBidang += a.total;
      }
      expect(cocokBidang / totalBidang).toBeGreaterThanOrEqual(0.95);
    });
  }
});

describe("pengaman", () => {
  it("aturan invoice tidak cocok dengan slip gaji dan sebaliknya", async () => {
    const slip = await teksPdf(join(KORPUS, "slip_gaji", "slip-01.pdf"));
    const inv = await teksPdf(join(KORPUS, "invoice", "invoice-01.pdf"));
    expect(cocok(INVOICE, slip)).toBe(false);
    expect(cocok(SLIP, inv)).toBe(false);
  });
  it("angka yang tidak saling cocok membuat hasil tidak dipercaya (jatuh balik ke model)", async () => {
    const inv = (await teksPdf(join(KORPUS, "invoice", "invoice-01.pdf"))).replace("Total tagihan Rp2.934.000", "Total tagihan Rp2.934.500");
    const h = jalankan(INVOICE, inv);
    expect(konsisten("invoice", h.bidang).length).toBeGreaterThan(0);
  });
  it("baris tabel yang tidak terbaca ditandai, bukan diam-diam dilewati", async () => {
    const inv = (await teksPdf(join(KORPUS, "invoice", "invoice-01.pdf"))).replace("Setrika seprai 7 Rp241.000", "Setrika seprai tujuh Rp241.000");
    expect(jalankan(INVOICE, inv).gagal.some((g) => g.startsWith("baris tabel"))).toBe(true);
  });
  it("sidik stabil terhadap urutan dan huruf besar jangkar", async () => {
    expect(await sidik({ ...MUTASI, jangkar: ["saldo", "TANGGAL", "Keterangan", "Jumlah", "DB/CR"] })).toBe(await sidik(MUTASI));
  });
});

describe("aturan tulisan model diuji sebelum disimpan", () => {
  const rapi = (b: Record<string, unknown>) => rapikan(BIDANG.invoice, b) as Record<string, unknown>;
  const inv = INVOICE as Extract<Aturan, { bentuk: "teks" }>;
  const mentah: AturanMentah = {
    bentuk: "teks",
    jangkar: inv.jangkar,
    bidang: Object.entries(inv.bidang).map(([nama, v]) => ({ nama, pola: v.pola, tipe: v.tipe, opsional: false })),
    tabel_pola: inv.tabel!.pola,
    tabel_setelah: "Uraian Qty",
    tabel_sebelum: "Total tagihan",
    tabel_kolom: [{ nama: "nama", tipe: "teks" }, { nama: "qty", tipe: "angka" }, { nama: "harga", tipe: "rupiah" }, { nama: "jumlah", tipe: "rupiah" }],
    kolom: [],
  };
  it("bentuk mentah (keluaran terstruktur) menjadi aturan yang lulus uji di berkas asal dan berkas kembarannya", async () => {
    const aturan = aturanDari("invoice", mentah);
    const t1 = await teksPdf(join(KORPUS, "invoice", "invoice-01.pdf"));
    expect(ujiAturan(aturan, t1, jawaban("invoice", "invoice-01.pdf"), rapi)).toEqual({ lulus: true, alasan: "" });
    const t5 = await teksPdf(join(KORPUS, "invoice", "invoice-05.pdf"));
    expect(ujiAturan(aturan, t5, jawaban("invoice", "invoice-05.pdf"), rapi).lulus).toBe(true);
  });
  it("regex yang menangkap angka keliru, jangkar hafalan, dan regex rusak ditolak", async () => {
    const t1 = await teksPdf(join(KORPUS, "invoice", "invoice-01.pdf"));
    const salahPola = aturanDari("invoice", { ...mentah, bidang: mentah.bidang.map((b) => (b.nama === "total" ? { ...b, pola: "(Rp[\\d.]+)" } : b)) });
    expect(ujiAturan(salahPola, t1, jawaban("invoice", "invoice-01.pdf"), rapi).lulus).toBe(false);
    const hafalan = aturanDari("invoice", { ...mentah, jangkar: ["PT Kopi Kintamani Lestari", "INVOICE"] });
    expect(cocok(hafalan, await teksPdf(join(KORPUS, "invoice", "invoice-02.pdf")))).toBe(false);
    const rusak = aturanDari("invoice", { ...mentah, bidang: [{ nama: "nomor", pola: "(", tipe: "teks", opsional: false }] });
    expect(ujiAturan(rusak, t1, jawaban("invoice", "invoice-01.pdf"), rapi).alasan).toMatch(/regex rusak/);
  });
  it("nilai hafalan di batas tabel dan jangkar dibuang (eval 31 Okt: aturan invoice tidak cocok dengan kembarannya)", async () => {
    const hafal = aturanDari("invoice", { ...mentah, tabel_sebelum: "Total tagihan Rp3.558.000", jangkar: [...mentah.jangkar, "No. 2026", "Rp1.250.000"] });
    expect((hafal as Extract<Aturan, { bentuk: "teks" }>).tabel!.sebelum).toBe("Total tagihan");
    expect(hafal.jangkar).toEqual([...inv.jangkar, "No."]);
    const t5 = await teksPdf(join(KORPUS, "invoice", "invoice-05.pdf"));
    expect(ujiAturan(hafal, t5, jawaban("invoice", "invoice-05.pdf"), rapi).lulus).toBe(true);
  });
  it("skema aturan kecil dan tertutup", () => {
    expect(JSON.stringify(SKEMA_ATURAN)).not.toMatch(/anyOf|minimum|maxLength/);
    expect((SKEMA_ATURAN as { additionalProperties: boolean }).additionalProperties).toBe(false);
  });
  it("tipe yang keliru (tanggal ditulis teks, jumlah ditulis angka) diperbaiki tanpa model", () => {
    const teks = readFileSync(join(KORPUS, "mutasi", "mutasi-01.csv"), "utf8");
    const benar = jawaban("mutasi", "mutasi-01.csv");
    const rapiM = (b: Record<string, unknown>) => rapikan(BIDANG.mutasi, b) as Record<string, unknown>;
    const keliru = JSON.parse(JSON.stringify(MUTASI)) as Extract<Aturan, { bentuk: "kolom" }>;
    keliru.kolom.tanggal.tipe = "teks";
    keliru.kolom.saldo.tipe = "teks";
    const uji = ujiAturan(keliru, teks, benar, rapiM);
    expect(uji.lulus).toBe(false);
    expect(uji.alasan).toMatch(/baris\[0\]\.tanggal: harap "2026-10-07", dapat "07\/10\/2026"/);
    const diperbaiki = perbaikiTipe(keliru, teks, benar, rapiM);
    expect(ujiAturan(diperbaiki, teks, benar, rapiM)).toEqual({ lulus: true, alasan: "" });
    expect((diperbaiki as typeof keliru).kolom.tanggal.tipe).toBe("tanggal");
  });
  it("angka desimal CSV dibaca sebagai angka utuh", () => {
    expect(ubah("2503000.00", "angka")).toBe(2503000);
  });
  it("akurasi menghitung nilai daun", () => {
    expect(akurasi({ a: 1, b: [{ c: "x" }, { c: "y" }] }, { a: 1, b: [{ c: "X" }, { c: "z" }] })).toEqual({ cocok: 2, total: 3 });
  });
});

describe("foto nota lewat teks OCR (tesseract.js 'ind', fixtures/ocr)", () => {
  const ocr = (f: string) => readFileSync(join(KORPUS, "..", "ocr", f), "utf8");
  const rapi = (b: Record<string, unknown>) => rapikan(BIDANG.nota, b) as Record<string, unknown>;
  // Satu barang tersebar di dua baris OCR: "Teh celup 25" lalu "9x 9.500 85.500" (baris kosong di antaranya).
  const NOTA_OCR: Aturan = aturanDari("nota", {
    bentuk: "teks", jangkar: ["No:", "Tgl:", "TOTAL", "Terima kasih"],
    bidang: [
      { nama: "pemasok", pola: "^(.+)$", tipe: "teks", opsional: false },
      { nama: "nomor", pola: "^No:\\s*(\\S+)", tipe: "teks", opsional: false },
      { nama: "tanggal", pola: "^Tgl:\\s*(\\S+)", tipe: "tanggal", opsional: false },
      { nama: "total", pola: "^TOTAL\\s+([\\d.]+)", tipe: "rupiah", opsional: false },
    ],
    tabel_pola: "^(?<nama>.+?)\\s+(?<qty>\\d+)\\s*x\\s*(?<harga>[\\d.]+)\\s+(?<jumlah>[\\d.]+)$",
    tabel_setelah: "Tgl:", tabel_sebelum: "TOTAL", tabel_gabung: 2,
    tabel_kolom: [{ nama: "nama", tipe: "teks" }, { nama: "qty", tipe: "angka" }, { nama: "harga", tipe: "rupiah" }, { nama: "jumlah", tipe: "rupiah" }],
    kolom: [],
  });
  it("baris tabel dua baris digabung; angka nota kembaran terbaca dan konsisten", () => {
    const h = jalankan(NOTA_OCR, ocr("nota-05.txt"));
    expect(h.lengkap).toBe(true);
    expect(konsisten("nota", h.bidang)).toEqual([]);
    const benar = jawaban("nota", "nota-05.png");
    expect(h.bidang.total).toBe(benar.total);
    expect(h.bidang.tanggal).toBe(benar.tanggal);
    expect((h.bidang.baris as unknown[]).length).toBe(benar.baris.length);
  });
  it("uji aturan dari OCR: salah baca huruf kecil diterima (longgar), tanpa longgar ditolak", () => {
    const benar = jawaban("nota", "nota-01.png");
    expect(ujiAturan(NOTA_OCR, ocr("nota-01.txt"), benar, rapi, true)).toEqual({ lulus: true, alasan: "" });
    expect(ujiAturan(NOTA_OCR, ocr("nota-01.txt"), benar, rapi).alasan).toMatch(/nomor: harap "NT-4671", dapat "NI-4671"/);
  });
  it("longgar hanya untuk teks: angka, tanggal, dan teks yang beda jauh tetap salah", () => {
    expect(samaNilai("NT-4671", "NI-4671", true)).toBe(true);
    expect(samaNilai("Bawang merah 1 kg", "Bawang merah 1 ko", true)).toBe(true);
    expect(samaNilai("2026-10-13", "2026-10-18", true)).toBe(false);
    expect(samaNilai(376500, 376000, true)).toBe(false);
    expect(samaNilai("NT-4671", "NT-9999", true)).toBe(false);
    expect(samaNilai("UD Sumber Rejeki", "Toko Makmur", true)).toBe(false);
  });
});
