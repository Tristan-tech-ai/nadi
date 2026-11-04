// Usulan rekonsiliasi mutasi bank (M-05). Perluasan cocok mutasi F4-06 ke semua transaksi: invoice terbuka (uang masuk),
// tagihan pemasok terbuka (uang keluar), jurnal kas yang sudah tercatat, dan aturan kata kunci buatan pengguna. Tanpa model:
// setiap usulan punya alasan yang bisa dibaca, dan bila ada dua jawaban yang sama kuat Nadi tidak menebak (kandidat saja).
// Database (public.rekonsiliasi) yang menjalankan pilihan; berkas ini hanya mengusulkan.
import { cocokkan, huruf, namaDisebut, TRANSFER, type InvoiceTerbuka, type Mutasi } from "@/lib/invoice/cocok";

export type TagihanTerbuka = { id: string; pemasok: string; nomor_pemasok: string | null; sisa: number; tanggal: string; jatuh_tempo: string };
export type JurnalKas = { id: string; tanggal: string; keterangan: string; jumlah: number; arah: "CR" | "DB" };
export type AturanRekon = { id: string; kata: string; arah: "CR" | "DB" | null; akun_kode: string };
export type JenisRekon = "invoice" | "tagihan_beli" | "jurnal" | "akun";
export type Usulan = { jenis: JenisRekon; target: string; alasan: AlasanRekon };
export type AlasanRekon = "nomor_invoice" | "nama_nominal" | "nominal_unik" | "nomor_tagihan" | "nama_pemasok" | "nominal_tagihan" | "sudah_tercatat" | "aturan";
export type HasilRekon = { indeks: number; usulan?: Usulan; kandidat: { jenis: JenisRekon; target: string }[] };
export type Konteks = { invoice: readonly InvoiceTerbuka[]; tagihan: readonly TagihanTerbuka[]; jurnal: readonly JurnalKas[]; aturan: readonly AturanRekon[] };

/** Jarak tanggal paling jauh antara mutasi dan jurnal yang sudah dicatat tangan (transfer sore tercatat besok paginya). */
export const JARAK_JURNAL_HARI = 3;
const JENDELA_HARI = 90;
const hari = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
const kataPanjang = (s: string) => new Set(s.toUpperCase().split(/[^A-Z0-9]+/).filter((w) => w.length >= 4));
// Kekuatan: angka kecil menang. Nomor/nama disebut > jurnal tercatat > nominal unik > aturan.
const KUAT: Record<AlasanRekon, number> = { nomor_invoice: 1, nomor_tagihan: 1, nama_nominal: 2, nama_pemasok: 2, sudah_tercatat: 3, nominal_unik: 4, nominal_tagihan: 4, aturan: 5 };

function usulanTagihan(m: Mutasi, tagihan: readonly TagihanTerbuka[]): { usulan?: Usulan; kandidat: string[] } {
  if (m.arah !== "DB") return { kandidat: [] };
  const dalam = tagihan.filter((t) => t.tanggal <= m.tanggal && hari(m.tanggal, t.jatuh_tempo) <= JENDELA_HARI);
  const ket = huruf(m.keterangan);
  const nomor = dalam.filter((t) => t.nomor_pemasok && huruf(t.nomor_pemasok).length >= 3 && ket.includes(huruf(t.nomor_pemasok)) && m.jumlah <= t.sisa);
  const sama = dalam.filter((t) => t.sisa === m.jumlah);
  const nama = sama.filter((t) => namaDisebut(t.pemasok, m.keterangan));
  const kandidat = [...new Set([...nomor, ...nama, ...sama].map((t) => t.id))];
  if (nomor.length === 1) return { usulan: { jenis: "tagihan_beli", target: nomor[0].id, alasan: "nomor_tagihan" }, kandidat };
  if (nama.length === 1) return { usulan: { jenis: "tagihan_beli", target: nama[0].id, alasan: "nama_pemasok" }, kandidat };
  // Nominal unik hanya bila keterangan tidak menyebut nama pemasok lain yang punya tagihan.
  const sebutLain = dalam.some((t) => namaDisebut(t.pemasok, m.keterangan));
  if (sama.length === 1 && !sebutLain && TRANSFER.test(m.keterangan.toUpperCase())) return { usulan: { jenis: "tagihan_beli", target: sama[0].id, alasan: "nominal_tagihan" }, kandidat };
  return { kandidat };
}

function usulanJurnal(m: Mutasi, jurnal: readonly JurnalKas[]): { usulan?: Usulan; kandidat: string[] } {
  const sama = jurnal.filter((j) => j.arah === m.arah && j.jumlah === m.jumlah && Math.abs(hari(m.tanggal, j.tanggal)) <= JARAK_JURNAL_HARI);
  const kandidat = sama.map((j) => j.id);
  if (sama.length === 1) return { usulan: { jenis: "jurnal", target: sama[0].id, alasan: "sudah_tercatat" }, kandidat };
  if (sama.length > 1) {
    // Beberapa jurnal bernilai sama: pilih yang keterangannya berbagi kata dengan mutasi, bila hanya satu.
    const k = kataPanjang(m.keterangan);
    const berbagi = sama.filter((j) => [...kataPanjang(j.keterangan)].some((w) => k.has(w)));
    if (berbagi.length === 1) return { usulan: { jenis: "jurnal", target: berbagi[0].id, alasan: "sudah_tercatat" }, kandidat };
  }
  return { kandidat };
}

function usulanAturan(m: Mutasi, aturan: readonly AturanRekon[]): Usulan | undefined {
  const ket = ` ${m.keterangan.toUpperCase().replace(/[^A-Z0-9]+/g, " ")} `;
  const cocok = aturan.filter((a) => (a.arah === null || a.arah === m.arah) && ket.includes(` ${a.kata.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim()} `));
  const akun = [...new Set(cocok.map((a) => a.akun_kode))];
  return akun.length === 1 ? { jenis: "akun", target: akun[0], alasan: "aturan" } : undefined;
}

export function usulkanRekon(mutasi: readonly Mutasi[], k: Konteks): HasilRekon[] {
  const inv = cocokkan(mutasi, k.invoice);
  const ALASAN_INV: Record<string, AlasanRekon> = { "nomor invoice disebut": "nomor_invoice", "nama pelanggan dan nominal sama": "nama_nominal", "nominal sama, satu-satunya tagihan sebesar itu": "nominal_unik" };
  const hasil: HasilRekon[] = mutasi.map((m, indeks) => {
    const calon: Usulan[] = [];
    const kandidat: HasilRekon["kandidat"] = inv[indeks].kandidat.map((target) => ({ jenis: "invoice", target }));
    if (inv[indeks].invoice) calon.push({ jenis: "invoice", target: inv[indeks].invoice!, alasan: ALASAN_INV[inv[indeks].alasan!] ?? "nominal_unik" });
    const t = usulanTagihan(m, k.tagihan);
    if (t.usulan) calon.push(t.usulan);
    kandidat.push(...t.kandidat.map((target) => ({ jenis: "tagihan_beli" as const, target })));
    const j = usulanJurnal(m, k.jurnal);
    if (j.usulan) calon.push(j.usulan);
    kandidat.push(...j.kandidat.map((target) => ({ jenis: "jurnal" as const, target })));
    const a = usulanAturan(m, k.aturan);
    if (a) calon.push(a);
    calon.sort((x, y) => KUAT[x.alasan] - KUAT[y.alasan]);
    // Dua jawaban berbeda dengan kekuatan sama: ragu, biarkan pemilik memilih.
    const usulan = calon.length && (calon.length === 1 || KUAT[calon[0].alasan] < KUAT[calon[1].alasan]) ? calon[0] : undefined;
    return { indeks, usulan, kandidat };
  });
  // Satu jurnal atau tagihan hanya untuk satu mutasi: klaim terkuat menang, sama kuat dilepas.
  const per = new Map<string, number[]>();
  hasil.forEach((h) => { if (h.usulan && h.usulan.jenis !== "akun") per.set(`${h.usulan.jenis}:${h.usulan.target}`, [...(per.get(`${h.usulan.jenis}:${h.usulan.target}`) ?? []), h.indeks]); });
  for (const daftar of per.values()) {
    if (daftar.length < 2) continue;
    const kuat = Math.min(...daftar.map((i) => KUAT[hasil[i].usulan!.alasan]));
    const menang = daftar.filter((i) => KUAT[hasil[i].usulan!.alasan] === kuat);
    for (const i of daftar) if (menang.length > 1 || !menang.includes(i)) hasil[i].usulan = undefined;
  }
  return hasil;
}
