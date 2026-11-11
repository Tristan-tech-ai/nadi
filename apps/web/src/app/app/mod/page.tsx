import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { KepalaHalaman } from "@/components/app/kepala-halaman";
import type { Manifest } from "@/lib/mod/skema";
import { aksesPeran } from "@/lib/mod/tafsir";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";

// X-05: daftar fitur tambahan (Nadi Mod) yang aktif di usaha ini. Hanya koleksi yang boleh dilihat peran ini yang dihitung.
export const metadata: Metadata = { title: "Fitur tambahan" };

async function Isi() {
  const sesi = await wajibPerusahaan();
  const supabase = await createClient();
  const { data } = await supabase.from("mod").select("id, kode, nama, manifest, sumber").eq("status", "aktif").order("nama");
  const daftar = (data ?? []).filter((m) => (m.manifest as Manifest).koleksi.some((k) => aksesPeran(k, sesi.peran) !== "tidak"));
  const SUMBER: Record<string, string> = { resmi: "Paket resmi Nadi", ai: "Dibuat lewat AI milikmu", sendiri: "Dibuat sendiri", impor: "Diimpor" };
  return (
    <>
      <KepalaHalaman jalur="/app/mod" judul="Fitur tambahan" ket="Fitur khusus usahamu. Nadi yang menjalankan dan memeriksanya; datanya tetap milik usahamu." />
      {daftar.length === 0 ? (
        <p className="mt-6 text-sm text-tinta-2">
          Belum ada fitur tambahan yang aktif. Fitur tambahan disusun pemilik (sendiri atau lewat AI miliknya yang tersambung ke Nadi), diperiksa Nadi, lalu diterapkan pemilik.
        </p>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2" data-testid="daftar-mod">
          {daftar.map((m) => {
            const mf = m.manifest as Manifest;
            return (
              <li key={m.id as string} className="rounded-[var(--radius-kartu)] border border-garis p-4">
                <Link href={`/app/mod/${m.kode}`} className="font-semibold underline-offset-4 hover:underline" data-pengguna>{mf.nama}</Link>
                <p className="mt-1 text-sm text-tinta-2" data-pengguna>{mf.deskripsi}</p>
                <p className="mt-2 text-xs text-tinta-2">{SUMBER[m.sumber as string] ?? ""}. {mf.koleksi.length} bagian: <span data-pengguna>{mf.koleksi.map((k) => k.nama).join(", ")}</span>.</p>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export default function HalamanFiturTambahan() {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <Suspense fallback={<div aria-hidden className="h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" />}>
        <Isi />
      </Suspense>
    </main>
  );
}
