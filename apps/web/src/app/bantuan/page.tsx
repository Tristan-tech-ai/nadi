import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CariBantuan, DaftarKategori, HasilCari, judulPusat } from "@/components/bantuan/pusat";
import { HalamanInfo } from "@/components/landing/halaman-info";

export const metadata: Metadata = {
  title: "Pusat bantuan Nadi",
  description: "Cara memakai setiap layar Nadi: masuk, Lempar, Feed, invoice, gaji, Mata, AI, dan keamanan data.",
  alternates: { canonical: "/bantuan", languages: { id: "/bantuan", en: "/en/bantuan" } },
};

async function Cari({ searchParams }: { searchParams: PageProps<"/bantuan">["searchParams"] }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80).trim() : "";
  return <><CariBantuan q={q} bahasa="id" />{q ? <HasilCari q={q} bahasa="id" /> : null}</>;
}

// L-04 pusat bantuan (L-08 versi en): satu artikel untuk setiap layar aplikasi ditambah artikel tugas yang paling sering ditanya.
export default function PusatBantuan(props: PageProps<"/bantuan">) {
  const { judul, pengantar } = judulPusat("id");
  return (
    <HalamanInfo judul={judul} pengantar={pengantar} warna="laut" bahasa="id">
      <Suspense fallback={<CariBantuan q="" bahasa="id" />}><Cari searchParams={props.searchParams} /></Suspense>
      <p className="mt-4 text-[15px] text-tinta-2">
        Lebih suka langkah per peran? Buka <Link href="/panduan" className="underline underline-offset-4">Panduan</Link>.
        Ingin melihat langsung? <Link href="/demo" className="underline underline-offset-4">Coba Nadi tanpa daftar</Link>.
        Hitung gaji, lembur, atau THR tanpa akun di <Link href="/alat" className="underline underline-offset-4">Alat gratis</Link>, dan cari arti istilah di <Link href="/kamus" className="underline underline-offset-4">Kamus istilah</Link>.
      </p>
      <DaftarKategori bahasa="id" />
    </HalamanInfo>
  );
}
