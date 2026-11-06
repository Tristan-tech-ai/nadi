import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { KalkulatorGaji, KalkulatorPesangon, KalkulatorThr } from "@/components/alat/kalkulator";
import { HalamanInfo } from "@/components/landing/halaman-info";
import { aturanPublik } from "@/lib/alat/aturan";
import type { AturanKompensasi, AturanPesangon } from "@/lib/gaji/pesangon";
import { hariIni } from "@/lib/izin";

export const ALAT = [
  { slug: "gaji", judul: "Kalkulator gaji bersih", ringkas: "Gaji pokok dan tunjangan jadi gaji bersih: PPh 21 (TER), BPJS, lembur, dan biaya usaha.", kunci: ["pph21.ter", "pph21.kategori", "bpjs.kesehatan", "bpjs.jht", "bpjs.jp", "bpjs.jkk.pemberi_kerja", "bpjs.jkm.pemberi_kerja", "lembur.pp35"] },
  { slug: "thr", judul: "Kalkulator THR", ringkas: "THR keagamaan menurut masa kerja, dan batas tanggal bayarnya.", kunci: [] },
  { slug: "pesangon", judul: "Kalkulator pesangon", ringkas: "Uang pesangon dan penghargaan masa kerja, atau kompensasi karyawan kontrak.", kunci: ["pesangon.pp35", "kompensasi.pkwt"] },
] as const;
export type SlugAlat = (typeof ALAT)[number]["slug"];

const ZONA = "Asia/Jakarta";
const DASAR: Record<SlugAlat, string> = {
  gaji: "PPh 21 memakai tarif efektif (TER) PP 58/2023 dan PMK 168/2023; BPJS menurut tarif resmi masing-masing program; lembur PP 35/2021 Pasal 31. Hanya aturan yang sudah diperiksa ke teks resmi yang dipakai; yang belum disebut di bawah hasil.",
  thr: "Permenaker 6/2016: berhak setelah 1 bulan masa kerja; 12 bulan atau lebih = 1 bulan upah; kurang dari itu proporsional; dibayar paling lambat 7 hari sebelum Hari Raya. Upah = gaji pokok + tunjangan tetap.",
  pesangon: "PP 35/2021 Pasal 40 (pesangon dan penghargaan masa kerja) dan Pasal 15 sampai 17 (kompensasi PKWT), dengan upah pokok + tunjangan tetap. Angka sungguhan tergantung alasan berhenti.",
};

async function Isi({ slug }: { slug: SlugAlat }) {
  await connection();
  const hari = hariIni(new Date(), ZONA);
  const { aturan, sumber } = await aturanPublik(hari);
  const alat = ALAT.find((a) => a.slug === slug)!;
  const dipakai = sumber.filter((s) => (alat.kunci as readonly string[]).includes(s.kunci));
  const pakai = <T,>(k: string) => (aturan[k]?.terverifikasi ? (aturan[k]!.nilai as T) : null);
  return (
    <>
      {slug === "gaji" ? <KalkulatorGaji aturan={aturan} bulanIni={Number(hari.slice(5, 7))} /> : null}
      {slug === "thr" ? <KalkulatorThr hariIni={hari} /> : null}
      {slug === "pesangon" ? <KalkulatorPesangon aturan={pakai<AturanPesangon>("pesangon.pp35")} kompensasi={pakai<AturanKompensasi>("kompensasi.pkwt")} hariIni={hari} /> : null}
      {dipakai.length ? (
        <details className="mt-8 text-[15px]" data-testid="sumber-aturan">
          <summary className="cursor-pointer font-semibold">Aturan yang dipakai (sama dengan aplikasi Nadi)</summary>
          <ul className="mt-2 grid gap-1">{dipakai.map((s) => <li key={s.kunci}>{s.kunci}: berlaku {s.berlaku_dari}{s.terverifikasi ? "" : ", belum diperiksa ke teks resmi sehingga tidak dihitung"}{s.sumber ? `. Sumber: ${s.sumber}` : ""}</li>)}</ul>
        </details>
      ) : null}
    </>
  );
}

export function HalamanAlat({ slug }: { slug: SlugAlat }) {
  const alat = ALAT.find((a) => a.slug === slug)!;
  return (
    <HalamanInfo judul={alat.judul} pengantar={`${alat.ringkas} Gratis, tanpa akun. Angka dihitung di peramban dan tidak disimpan.`} warna="daun">
      <nav aria-label="Jejak" className="mb-6 text-[15px] text-tinta-2"><Link href="/alat" className="underline underline-offset-4">Alat gratis</Link> / {alat.judul}</nav>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}><Isi slug={slug} /></Suspense>
      <p className="mt-8 text-[15px]">{DASAR[slug]}</p>
      <p className="mt-4 text-[15px]">Hasil ini perkiraan untuk bulan biasa. Di Nadi, hitungan yang sama berjalan untuk semua karyawan sekaligus, lengkap dengan slip, Desember yang disetahunkan, dan Gerbang Gaji. <Link href="/demo" className="underline underline-offset-4">Coba Nadi tanpa daftar</Link>.</p>
    </HalamanInfo>
  );
}

export function IndeksAlat() {
  return (
    <HalamanInfo judul="Alat gratis" pengantar="Hitung gaji, THR, dan pesangon tanpa akun, dengan rumus dan aturan yang sama dengan aplikasi Nadi." warna="daun">
      <ul className="grid gap-3">
        {ALAT.map((a) => (
          <li key={a.slug}>
            <Link href={`/alat/${a.slug}`} className="block rounded-[var(--radius-kartu)] border border-garis p-4 hover:bg-kertas-2" data-testid="kartu-alat">
              <span className="font-semibold">{a.judul}</span>
              <span className="mt-1 block text-[15px] text-tinta-2">{a.ringkas}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-[15px] text-tinta-2">Ada pertanyaan cara memakai Nadi? Buka <Link href="/bantuan" className="underline underline-offset-4">Pusat bantuan</Link>.</p>
    </HalamanInfo>
  );
}
