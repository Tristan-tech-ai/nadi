import type { Metadata } from "next";
import { Suspense } from "react";
import { formatPersen } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { FormGajiOrang, type GajiOrang } from "@/components/app/aksi-gaji";
import { FormAkunStaf, FormTambahOrang } from "./form-orang";

export const metadata: Metadata = { title: "Orang" };

type PakaiTopi = { porsi: number; selesai: string | null; topi: { nama: string } | null };

/** Topi yang sedang dipakai, mis. "Kasir 50% · Gudang 50%". Topi = peran kerja; satu orang bisa memakai beberapa. */
function TopiOrang({ pakai }: { pakai: PakaiTopi[] }) {
  const aktif = (pakai ?? []).filter((p) => !p.selesai && p.topi).sort((a, b) => b.porsi - a.porsi);
  if (!aktif.length) return <p className="mt-1 text-sm text-tinta-2">Belum memakai topi</p>;
  return (
    <ul className="mt-1 flex flex-wrap gap-1.5" aria-label="Topi yang dipakai" data-testid="topi-orang">
      {aktif.map((p) => (
        <li key={p.topi!.nama} className="rounded-full border border-garis px-2 py-0.5 text-xs">
          {p.topi!.nama} <span className="angka text-tinta-2">{formatPersen(p.porsi / 100)}</span>
        </li>
      ))}
    </ul>
  );
}

async function Isi() {
  const sesi = await wajibPerusahaan();
  if (sesi.peran !== "pemilik" && sesi.peran !== "admin") {
    return (
      <section className="mx-auto w-full max-w-xl px-5 py-10">
        <h1 className="font-judul text-3xl font-extrabold tracking-tight">Khusus pemilik dan admin</h1>
        <p className="mt-2 text-tinta-2" data-testid="ditolak">Halaman ini mengatur akun orang lain. Minta pemilik usahamu bila ada yang perlu diubah.</p>
      </section>
    );
  }
  const supabase = await createClient();
  const [{ data: orang }, { data: usaha }] = await Promise.all([
    supabase.from("orang").select("id, nama, id_staf, user_id, pakai_topi(porsi, selesai, topi(nama)), orang_rahasia(gaji)").order("dibuat_at", { ascending: true }),
    supabase.from("perusahaan").select("kode").eq("id", sesi.perusahaanId).maybeSingle(),
  ]);
  return (
    <section className="mx-auto w-full max-w-2xl px-5 py-10">
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">Orang</h1>
      <p className="mt-2 text-tinta-2">
        Kode usahamu: <span className="font-mono font-semibold text-tinta" data-testid="kode-usaha">{usaha?.kode}</span>. Staf memakainya untuk masuk tanpa email.
      </p>
      <FormTambahOrang />
      {orang?.length ? (
        <ul className="mt-6 divide-y divide-garis border-y border-garis">
          {orang.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-semibold">{o.nama}</p>
                <p className="text-sm text-tinta-2">{o.id_staf ? <>ID staf <span className="font-mono">{o.id_staf}</span></> : "Belum punya akun staf"}</p>
                <TopiOrang pakai={o.pakai_topi as unknown as PakaiTopi[]} />
              </div>
              <FormAkunStaf orangId={o.id} sudahAda={Boolean(o.user_id)} />
              <FormGajiOrang orang={o.id} nama={o.nama} awal={((Array.isArray(o.orang_rahasia) ? o.orang_rahasia[0] : o.orang_rahasia)?.gaji as GajiOrang | undefined) ?? null} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-tinta-2">Belum ada orang. Tambah satu di atas, atau lempar Excel daftar karyawan nanti.</p>
      )}
    </section>
  );
}

export default function Orang() {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<div className="mx-auto mt-10 h-40 w-full max-w-2xl animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi />
      </Suspense>
    </main>
  );
}
