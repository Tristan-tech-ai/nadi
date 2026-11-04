import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { pindahPerusahaan } from "@/app/app/actions";
import { AiMilikmu } from "@/components/app/ai-milikmu";
import { AlurUsaha } from "@/components/app/alur-usaha";
import { AturanKerja } from "@/components/app/aturan-kerja";
import { HematAi } from "@/components/app/hemat-ai";
import { KebijakanIzin } from "@/components/app/kebijakan-izin";
import { KeputusanOtomatis } from "@/components/app/keputusan-otomatis";
import { Pemberitahuan } from "@/components/app/pemberitahuan";
import { TabletAbsen } from "@/components/app/tablet-absen";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { wajibSesi } from "@/lib/sesi";

export const metadata: Metadata = { title: "Usahamu" };

async function Daftar() {
  const sesi = await wajibSesi();
  const kamus = ambilKamus(await bahasaAplikasi(sesi.bahasa));
  const t = kamus.usaha;
  const supabase = await createClient();
  const { data } = await supabase.from("anggota").select("peran, perusahaan:perusahaan_id(id, nama, industri)").eq("user_id", sesi.userId).eq("aktif", true);
  const baris = (data ?? []).flatMap((a) => {
    const p = Array.isArray(a.perusahaan) ? a.perusahaan[0] : a.perusahaan;
    return p ? [{ id: p.id as string, nama: p.nama as string, peran: a.peran as string }] : [];
  });
  if (!baris.length) {
    return (
      <p className="mt-6 text-tinta-2">
        {t.belumTerdaftar} <Link href="/app/mulai" className="font-semibold text-tinta underline underline-offset-4">{t.siapkanPertama}</Link>.
      </p>
    );
  }
  return (
    <ul className="mt-6 divide-y divide-garis border-y border-garis">
      {baris.map((b) => (
        <li key={b.id} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="truncate font-semibold" data-pengguna>{b.nama}</p>
            <p className="text-sm text-tinta-2">{kamus.feed.namaPeran[b.peran as keyof typeof kamus.feed.namaPeran] ?? b.peran}</p>
          </div>
          {b.id === sesi.perusahaanId ? (
            <span className="text-sm text-daun">{t.sedangDibuka}</span>
          ) : (
            <form action={pindahPerusahaan}>
              <input type="hidden" name="perusahaan" value={b.id} />
              <button type="submit" className="h-10 rounded-[var(--radius-isian)] border border-garis-kuat px-3 text-sm font-semibold">{t.buka}</button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}

async function BagianPemberitahuan() {
  const sesi = await wajibSesi();
  const kamus = ambilKamus(await bahasaAplikasi(sesi.bahasa));
  const supabase = await createClient();
  const { data } = await supabase.rpc("kunci_push_publik");
  return <Pemberitahuan kunciPublik={(data as string | null) ?? null} teks={kamus.pemberitahuan} />;
}

/** Judul dan tautan halaman: bahasa dibaca dari akun dan cookie, jadi ikut di balik Suspense. */
async function Kepala() {
  const sesi = await wajibSesi();
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  return <KepalaIsi t={ambilKamus(bahasa).usaha} bahasa={bahasa} />;
}

function KepalaIsi({ t, bahasa }: { t: ReturnType<typeof ambilKamus>["usaha"]; bahasa: Bahasa }) {
  return (
    <div lang={bahasa}>
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">{t.judul}</h1>
      <p className="mt-2 text-tinta-2">{t.ket}</p>
    </div>
  );
}

async function Tautan() {
  const sesi = await wajibSesi();
  const t = ambilKamus(await bahasaAplikasi(sesi.bahasa)).usaha;
  return (
    <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
      <Link href="/app/mulai" className="underline underline-offset-4">{t.tambahUsaha}</Link>
      <Link href="/app/surat" className="underline underline-offset-4">{t.agendaSurat}</Link>
      <Link href="/app/surat-keluar" className="underline underline-offset-4">{t.suratKeluar}</Link>
      <Link href="/app/invoice" className="underline underline-offset-4">{t.invoice}</Link>
      <Link href="/app/barang" className="underline underline-offset-4">{t.barang}</Link>
      <Link href="/app/jual" className="underline underline-offset-4">{t.jual}</Link>
      <Link href="/app/beli" className="underline underline-offset-4">{t.beli}</Link>
      <Link href="/app/kas" className="underline underline-offset-4">{t.kas}</Link>
      <Link href="/app/buku" className="underline underline-offset-4">{t.buku}</Link>
      <Link href="/app/pajak" className="underline underline-offset-4">{t.pajak}</Link>
      <Link href="/app/akuntan" className="underline underline-offset-4">{t.akuntan}</Link>
      <Link href="/app/mata" className="underline underline-offset-4">{t.mata}</Link>
      <Link href="/app/peta-usaha" className="underline underline-offset-4">{t.peta}</Link>
    </p>
  );
}

export default function Perusahaan() {
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-10">
      <Suspense fallback={<div className="h-20 animate-pulse rounded-[var(--radius-isian)] bg-kertas-2" aria-hidden />}>
        <Kepala />
      </Suspense>
      <Suspense fallback={<div className="mt-6 h-24 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Daftar />
      </Suspense>
      <Suspense fallback={<div className="mt-6 h-12 animate-pulse rounded-[var(--radius-isian)] bg-kertas-2" aria-hidden />}>
        <Tautan />
      </Suspense>
      <Suspense fallback={<div className="mt-10 h-28 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <BagianPemberitahuan />
      </Suspense>
      <Suspense fallback={<div className="mt-10 h-72 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <AturanKerja />
      </Suspense>
      <Suspense fallback={<div className="mt-10 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <KebijakanIzin />
      </Suspense>
      <Suspense fallback={<div className="mt-10 h-40 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <KeputusanOtomatis />
      </Suspense>
      <Suspense fallback={<div className="mt-10 h-28 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <TabletAbsen />
      </Suspense>
      <Suspense fallback={<div className="mt-10 h-28 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <AiMilikmu />
      </Suspense>
      <Suspense fallback={<div className="mt-10 h-32 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <HematAi />
      </Suspense>
      <Suspense fallback={<div className="mt-10 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <AlurUsaha />
      </Suspense>
    </main>
  );
}
