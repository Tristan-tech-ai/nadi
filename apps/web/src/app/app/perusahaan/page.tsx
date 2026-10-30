import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { pindahPerusahaan } from "@/app/app/actions";
import { Pemberitahuan } from "@/components/app/pemberitahuan";
import { createClient } from "@/lib/supabase/server";
import { wajibSesi } from "@/lib/sesi";

export const metadata: Metadata = { title: "Usahamu" };

async function Daftar() {
  const sesi = await wajibSesi();
  const supabase = await createClient();
  const { data } = await supabase.from("anggota").select("peran, perusahaan:perusahaan_id(id, nama, industri)").eq("user_id", sesi.userId).eq("aktif", true);
  const baris = (data ?? []).flatMap((a) => {
    const p = Array.isArray(a.perusahaan) ? a.perusahaan[0] : a.perusahaan;
    return p ? [{ id: p.id as string, nama: p.nama as string, peran: a.peran as string }] : [];
  });
  if (!baris.length) {
    return (
      <p className="mt-6 text-tinta-2">
        Kamu belum terdaftar di usaha mana pun. <Link href="/app/mulai" className="font-semibold text-tinta underline underline-offset-4">Siapkan usaha pertamamu</Link>.
      </p>
    );
  }
  return (
    <ul className="mt-6 divide-y divide-garis border-y border-garis">
      {baris.map((b) => (
        <li key={b.id} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{b.nama}</p>
            <p className="text-sm text-tinta-2">{b.peran}</p>
          </div>
          {b.id === sesi.perusahaanId ? (
            <span className="text-sm text-daun">Sedang dibuka</span>
          ) : (
            <form action={pindahPerusahaan}>
              <input type="hidden" name="perusahaan" value={b.id} />
              <button type="submit" className="h-10 rounded-[var(--radius-isian)] border border-garis-kuat px-3 text-sm font-semibold">Buka</button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}

async function BagianPemberitahuan() {
  await wajibSesi();
  const supabase = await createClient();
  const { data } = await supabase.rpc("kunci_push_publik");
  return <Pemberitahuan kunciPublik={(data as string | null) ?? null} />;
}

export default function Perusahaan() {
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-10">
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">Usahamu</h1>
      <p className="mt-2 text-tinta-2">Satu akun bisa mengelola beberapa usaha. Pilih yang ingin dibuka.</p>
      <Suspense fallback={<div className="mt-6 h-24 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Daftar />
      </Suspense>
      <Link href="/app/mulai" className="mt-6 inline-block text-sm font-semibold underline underline-offset-4">Tambah usaha lain</Link>
      <Suspense fallback={<div className="mt-10 h-28 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <BagianPemberitahuan />
      </Suspense>
    </main>
  );
}
