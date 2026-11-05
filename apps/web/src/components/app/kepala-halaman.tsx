import Link from "next/link";
import type { ReactNode } from "react";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { halamanDari, ruangUntuk, RUANG } from "@/lib/ruang";
import { bacaSesi } from "@/lib/sesi";

// U-03 kepala halaman seragam (docs/design/REKONSTRUKSI-APP.md bagian 5): jejak ruang, judul, satu kalimat tujuan, aksi utama,
// dan tombol "?" yang membuka bantuan halaman ini (guna, halaman lain di ruang yang sama, panduan peran, cari fitur).
// Judul tetap dari kamus halaman (sudah diterjemahkan dan dipakai tes); kalimat tujuan bawaan dari peta ruang.
// Dipanggil di dalam <Suspense> halaman (membaca sesi). Tes statis src/lib/kepala-halaman.test.ts menolak halaman /app tanpa komponen ini.
export async function KepalaHalaman({ jalur, judul, ket, aksi, children }: {
  jalur: string; judul: ReactNode; ket?: ReactNode; aksi?: ReactNode; children?: ReactNode;
}) {
  const sesi = await bacaSesi();
  const b = await bahasaAplikasi(sesi?.bahasa ?? null);
  const en = b === "en";
  const kini = halamanDari(jalur);
  const ruang = kini ? RUANG.find((r) => r.id === kini.ruang) : undefined;
  const peran = sesi?.peran ?? "pemilik";
  const tetangga = kini ? (ruangUntuk(peran).find((r) => r.id === kini.ruang)?.halaman ?? []).filter((x) => x.href !== kini.href) : [];
  const anchorPanduan = peran === "akuntan" ? "akuntan" : peran === "staf" ? "staf" : peran === "admin" ? "admin" : "pemilik";
  return (
    <div className="kepala-halaman" data-kepala-halaman={jalur}>
      {ruang && kini && (
        <nav aria-label={en ? "You are here" : "Kamu di sini"} className="mb-2 text-sm text-tinta-2">
          <ol className="flex flex-wrap items-center gap-1">
            <li><Link href={`/app/menu#menu-${ruang.id}`} className="underline-offset-4 hover:text-tinta hover:underline">{ruang.label[b]}</Link></li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="text-tinta">{kini.label[b]}</li>
          </ol>
        </nav>
      )}
      <div className="flex items-start justify-between gap-3">
        <h1 className="min-w-0 font-judul text-3xl font-extrabold tracking-tight">{judul}</h1>
        <details className="group relative shrink-0 print:hidden">
          <summary className="inline-flex h-10 min-w-10 cursor-pointer list-none items-center justify-center rounded-full border border-garis px-3 text-sm font-semibold text-tinta-2 hover:bg-kertas-2 hover:text-tinta group-open:bg-kertas-2 group-open:text-tinta">
            <span className="sr-only">{en ? "Help for this page" : "Bantuan halaman ini"}</span><span aria-hidden>?</span>
          </summary>
          <div className="absolute right-0 top-12 z-20 w-[min(20rem,calc(100vw-2.5rem))] rounded-[var(--radius-kartu)] border border-garis bg-kertas p-4 text-sm shadow-sm">
            {kini && <p className="text-tinta">{kini.guna[b]}</p>}
            {tetangga.length > 0 && (
              <>
                <p className="mt-3 font-semibold">{en ? `Also in ${ruang?.label.en}` : `Juga di ruang ${ruang?.label.id}`}</p>
                <ul className="mt-1 grid gap-1">{tetangga.slice(0, 6).map((x) => (
                  <li key={x.href}><Link href={x.href} className="underline underline-offset-4">{x.label[b]}</Link></li>))}</ul>
              </>
            )}
            <p className="mt-3 grid gap-1">
              <Link href={`/panduan#${anchorPanduan}`} className="font-semibold underline underline-offset-4">{en ? "Guide for your role" : "Panduan untuk peranmu"}</Link>
              <span className="text-tinta-2">{en ? "Looking for something else? Press Ctrl K or the Search button." : "Cari yang lain? Tekan Ctrl K atau tombol Cari."}</span>
            </p>
          </div>
        </details>
      </div>
      {(ket ?? kini?.guna[b]) && <p className="mt-1 max-w-2xl text-sm text-tinta-2">{ket ?? kini?.guna[b]}</p>}
      {aksi && <div className="mt-4 flex flex-wrap items-center gap-2">{aksi}</div>}
      {children}
    </div>
  );
}
