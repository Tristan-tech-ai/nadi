import type { Metadata } from "next";
import { Suspense } from "react";
import { FormIzin } from "@/components/app/form-izin";
import { Cap } from "@/components/ui/cap";
import { capStatus, rentangTanggal } from "@/lib/izin";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";

export const metadata: Metadata = { title: "Izin dan cuti" };

type Ringkas = { punya_orang: boolean; tahun: number; cuti: { jatah: number | null; terpakai: number; sisa: number | null } };
type Pengajuan = {
  id: string;
  jenis: string;
  mulai: string;
  selesai: string;
  hari: number;
  status: string;
  oleh_otopilot: boolean;
  alasan_putusan: string;
  orang: { nama: string } | null;
};

const LABEL: Record<string, string> = { sakit: "Sakit", izin: "Izin", cuti: "Cuti" };

async function Isi() {
  const sesi = await wajibPerusahaan();
  const supabase = await createClient();
  const [{ data: r }, { data: daftar }] = await Promise.all([
    supabase.rpc("izin_ringkas"),
    supabase
      .from("pengajuan_izin")
      .select("id, jenis, mulai, selesai, hari, status, oleh_otopilot, alasan_putusan, orang:orang_id(nama)")
      .order("dibuat_at", { ascending: false })
      .limit(30),
  ]);
  const ringkas = r as Ringkas | null;
  const baris = (daftar ?? []) as unknown as Pengajuan[];
  const pengelola = sesi.peran === "pemilik" || sesi.peran === "admin";
  return (
    <>
      {ringkas?.punya_orang ? (
        <>
          {ringkas.cuti.jatah !== null && (
            <p className="mt-4 rounded-[var(--radius-kartu)] bg-kertas-2 px-4 py-3" data-testid="saldo-cuti">
              Sisa cuti {ringkas.tahun}: <span className="angka font-semibold">{ringkas.cuti.sisa}</span> dari {ringkas.cuti.jatah} hari
            </p>
          )}
          <FormIzin />
        </>
      ) : (
        <p className="mt-6 text-tinta-2" data-testid="izin-tanpa-orang">
          Pengajuan izin dibuat dari akun staf. {pengelola ? "Aturan kapan izin disetujui otomatis ada di halaman Usahamu." : "Minta pemilik membuatkan akun staf untukmu."}
        </p>
      )}
      <section className="mt-10" aria-labelledby="judul-daftar-izin">
        <h2 id="judul-daftar-izin" className="text-lg font-semibold">{pengelola ? "Pengajuan tim" : "Pengajuanmu"}</h2>
        {baris.length === 0 ? (
          <p className="mt-2 text-sm text-tinta-2" data-testid="izin-kosong">Belum ada pengajuan.</p>
        ) : (
          <ul className="mt-3 divide-y divide-garis border-y border-garis" data-testid="daftar-izin">
            {baris.map((p) => (
              <li key={p.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    {pengelola && p.orang ? `${p.orang.nama}: ` : ""}
                    {LABEL[p.jenis] ?? p.jenis} {p.hari} hari
                  </p>
                  <Cap {...capStatus(p.status)} />
                </div>
                <p className="text-sm text-tinta-2">{rentangTanggal(p.mulai, p.selesai)}</p>
                <p className="mt-1 text-sm">{p.alasan_putusan}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default function Izin() {
  return (
    <main className="mx-auto w-full max-w-md px-5 py-10">
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">Izin dan cuti</h1>
      <p className="mt-2 text-tinta-2">Ajukan di sini. Yang sesuai aturan usaha langsung disetujui, sisanya diputuskan pemilik atau admin.</p>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi />
      </Suspense>
    </main>
  );
}
