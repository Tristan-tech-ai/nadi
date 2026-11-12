import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CariBantuan, DaftarKategori, HasilCari, judulPusat } from "@/components/bantuan/pusat";
import { HalamanInfo } from "@/components/landing/halaman-info";

export const metadata: Metadata = {
  title: "Nadi help center",
  description: "How to use every Nadi screen: sign in, Drop files, Feed, invoices, payroll, Mata, AI, and data security.",
  alternates: { canonical: "/en/bantuan", languages: { id: "/bantuan", en: "/en/bantuan" } },
};

async function Cari({ searchParams }: { searchParams: PageProps<"/en/bantuan">["searchParams"] }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80).trim() : "";
  return <><CariBantuan q={q} bahasa="en" />{q ? <HasilCari q={q} bahasa="en" /> : null}</>;
}

// L-04 pusat bantuan (L-08 versi en): satu artikel untuk setiap layar aplikasi ditambah artikel tugas yang paling sering ditanya.
export default function PusatBantuan(props: PageProps<"/en/bantuan">) {
  const { judul, pengantar } = judulPusat("en");
  return (
    <HalamanInfo judul={judul} pengantar={pengantar} warna="laut" bahasa="en">
      <Suspense fallback={<CariBantuan q="" bahasa="en" />}><Cari searchParams={props.searchParams} /></Suspense>
      <p className="mt-4 text-[15px] text-tinta-2">
        Prefer steps by role? Open the <Link href="/en/panduan" className="underline underline-offset-4">Guide</Link>.
        Want to see it working? <Link href="/demo" className="underline underline-offset-4">Try Nadi without signing up</Link>.
        Free take-home pay, THR, severance, and invoice tools are at <Link href="/en/alat" className="underline underline-offset-4">Free tools</Link>.
      </p>
      <DaftarKategori bahasa="en" />
    </HalamanInfo>
  );
}
