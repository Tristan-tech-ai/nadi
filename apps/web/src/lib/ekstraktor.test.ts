import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { unzipSync } from "fflate";
import { extractText, getDocumentProxy } from "unpdf";
import { describe, expect, it } from "vitest";
import { cocok, jalankan, konsisten, sidik, ubah, type Aturan } from "../../../../supabase/functions/baca-berkas/ekstraktor";
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

/** Akurasi tingkat bidang: setiap nilai daun di jawaban dibandingkan dengan hasil. */
function akurasi(benar: unknown, hasil: unknown): { cocok: number; total: number } {
  if (Array.isArray(benar)) {
    return benar.reduce((s, x, i) => { const r = akurasi(x, (hasil as unknown[] | undefined)?.[i]); return { cocok: s.cocok + r.cocok, total: s.total + r.total }; }, { cocok: 0, total: 0 });
  }
  if (benar && typeof benar === "object") {
    return Object.entries(benar).reduce((s, [k, x]) => { const r = akurasi(x, (hasil as Record<string, unknown> | undefined)?.[k]); return { cocok: s.cocok + r.cocok, total: s.total + r.total }; }, { cocok: 0, total: 0 });
  }
  return { cocok: String(benar).toLowerCase() === String(hasil ?? "").toLowerCase() ? 1 : 0, total: 1 };
}

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
