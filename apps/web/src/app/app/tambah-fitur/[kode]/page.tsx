import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { KepalaHalaman } from "@/components/app/kepala-halaman";
import { RincianMod } from "@/components/app/pratinjau-mod";
import { TombolAturMod, TombolPasang } from "@/components/app/tambah-fitur";
import { paketResmi } from "@/lib/mod/katalog";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";

// X-14 halaman rincian satu paket resmi: untuk siapa, contoh pemakaian, setiap isian, alur status, akses per peran, otomasi,
// dan laporan, lalu Pasang. Isi diambil dari manifest yang sama dengan yang dipasang, jadi tidak bisa berbeda diam-diam.
export async function generateMetadata({ params }: PageProps<"/app/tambah-fitur/[kode]">): Promise<Metadata> {
  const p = paketResmi((await params).kode);
  return { title: p ? `${p.manifest.nama} | Tambah fitur` : "Tambah fitur" };
}

async function Isi({ params }: { params: PageProps<"/app/tambah-fitur/[kode]">["params"] }) {
  const { kode } = await params;
  const p = paketResmi(kode);
  if (!p) notFound();
  const sesi = await wajibPerusahaan();
  const m = p.manifest;
  const pengelola = sesi.peran === "pemilik" || sesi.peran === "admin";
  const { data: ada } = pengelola ? await (await createClient()).from("mod").select("id, status").eq("kode", m.kode).neq("status", "draf").maybeSingle() : { data: null };
  return (
    <div data-paket-rincian={m.kode}>
      <KepalaHalaman jalur="/app/tambah-fitur" judul={m.nama} ket={m.deskripsi} labelJejak={m.nama} />
      <section aria-labelledby="judul-untuk" className="mt-6 grid gap-2 text-sm">
        <h2 id="judul-untuk" className="sr-only">Untuk siapa</h2>
        <p><span className="font-semibold">Cocok untuk:</span> {p.untuk}</p>
        <p className="text-tinta-2"><span className="font-semibold text-tinta">Contoh:</span> {p.contoh}</p>
      </section>
      <div className="mt-5 flex flex-wrap items-center gap-3" data-testid="aksi-paket" data-terpasang={ada?.status ?? "belum"}>
        {!pengelola ? <p className="text-sm text-tinta-2">Hanya pemilik atau admin yang bisa memasang paket.</p>
          : ada?.status === "aktif" ? <><Link href={`/app/mod/${m.kode}`} className="font-semibold underline underline-offset-4">Buka {m.nama}</Link><TombolAturMod id={ada.id as string} aksi="matikan" nama={m.nama} /></>
          : ada?.status === "mati" ? <TombolAturMod id={ada.id as string} aksi="nyalakan" nama={m.nama} />
          : <TombolPasang kode={m.kode} nama={m.nama} />}
        <Link href={`/bantuan/artikel/paket-${m.kode}`} className="text-sm text-tinta-2 underline underline-offset-4">Panduan memakai {m.nama}</Link>
      </div>
      <p className="mt-2 text-sm text-tinta-2">Melepas paket hanya menyembunyikannya dari menu; catatannya tetap tersimpan dan tampil lagi saat dipasang kembali.</p>
      <h2 className="mt-8 text-lg font-semibold">Isi paket</h2>
      <div className="mt-3"><RincianMod m={m} /></div>
      <p className="mt-8 text-sm"><Link href="/app/tambah-fitur#paket" className="underline underline-offset-4">Kembali ke semua paket resmi</Link></p>
    </div>
  );
}

export default function HalamanPaket(props: PageProps<"/app/tambah-fitur/[kode]">) {
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10">
      <Suspense fallback={<div aria-hidden className="h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" />}>
        <Isi params={props.params} />
      </Suspense>
    </main>
  );
}
