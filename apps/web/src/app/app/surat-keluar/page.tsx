import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { IlustrasiSurat } from "@/components/ilustrasi";
import { BuatSurat, FormBatalSurat, FormTerbitkan } from "@/components/app/surat-keluar";
import { Cap } from "@/components/ui/cap";
import { formatTanggalKalender } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";

export const metadata: Metadata = { title: "Surat keluar" };

// F4-02 (docs/research/surat-keluar.md): surat dari kalimat, draf lalu terbit dengan Nomor Sakti dan QR verifikasi.

type Surat = {
  id: string;
  judul: string;
  nama_pihak: string;
  status: "draf" | "terbit" | "batal";
  nomor: string | null;
  tanggal: string | null;
  kode_verifikasi: string | null;
  isi: string[];
  alasan_batal: string | null;
};

const CAP = { draf: ["menunggu", "Draf"], terbit: ["diterima", "Terbit"], batal: ["ditolak", "Batal"] } as const;
const kodeTampil = (k: string) => `${k.slice(0, 4)}-${k.slice(4, 8)}-${k.slice(8)}`;

async function Isi() {
  const sesi = await wajibPerusahaan();
  if (!["pemilik", "admin", "akuntan"].includes(sesi.peran)) {
    return <p className="mt-6 text-tinta-2">Surat keluar hanya untuk pemilik, admin, dan akuntan.</p>;
  }
  const kelola = sesi.peran === "pemilik" || sesi.peran === "admin";
  const supabase = await createClient();
  const [{ data }, { data: org }] = await Promise.all([
    supabase.from("surat_keluar").select("id, judul, nama_pihak, status, nomor, tanggal, kode_verifikasi, isi, alasan_batal").order("dibuat_at", { ascending: false }).limit(50),
    kelola ? supabase.from("orang").select("id, nama").eq("status", "aktif").order("nama").limit(500) : Promise.resolve({ data: [] }),
  ]);
  const daftar = (data ?? []) as Surat[];
  return (
    <>
      {kelola && <div className="mt-6"><BuatSurat orang={(org ?? []) as { id: string; nama: string }[]} /></div>}
      {daftar.length === 0 ? (
        <div className="mt-8 flex flex-col items-start gap-3"><IlustrasiSurat className="w-28" /><p className="text-tinta-2" data-testid="surat-kosong">Belum ada surat keluar. Tulis permintaannya di atas, misalnya surat tugas Sari ke Surabaya untuk ikut pameran mulai besok.</p></div>
      ) : (
        <ul className="mt-8 divide-y divide-garis border-y border-garis" data-testid="daftar-surat-keluar">
          {daftar.map((s) => (
            <li key={s.id} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{s.judul} untuk {s.nama_pihak}</p>
                  <p className="font-mono text-sm text-tinta-2">{s.nomor ?? "Belum bernomor"}{s.tanggal ? `, ${formatTanggalKalender(s.tanggal)}` : ""}</p>
                </div>
                <Cap jenis={CAP[s.status][0]} label={CAP[s.status][1]} />
              </div>
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-tinta-2">Isi surat</summary>
                <div className="mt-2 space-y-2">{s.isi.map((p, i) => <p key={i}>{p}</p>)}</div>
              </details>
              {s.status === "batal" && s.alasan_batal && <p className="mt-1 text-sm text-tinta-2">Dibatalkan: {s.alasan_batal}</p>}
              {s.status === "terbit" && s.kode_verifikasi && (
                <p className="mt-2 text-sm">
                  <Link href={`/cetak/surat/${s.id}`} target="_blank" className="font-semibold text-laut underline underline-offset-4">Cetak atau simpan PDF</Link>
                  <span className="text-tinta-2">. Kode verifikasi <span className="font-mono text-tinta" data-testid="kode-verifikasi">{kodeTampil(s.kode_verifikasi)}</span></span>
                </p>
              )}
              {kelola && s.status !== "batal" && (
                <div className="mt-2 flex flex-col gap-2">
                  {s.status === "draf" && <FormTerbitkan surat={s.id} judul={`${s.judul} untuk ${s.nama_pihak}`} />}
                  <FormBatalSurat surat={s.id} judul={`${s.judul} untuk ${s.nama_pihak}`} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function SuratKeluar() {
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-10">
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">Surat keluar</h1>
      <p className="mt-2 text-tinta-2">Nomor diberikan saat surat diterbitkan, urut tanpa loncat. Setiap surat membawa QR yang bisa dipindai siapa pun untuk memastikan surat itu asli.</p>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi />
      </Suspense>
    </main>
  );
}
