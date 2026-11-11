import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { KepalaHalaman } from "@/components/app/kepala-halaman";
import { PembangunMod } from "@/components/app/pembangun-mod";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Susun fitur | Tambah fitur" };

// X-16 susun fitur tambahan lewat formulir, tanpa menulis JSON. Hanya pemilik/admin (sama dengan jalur draf lain).
async function Isi() {
  const sesi = await wajibPerusahaan();
  if (sesi.peran !== "pemilik" && sesi.peran !== "admin") {
    return (<><KepalaHalaman jalur="/app/tambah-fitur" judul="Susun fitur" labelJejak="Susun fitur" />
      <p className="mt-6 text-sm text-tinta-2">Hanya pemilik atau admin yang bisa menyusun fitur.</p></>);
  }
  const { data } = await (await createClient()).from("mod").select("kode");
  return (
    <>
      <KepalaHalaman jalur="/app/tambah-fitur" judul="Susun fitur" labelJejak="Susun fitur"
        ket="Tulis nama fitur, bagian, dan isiannya. Nadi menyusunnya, memeriksanya, lalu menyimpannya sebagai draf yang kamu terapkan." />
      <p className="mt-4 text-sm text-tinta-2">Butuh rumus, rujukan antarbagian, atau pengingat otomatis? Mulai dari <Link href="/app/tambah-fitur#paket" className="underline underline-offset-4">paket resmi</Link> atau minta <Link href="/app/tambah-fitur#ai" className="underline underline-offset-4">AI-mu</Link>.</p>
      <div className="mt-6"><PembangunMod kodeSudah={(data ?? []).map((m) => m.kode as string)} /></div>
    </>
  );
}

export default function HalamanSusunFitur() {
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10">
      <Suspense fallback={<div aria-hidden className="h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" />}>
        <Isi />
      </Suspense>
    </main>
  );
}
