import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { HalamanInfo } from "@/components/landing/halaman-info";
import { cariIstilah, ISTILAH, type Istilah } from "@/lib/kamus-istilah";

export const metadata: Metadata = {
  title: "Kamus istilah usaha | Nadi",
  description: "Arti istilah pajak, gaji, BPJS, dan pembukuan dalam bahasa sehari-hari: PPh 21, TER, PTKP, THR, pesangon, piutang, QRIS, dan lainnya.",
  alternates: { canonical: "/kamus" },
};

function Daftar({ isi }: { isi: Istilah[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {isi.map((i) => (
        <li key={i.slug}>
          <Link href={`/kamus/${i.slug}`} className="block h-full rounded-[var(--radius-kartu)] border border-garis p-4 hover:bg-kertas-2" data-testid="kartu-istilah">
            <span className="font-semibold">{i.istilah}</span>
            <span className="mt-1 block text-[15px] text-tinta-2">{i.arti}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Cari({ q }: { q: string }) {
  return (
    <form action="/kamus" method="get" role="search" aria-label="Cari di kamus" className="flex flex-wrap gap-2">
      <label htmlFor="cari-istilah" className="sr-only">Cari istilah</label>
      <input id="cari-istilah" name="q" type="search" defaultValue={q} placeholder="Misalnya: PTKP, pesangon, piutang"
        className="h-12 min-w-0 flex-1 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base" />
      <button type="submit" className="h-12 rounded-[var(--radius-isian)] bg-tinta px-5 font-semibold text-kertas">Cari</button>
    </form>
  );
}

async function Isi({ searchParams }: { searchParams: PageProps<"/kamus">["searchParams"] }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 60).trim() : "";
  const hasil = q ? cariIstilah(q) : ISTILAH;
  return (
    <>
      <Cari q={q} />
      {q ? <p className="mt-4" role="status">{hasil.length ? `${hasil.length} istilah untuk "${q}".` : `Belum ada istilah untuk "${q}". Coba kata lain.`}</p> : null}
      <div className="mt-6"><Daftar isi={hasil} /></div>
    </>
  );
}

// L-06: kamus istilah publik, setara glosarium Mekari dan Kamus HR Talenta.
export default function Kamus(props: PageProps<"/kamus">) {
  return (
    <HalamanInfo judul="Kamus istilah usaha" pengantar={`${ISTILAH.length} istilah pajak, gaji, BPJS, dan pembukuan dalam bahasa sehari-hari, lengkap dengan tempatnya di Nadi.`} warna="kunyit">
      <Suspense fallback={<><Cari q="" /><div className="mt-6"><Daftar isi={ISTILAH} /></div></>}><Isi searchParams={props.searchParams} /></Suspense>
    </HalamanInfo>
  );
}
