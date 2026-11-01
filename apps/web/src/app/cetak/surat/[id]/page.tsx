import type { Metadata } from "next";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { Suspense } from "react";
import { TombolCetak } from "@/components/app/surat-keluar";
import { asalTautan } from "@/lib/mcp/http";
import { tanggalPanjang } from "@/lib/surat/kalimat";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Cetak surat", robots: { index: false } };

// F4-02: lembar A4 untuk dicetak atau disimpan sebagai PDF dari peramban (MDN @page size: A4 = 210 x 297 mm). Kop usaha, nomor,
// isi, tempat tanda tangan, QR verifikasi. Dibaca lewat RLS pengguna (pemilik, admin, akuntan).

type Surat = { judul: string; nomor: string | null; tanggal: string | null; isi: string[]; status: string; kode_verifikasi: string | null; perusahaan: { nama: string } | null };

async function Lembar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("surat_keluar").select("judul, nomor, tanggal, isi, status, kode_verifikasi, perusahaan:perusahaan_id(nama)").eq("id", id).maybeSingle();
  const s = data as unknown as Surat | null;
  if (!s) return <p className="p-8 text-tinta-2">Surat tidak ditemukan, atau kamu tidak punya akses ke surat ini.</p>;
  const usaha = s.perusahaan?.nama ?? "";
  const url = s.kode_verifikasi ? `${asalTautan(await headers())}/v/${s.kode_verifikasi}` : null;
  const qr = url ? await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M" }) : null;
  return (
    <article className="lembar mx-auto flex min-h-[297mm] w-full max-w-[210mm] flex-col bg-kertas px-[20mm] py-[18mm] text-tinta print:min-h-0 print:p-0" data-testid="lembar-surat">
      <header className="border-b-2 border-tinta pb-3">
        <p className="font-judul text-2xl font-extrabold">{usaha}</p>
      </header>
      {s.status !== "terbit" && (
        <p className="mt-4 border border-cap px-3 py-2 text-center text-sm font-semibold text-cap" data-testid="tanda-bukan-terbit">
          {s.status === "batal" ? "Surat ini sudah dibatalkan dan tidak berlaku." : "Draf, belum bernomor dan belum berlaku."}
        </p>
      )}
      <h1 className="mt-8 text-center text-lg font-bold">{s.judul}</h1>
      <p className="mt-1 text-center font-mono text-sm">Nomor: {s.nomor ?? "belum ada"}</p>
      <div className="mt-8 space-y-4 text-justify leading-relaxed">{s.isi.map((p, i) => <p key={i}>{p}</p>)}</div>
      <div className="mt-12 ml-auto w-64 text-left">
        <p>{s.tanggal ? tanggalPanjang(s.tanggal) : ""}</p>
        <p>Pimpinan {usaha}</p>
        <div className="h-24" aria-hidden />
        <p className="border-t border-tinta pt-1 text-sm text-tinta-2">Nama dan tanda tangan</p>
      </div>
      {qr && url && (
        <footer className="mt-auto flex items-center gap-4 border-t border-garis pt-4 text-xs text-tinta-2">
          {/* slop-ok: QR dari pustaka qrcode berupa SVG hitam putih agar terbaca kamera */}
          <div className="h-[24mm] w-[24mm] shrink-0 bg-[white] p-1 [&_svg]:h-full [&_svg]:w-full" data-testid="qr-surat" dangerouslySetInnerHTML={{ __html: qr }} />
          <p>Pindai kode QR atau buka <span className="font-mono text-tinta">{url}</span> untuk memastikan surat ini asli dan masih berlaku.</p>
        </footer>
      )}
    </article>
  );
}

export default function CetakSurat(props: PageProps<"/cetak/surat/[id]">) {
  return (
    <main className="min-h-svh bg-kertas-2 py-6 print:bg-kertas print:py-0">
      <style>{"@page { size: A4; margin: 18mm 20mm; }"}</style>
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end px-4 print:hidden"><TombolCetak /></div>
      <Suspense fallback={<div className="mx-auto h-[297mm] max-w-[210mm] animate-pulse bg-kertas" aria-hidden />}>
        <Lembar params={props.params} />
      </Suspense>
    </main>
  );
}
