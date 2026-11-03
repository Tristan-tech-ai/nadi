import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { IlustrasiSurat } from "@/components/ilustrasi";
import { BuatSurat, FormBatalSurat, FormTerbitkan } from "@/components/app/surat-keluar";
import { Cap } from "@/components/ui/cap";
import { formatTanggalKalender } from "@/lib/format";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { sisip } from "@/lib/i18n/sisip";
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

const CAP = { draf: "menunggu", terbit: "diterima", batal: "ditolak" } as const;
const kodeTampil = (k: string) => `${k.slice(0, 4)}-${k.slice(4, 8)}-${k.slice(8)}`;

async function Isi() {
  const sesi = await wajibPerusahaan();
  const bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).suratKeluar;
  const LABEL = { draf: t.stDraf, terbit: t.stTerbit, batal: t.stBatal };
  const isiLang = bahasa === "id" ? undefined : "id";
  const kepala = (
    <>
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">{t.judul}</h1>
      <p className="mt-2 text-tinta-2">{t.ket}</p>
      {bahasa !== "id" && <p className="mt-2 text-sm text-tinta-2" data-testid="khusus-indonesia">{t.khususId}</p>}
    </>
  );
  if (!["pemilik", "admin", "akuntan"].includes(sesi.peran)) {
    return <div lang={bahasa}>{kepala}<p className="mt-6 text-tinta-2">{t.hanyaPeran}</p></div>;
  }
  const kelola = sesi.peran === "pemilik" || sesi.peran === "admin";
  const supabase = await createClient();
  const [{ data }, { data: org }] = await Promise.all([
    supabase.from("surat_keluar").select("id, judul, nama_pihak, status, nomor, tanggal, kode_verifikasi, isi, alasan_batal").order("dibuat_at", { ascending: false }).limit(50),
    kelola ? supabase.from("orang").select("id, nama").eq("status", "aktif").order("nama").limit(500) : Promise.resolve({ data: [] }),
  ]);
  const daftar = (data ?? []) as Surat[];
  const judulSurat = (s: Surat) => isiTeks(t.untuk, { judul: s.judul, nama: s.nama_pihak });
  return (
    <div lang={bahasa}>
      {kepala}
      {kelola && <div className="mt-6"><BuatSurat orang={(org ?? []) as { id: string; nama: string }[]} teks={t} /></div>}
      {daftar.length === 0 ? (
        <div className="mt-8 flex flex-col items-start gap-3"><IlustrasiSurat className="w-28" /><p className="text-tinta-2" data-testid="surat-kosong">{t.kosong}</p></div>
      ) : (
        <ul className="mt-8 divide-y divide-garis border-y border-garis" data-testid="daftar-surat-keluar">
          {daftar.map((s) => (
            <li key={s.id} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{sisip(t.untuk, { judul: <span lang={isiLang}>{s.judul}</span>, nama: <span data-pengguna>{s.nama_pihak}</span> })}</p>
                  <p className="font-mono text-sm text-tinta-2">{s.nomor ?? t.belumNomor}{s.tanggal ? `, ${formatTanggalKalender(s.tanggal, bahasa)}` : ""}</p>
                </div>
                <Cap jenis={CAP[s.status]} label={LABEL[s.status]} />
              </div>
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-tinta-2">{t.isiSurat}</summary>
                <div className="mt-2 space-y-2" lang={isiLang}>{s.isi.map((p, i) => <p key={i}>{p}</p>)}</div>
              </details>
              {s.status === "batal" && s.alasan_batal && <p className="mt-1 text-sm text-tinta-2">{t.dibatalkan} <span data-pengguna>{s.alasan_batal}</span></p>}
              {s.status === "terbit" && s.kode_verifikasi && (
                <p className="mt-2 text-sm">
                  <Link href={`/cetak/surat/${s.id}`} target="_blank" className="font-semibold text-laut underline underline-offset-4">{t.cetak}</Link>
                  <span className="text-tinta-2">{t.kodeVerifikasi} <span className="font-mono text-tinta" data-testid="kode-verifikasi">{kodeTampil(s.kode_verifikasi)}</span></span>
                </p>
              )}
              {kelola && s.status !== "batal" && (
                <div className="mt-2 flex flex-col gap-2">
                  {s.status === "draf" && <FormTerbitkan surat={s.id} judul={judulSurat(s)} teks={t} />}
                  <FormBatalSurat surat={s.id} judul={judulSurat(s)} teks={t} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function SuratKeluar() {
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-10">
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi />
      </Suspense>
    </main>
  );
}
