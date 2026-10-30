import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { FormAkunStaf, FormTambahOrang } from "./form-orang";

export const metadata: Metadata = { title: "Orang" };

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
    supabase.from("orang").select("id, nama, id_staf, user_id").order("dibuat_at", { ascending: true }),
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
              </div>
              <FormAkunStaf orangId={o.id} sudahAda={Boolean(o.user_id)} />
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
