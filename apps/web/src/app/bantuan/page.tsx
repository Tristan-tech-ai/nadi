import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CariBantuan, DaftarKategori, HasilCari } from "@/components/bantuan/pusat";
import { HalamanInfo } from "@/components/landing/halaman-info";
import { SEMUA_ARTIKEL } from "@/lib/bantuan/artikel";

export const metadata: Metadata = {
  title: "Pusat bantuan Nadi",
  description: "Cara memakai setiap layar Nadi: masuk, Lempar, Feed, invoice, gaji, Mata, AI, dan keamanan data.",
  alternates: { canonical: "/bantuan" },
};

async function Cari({ searchParams }: { searchParams: PageProps<"/bantuan">["searchParams"] }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80).trim() : "";
  return <><CariBantuan q={q} />{q ? <HasilCari q={q} /> : null}</>;
}

// L-04 pusat bantuan: satu artikel untuk setiap layar aplikasi (dari peta ruang) ditambah artikel tugas yang paling sering ditanya.
export default function PusatBantuan(props: PageProps<"/bantuan">) {
  return (
    <HalamanInfo judul="Pusat bantuan" pengantar={`${SEMUA_ARTIKEL.length} artikel tentang setiap layar Nadi. Cari, atau pilih topik.`} warna="laut">
      <Suspense fallback={<CariBantuan q="" />}><Cari searchParams={props.searchParams} /></Suspense>
      <p className="mt-4 text-[15px] text-tinta-2">
        Lebih suka langkah per peran? Buka <Link href="/panduan" className="underline underline-offset-4">Panduan</Link>.
        Ingin melihat langsung? <Link href="/demo" className="underline underline-offset-4">Coba Nadi tanpa daftar</Link>.
        Hitung gaji, lembur, atau THR tanpa akun di <Link href="/alat" className="underline underline-offset-4">Alat gratis</Link>.
      </p>
      <DaftarKategori />
    </HalamanInfo>
  );
}
