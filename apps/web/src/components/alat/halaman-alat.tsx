import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PembuatInvoice } from "@/components/alat/cetak";
import { PembuatDokumen } from "@/components/alat/dokumen";
import { KalkulatorGaji, KalkulatorPesangon, KalkulatorThr } from "@/components/alat/kalkulator";
import { HalamanInfo } from "@/components/landing/halaman-info";
import { aturanPublik } from "@/lib/alat/aturan";
import type { AturanKompensasi, AturanPesangon } from "@/lib/gaji/pesangon";
import { CatatanUuBaru } from "@/components/app/catatan-uu-baru";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { hariIni } from "@/lib/izin";

export const ALAT = [
  { slug: "gaji", judul: "Kalkulator gaji bersih", ringkas: "Gaji pokok dan tunjangan jadi gaji bersih: PPh 21 (TER), BPJS, lembur, dan biaya usaha.", kunci: ["pph21.ter", "pph21.kategori", "bpjs.kesehatan", "bpjs.jht", "bpjs.jp", "bpjs.jkk.pemberi_kerja", "bpjs.jkm.pemberi_kerja", "lembur.pp35"],
    en: { judul: "Take-home pay calculator", ringkas: "Base salary and allowances to take-home pay: income tax (PPh 21 TER), BPJS, overtime, and the cost to the business." } },
  { slug: "thr", judul: "Kalkulator THR", ringkas: "THR keagamaan menurut masa kerja, dan batas tanggal bayarnya.", kunci: [],
    en: { judul: "THR calculator", ringkas: "The religious holiday allowance (THR) by length of service, and the latest date to pay it." } },
  { slug: "slip", judul: "Slip gaji online", ringkas: "Slip gaji satu karyawan dari hitungan gaji yang sama, siap dicetak atau disimpan PDF.", kunci: ["pph21.ter", "pph21.kategori", "bpjs.kesehatan", "bpjs.jht", "bpjs.jp", "bpjs.jkk.pemberi_kerja", "bpjs.jkm.pemberi_kerja", "lembur.pp35"],
    en: { judul: "Online payslip", ringkas: "A payslip for one employee from the same pay calculation, ready to print or save as PDF." } },
  { slug: "invoice", judul: "Pembuat invoice", ringkas: "Invoice bernomor dengan barang dan jasa, total otomatis, siap dicetak atau disimpan PDF.", kunci: [],
    en: { judul: "Invoice maker", ringkas: "A numbered invoice with goods and services, automatic total, ready to print or save as PDF." } },
  { slug: "dokumen", judul: "Templat dokumen kerja", ringkas: "Surat keterangan kerja, surat tugas, SK mutasi, surat peringatan, formulir izin, dan berita acara serah terima, siap dicetak.", kunci: [],
    en: { judul: "Workplace document templates", ringkas: "Employment certificate, assignment letter, transfer decree, warning letter, leave form, and handover record, ready to print (letters in Indonesian)." } },
  { slug: "pesangon", judul: "Kalkulator pesangon", ringkas: "Uang pesangon dan penghargaan masa kerja, atau kompensasi karyawan kontrak.", kunci: ["pesangon.pp35", "kompensasi.pkwt"],
    en: { judul: "Severance calculator", ringkas: "Severance and long-service pay, or compensation for fixed-term employees." } },
] as const;
export type SlugAlat = (typeof ALAT)[number]["slug"];

const ZONA = "Asia/Jakarta";
const DASAR: Record<Bahasa, Record<SlugAlat, string>> = {
  id: {
    gaji: "PPh 21 memakai tarif efektif (TER) PP 58/2023 dan PMK 168/2023; BPJS menurut tarif resmi masing-masing program; lembur PP 35/2021 Pasal 31. Hanya aturan yang sudah diperiksa ke teks resmi yang dipakai; yang belum disebut di bawah hasil.",
    thr: "Permenaker 6/2016: berhak setelah 1 bulan masa kerja; 12 bulan atau lebih = 1 bulan upah; kurang dari itu proporsional; dibayar paling lambat 7 hari sebelum Hari Raya. Upah = gaji pokok + tunjangan tetap.",
    slip: "Komponen dan potongan sama dengan Kalkulator gaji bersih: PPh 21 TER (PP 58/2023, PMK 168/2023), BPJS, dan lembur PP 35/2021.",
    dokumen: "Surat keterangan kerja, surat tugas, dan SK mutasi memakai kalimat yang sama dengan Surat keluar di aplikasi Nadi. Surat peringatan mengikuti peraturan perusahaan atau perjanjian kerja usahamu; periksa isinya sebelum ditandatangani.",
    invoice: "Total = jumlah x harga setiap baris, dibulatkan ke rupiah, sama dengan invoice di aplikasi Nadi. Belum memuat PPN; bila usahamu PKP, buat faktur pajak lewat Coretax.",
    pesangon: "PP 35/2021 Pasal 40 (pesangon dan penghargaan masa kerja) dan Pasal 15 sampai 17 (kompensasi PKWT), dengan upah pokok + tunjangan tetap. Angka sungguhan tergantung alasan berhenti.",
  },
  en: {
    gaji: "Income tax uses the effective rates (TER) of PP 58/2023 and PMK 168/2023; BPJS uses each programme's official rates; overtime follows PP 35/2021 Article 31. Only rules checked against the official text are used; any that are not yet checked are named below the result.",
    thr: "Permenaker 6/2016: entitled after 1 month of service; 12 months or more = 1 month of wages; less than that is pro rata; paid no later than 7 days before the holiday. Wage = base salary + fixed allowance.",
    slip: "Earnings and deductions are the same as the take-home pay calculator: income tax TER (PP 58/2023, PMK 168/2023), BPJS, and overtime under PP 35/2021.",
    dokumen: "The employment certificate, assignment letter, and transfer decree use the same sentences as Outgoing letters in the Nadi app. The letters are written in Indonesian because they are used in Indonesian workplaces. A warning letter follows your company regulations or employment agreement; check it before signing.",
    invoice: "Total = quantity x price for each line, rounded to the rupiah, the same as invoices in the Nadi app. VAT is not included; if your business is a VAT-registered (PKP) business, issue the tax invoice through Coretax.",
    pesangon: "PP 35/2021 Article 40 (severance and long-service pay) and Articles 15 to 17 (fixed-term compensation), using base salary + fixed allowance. The real amount depends on the reason the job ends.",
  },
};

const UMUM = {
  id: {
    aturan: "Aturan yang dipakai (sama dengan aplikasi Nadi)", berlaku: "berlaku", belum: ", belum diperiksa ke teks resmi sehingga tidak dihitung", sumber: "Sumber",
    gratis: "Gratis, tanpa akun. Angka dihitung di peramban dan tidak disimpan.", jejak: "Jejak", indeks: "Alat gratis",
    dokumen: "Di Nadi, surat diberi nomor otomatis dan disimpan di arsip Surat keluar.", invoice: "Di Nadi, invoice bernomor otomatis, punya tautan untuk pelanggan, QRIS, pengingat, dan dicocokkan dengan mutasi bank.",
    gaji: "Hasil ini perkiraan untuk bulan biasa. Di Nadi, hitungan yang sama berjalan untuk semua karyawan sekaligus, lengkap dengan slip, Desember yang disetahunkan, dan Gerbang Gaji.",
    coba: "Coba Nadi tanpa daftar", judulIndeks: "Alat gratis", pengantarIndeks: "Hitung gaji, THR, dan pesangon, buat slip gaji dan invoice, tanpa akun, dengan rumus dan aturan yang sama dengan aplikasi Nadi.",
    tanya: "Ada pertanyaan cara memakai Nadi? Buka", pusat: "Pusat bantuan",
  },
  en: {
    aturan: "Rules used (the same as the Nadi app)", berlaku: "effective", belum: ", not yet checked against the official text so not counted", sumber: "Source",
    gratis: "Free, no account. Numbers are calculated in your browser and not saved.", jejak: "Breadcrumb", indeks: "Free tools",
    dokumen: "In Nadi, letters are numbered automatically and kept in the Outgoing letters archive.", invoice: "In Nadi, invoices are numbered automatically and come with a customer link, QRIS, reminders, and bank statement matching.",
    gaji: "This is an estimate for a normal month. In Nadi, the same calculation runs for every employee at once, with payslips, an annualised December, and the Payroll gate.",
    coba: "Try Nadi without signing up", judulIndeks: "Free tools", pengantarIndeks: "Calculate pay, THR, and severance, and make payslips and invoices, without an account, using the same formulas and rules as the Nadi app.",
    tanya: "Questions about using Nadi? Open the", pusat: "Help center",
  },
} as const;

const awalan = (b: Bahasa) => (b === "en" ? "/en" : "");

async function Isi({ slug, bahasa }: { slug: SlugAlat; bahasa: Bahasa }) {
  await connection();
  const u = UMUM[bahasa];
  const hari = hariIni(new Date(), ZONA);
  const { aturan, sumber } = await aturanPublik(hari);
  const alat = ALAT.find((a) => a.slug === slug)!;
  const dipakai = sumber.filter((s) => (alat.kunci as readonly string[]).includes(s.kunci));
  const pakai = <T,>(k: string) => (aturan[k]?.terverifikasi ? (aturan[k]!.nilai as T) : null);
  return (
    <>
      {slug === "gaji" ? <KalkulatorGaji aturan={aturan} bulanIni={Number(hari.slice(5, 7))} bahasa={bahasa} /> : null}
      {slug === "slip" ? <KalkulatorGaji aturan={aturan} bulanIni={Number(hari.slice(5, 7))} slip bahasa={bahasa} /> : null}
      {slug === "invoice" ? <PembuatInvoice hariIni={hari} bahasa={bahasa} /> : null}
      {slug === "dokumen" ? <PembuatDokumen hariIni={hari} bahasa={bahasa} /> : null}
      {slug === "thr" ? <KalkulatorThr hariIni={hari} bahasa={bahasa} /> : null}
      {slug === "pesangon" ? <KalkulatorPesangon aturan={pakai<AturanPesangon>("pesangon.pp35")} kompensasi={pakai<AturanKompensasi>("kompensasi.pkwt")} hariIni={hari} bahasa={bahasa} /> : null}
      {dipakai.length ? (
        <details className="mt-8 text-[15px]" data-testid="sumber-aturan">
          <summary className="cursor-pointer font-semibold">{u.aturan}</summary>
          <ul className="mt-2 grid gap-1">{dipakai.map((s) => <li key={s.kunci}>{s.kunci}: {u.berlaku} {s.berlaku_dari}{s.terverifikasi ? "" : u.belum}{s.sumber ? `. ${u.sumber}: ${s.sumber}` : ""}</li>)}</ul>
        </details>
      ) : null}
    </>
  );
}

export function HalamanAlat({ slug, bahasa = "id" }: { slug: SlugAlat; bahasa?: Bahasa }) {
  const alat = ALAT.find((a) => a.slug === slug)!;
  const u = UMUM[bahasa];
  const judul = bahasa === "en" ? alat.en.judul : alat.judul;
  const ringkas = bahasa === "en" ? alat.en.ringkas : alat.ringkas;
  const tambahan = slug === "dokumen" ? u.dokumen : slug === "invoice" ? u.invoice : u.gaji;
  return (
    <HalamanInfo judul={judul} pengantar={`${ringkas} ${u.gratis}`} warna="daun" bahasa={bahasa}>
      <nav aria-label={u.jejak} className="mb-6 text-[15px] text-tinta-2"><Link href={`${awalan(bahasa)}/alat`} className="underline underline-offset-4">{u.indeks}</Link> / {judul}</nav>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}><Isi slug={slug} bahasa={bahasa} /></Suspense>
      <p className="mt-8 text-[15px]">{DASAR[bahasa][slug]}</p>
      <CatatanUuBaru dasar={DASAR[bahasa][slug]} bahasa={bahasa} />
      <p className="mt-4 text-[15px]">{tambahan} <Link href="/demo" className="underline underline-offset-4">{u.coba}</Link>.</p>
    </HalamanInfo>
  );
}

export function IndeksAlat({ bahasa = "id" }: { bahasa?: Bahasa }) {
  const u = UMUM[bahasa];
  return (
    <HalamanInfo judul={u.judulIndeks} pengantar={u.pengantarIndeks} warna="daun" bahasa={bahasa}>
      <ul className="grid gap-3">
        {ALAT.map((a) => (
          <li key={a.slug}>
            <Link href={`${awalan(bahasa)}/alat/${a.slug}`} className="block rounded-[var(--radius-kartu)] border border-garis p-4 hover:bg-kertas-2" data-testid="kartu-alat">
              <span className="font-semibold">{bahasa === "en" ? a.en.judul : a.judul}</span>
              <span className="mt-1 block text-[15px] text-tinta-2">{bahasa === "en" ? a.en.ringkas : a.ringkas}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-[15px] text-tinta-2">{u.tanya} <Link href={`${awalan(bahasa)}/bantuan`} className="underline underline-offset-4">{u.pusat}</Link>.</p>
    </HalamanInfo>
  );
}
