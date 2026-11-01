import type { Metadata } from "next";
import { Suspense } from "react";
import { Cap } from "@/components/ui/cap";
import { LogoNadi } from "@/components/ui/logo";
import { tanggalPanjang } from "@/lib/surat/kalimat";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Cek keaslian surat", robots: { index: false } };

// F4-02: verifikasi publik surat dari QR. Hanya usaha, nomor, judul, tanggal, dan nama pihak (isi surat tidak ditampilkan).
type Hasil = { status: "terbit" | "batal"; usaha: string; nomor: string; judul: string; tanggal: string; nama_pihak: string; batal_at: string | null };

async function Periksa({ params }: { params: Promise<{ kode: string }> }) {
  const { kode } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verifikasi_surat", { p_kode: decodeURIComponent(kode).slice(0, 40) });
  if (error) {
    return <p role="alert" className="mt-6 text-cap">Nadi belum bisa memeriksa surat ini. Coba lagi sebentar.</p>;
  }
  const h = data as Hasil | null;
  if (!h) {
    return (
      <div className="mt-6" data-testid="verifikasi-palsu">
        <Cap jenis="ditolak" label="Tidak terdaftar" />
        <p className="mt-3 text-lg font-semibold">Kode ini tidak terdaftar di Nadi.</p>
        <p className="mt-2 text-tinta-2">Surat dengan kode ini tidak pernah diterbitkan lewat Nadi, atau kodenya salah ketik. Jangan pakai surat ini sebelum menanyakannya langsung ke usaha yang tertulis di kopnya.</p>
      </div>
    );
  }
  return (
    <div className="mt-6" data-testid={h.status === "terbit" ? "verifikasi-asli" : "verifikasi-batal"}>
      {h.status === "terbit" ? <Cap jenis="diterima" label="Asli" /> : <Cap jenis="ditolak" label="Dibatalkan" />}
      <p className="mt-3 text-lg font-semibold">
        {h.status === "terbit" ? `Surat ini asli, diterbitkan ${h.usaha} lewat Nadi.` : `Surat ini pernah diterbitkan ${h.usaha}, tetapi sudah dibatalkan${h.batal_at ? ` pada ${tanggalPanjang(h.batal_at.slice(0, 10))}` : ""} dan tidak berlaku lagi.`}
      </p>
      <p className="mt-2 text-tinta-2">Cocokkan isian di bawah dengan kertasnya. Bila ada yang berbeda, surat itu sudah diubah.</p>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-y border-garis py-3">
        <dt className="text-tinta-2">Usaha</dt><dd>{h.usaha}</dd>
        <dt className="text-tinta-2">Surat</dt><dd>{h.judul}</dd>
        <dt className="text-tinta-2">Nomor</dt><dd className="font-mono">{h.nomor}</dd>
        <dt className="text-tinta-2">Tanggal</dt><dd>{tanggalPanjang(h.tanggal)}</dd>
        <dt className="text-tinta-2">Untuk</dt><dd>{h.nama_pihak}</dd>
      </dl>
    </div>
  );
}

export default function Verifikasi(props: PageProps<"/v/[kode]">) {
  return (
    <main className="mx-auto w-full max-w-lg px-5 py-8">
      <LogoNadi />
      <h1 className="mt-6 font-judul text-2xl font-extrabold tracking-tight">Cek keaslian surat</h1>
      <Suspense fallback={<div className="mt-6 h-40 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Periksa params={props.params} />
      </Suspense>
    </main>
  );
}
