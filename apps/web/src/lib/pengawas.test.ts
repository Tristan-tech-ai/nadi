import { describe, expect, it } from "vitest";
import type { Aturan } from "../../../../supabase/functions/baca-berkas/ekstraktor";
import { pengulanganBersarang, periksaAturan } from "../../../../supabase/functions/baca-berkas/pengawas";

// T-02: aturan dari model diperiksa tanpa model. Aturan sah dari korpus ekstraktor lulus; aturan jahat atau halusinasi ditolak.
const INVOICE: Aturan = {
  bentuk: "teks", jenis: "invoice",
  jangkar: ["INVOICE", "Jatuh tempo", "Kepada:", "Total tagihan"],
  bidang: {
    nomor: { pola: "^No\\.\\s+(\\S+)", tipe: "teks" },
    jatuh_tempo: { pola: "^Jatuh tempo\\s+(.+)$", tipe: "tanggal" },
    total: { pola: "^Total tagihan\\s+(Rp[\\d.,]+)", tipe: "rupiah" },
  },
  tabel: { pola: "^(?<nama>.+?)\\s+(?<qty>\\d+)\\s+(?<harga>Rp[\\d.,]+)\\s+(?<jumlah>Rp[\\d.,]+)$", setelah: "Uraian Qty", sebelum: "Total tagihan", tipe: { qty: "angka", harga: "rupiah", jumlah: "rupiah" } },
};
const SLIP_BRUTO: Aturan = {
  bentuk: "teks", jenis: "slip_gaji", jangkar: ["SLIP GAJI", "ID karyawan:", "Pendapatan", "Diterima:"],
  bidang: { bruto: { pola: "^Makan.*\\n(?:.*\\n)*?Total\\s+(Rp[\\d.,]+)", tipe: "rupiah" } },
};
const MUTASI: Aturan = {
  bentuk: "kolom", jenis: "mutasi", jangkar: ["Tanggal", "Keterangan", "Jumlah", "DB/CR", "Saldo"],
  kolom: { tanggal: { judul: "Tanggal", tipe: "tanggal" }, jumlah: { judul: "Jumlah", tipe: "rupiah" } },
};
const ganti = (a: Aturan, ubah: Record<string, unknown>) => ({ ...a, ...ubah }) as unknown as Aturan;

describe("pengawas aturan (T-02)", () => {
  it("aturan sah lulus, termasuk pola sebaris (?:.*\\n)*", () => {
    for (const a of [INVOICE, SLIP_BRUTO, MUTASI]) expect(periksaAturan(a), a.jenis).toEqual({ lulus: true, alasan: [] });
  });
  it("regex berbahaya ditolak: pengulangan bersarang, rujukan balik, lookaround, terlalu panjang", () => {
    expect(pengulanganBersarang("^(a+)+$")).toBe(true);
    expect(pengulanganBersarang("^(\\w+\\s?)*$")).toBe(true);
    expect(pengulanganBersarang("^(?:.*\\n)*?Total")).toBe(false);
    const bidang = (pola: string) => ganti(INVOICE, { bidang: { total: { pola, tipe: "rupiah" } } });
    expect(periksaAturan(bidang("^Total\\s+((\\d+)+)$")).alasan.join()).toContain("pengulangan bersarang");
    expect(periksaAturan(bidang("^(Rp)\\1")).alasan.join()).toContain("rujukan balik");
    expect(periksaAturan(bidang("(?<=Total )(\\d+)")).alasan.join()).toContain("lookahead/lookbehind");
    expect(periksaAturan(bidang("(" + "a".repeat(400) + ")")).alasan.join()).toContain("lebih dari 300");
    expect(periksaAturan(bidang("^Total (a)(b)")).alasan.join()).toContain("tepat satu grup");
  });
  it("isi yang menyerupai skrip atau SQL ditolak", () => {
    expect(periksaAturan(ganti(INVOICE, { jangkar: ["INVOICE", "<script>alert(1)</script>", "Total tagihan"] })).lulus).toBe(false);
    expect(periksaAturan(ganti(MUTASI, { kolom: { tanggal: { judul: "Tanggal'; DROP TABLE orang; --", tipe: "tanggal" } } })).alasan.join()).toContain("skrip atau SQL");
    expect(periksaAturan(ganti(INVOICE, { bidang: { total: { pola: "${process.env.KUNCI}(.+)", tipe: "teks" } } })).lulus).toBe(false);
    expect(periksaAturan(ganti(INVOICE, { kode: "fetch('https://jahat.test')" })).alasan.join()).toContain("kunci tidak dikenal");
  });
  it("halusinasi bentuk ditolak: jenis, tipe, nama bidang, jangkar angka", () => {
    expect(periksaAturan(ganti(INVOICE, { jenis: "rekening_bank" })).alasan).toContain("jenis berkas tidak dikenal");
    expect(periksaAturan(ganti(INVOICE, { bidang: { total: { pola: "Total (.+)", tipe: "uang_asing" } } })).alasan.join()).toContain("tipe tidak dikenal");
    expect(periksaAturan(ganti(INVOICE, { bidang: { "Total Tagihan!": { pola: "Total (.+)", tipe: "teks" } } })).alasan.join()).toContain("nama bidang tidak sah");
    expect(periksaAturan(ganti(SLIP_BRUTO, { bidang: JSON.parse('{"__proto__": {"pola": "Total (.+)", "tipe": "teks"}}') })).lulus).toBe(false);
    expect(periksaAturan(ganti(INVOICE, { jangkar: ["INVOICE", "2026-10-11", "Total tagihan"] })).alasan.join()).toContain("angka atau tanggal");
  });
  it("aturan terlalu umum ditolak: jangkarnya cocok dengan contoh berkas jenis lain", () => {
    const umum = ganti(MUTASI, { jenis: "absen", jangkar: ["Tanggal", "Total"] });
    // "Tanggal" dan "Total" juga muncul di contoh invoice.
    expect(periksaAturan(umum).alasan.join()).toContain("terlalu umum");
  });
});
