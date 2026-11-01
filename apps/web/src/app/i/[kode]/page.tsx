import type { Metadata } from "next";
import QRCode from "qrcode";
import { Suspense } from "react";
import { Cap } from "@/components/ui/cap";
import { LogoNadi } from "@/components/ui/logo";
import { Rupiah } from "@/components/ui/rupiah";
import { formatRupiah, formatTanggalKalender } from "@/lib/format";
import { BATAS_QRIS } from "@/lib/invoice/tagihan";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Tagihan", robots: { index: false } };

// F4-05: halaman tagihan untuk pelanggan dari tautan invoice. QRIS yang tampil adalah QR statis asli pemilik (tidak diubah,
// tanpa nominal); pembayar mengetik nominalnya sendiri (Bank Indonesia: QRIS statis).
type Tagihan = {
  usaha: string; nomor: string; pelanggan: string; baris: { uraian: string; jumlah: number; harga: number }[]; total: number; tanggal: string;
  jatuh_tempo: string; catatan: string | null; status: "terbit" | "lunas" | "batal"; lunas_tanggal: string | null;
  qris: string | null; qris_nama: string | null; rekening: string | null;
};
const jumlahTeks = (n: number) => String(n).replace(".", ",");

async function Isi({ params }: { params: Promise<{ kode: string }> }) {
  const { kode } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invoice_publik", { p_kode: decodeURIComponent(kode).slice(0, 40) });
  if (error) return <p role="alert" className="mt-6 text-cap">Tagihan belum bisa dibuka. Coba lagi sebentar.</p>;
  const t = data as Tagihan | null;
  if (!t) {
    return (
      <div className="mt-6" data-testid="tagihan-tidak-ada">
        <Cap jenis="ditolak" label="Tidak terdaftar" />
        <p className="mt-3 text-lg font-semibold">Tagihan dengan kode ini tidak ada di Nadi.</p>
        <p className="mt-2 text-tinta-2">Periksa tautannya, atau tanyakan langsung ke usaha yang mengirim tagihan. Jangan membayar sebelum yakin.</p>
      </div>
    );
  }
  const bisaQris = t.status === "terbit" && t.qris && t.total <= BATAS_QRIS;
  const qr = bisaQris ? await QRCode.toString(t.qris!, { type: "svg", margin: 1, errorCorrectionLevel: "M" }) : null;
  return (
    <div className="mt-6" data-testid="tagihan">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm text-tinta-2">Dari</p>
          <p className="text-lg font-semibold">{t.usaha}</p>
        </div>
        {t.status === "lunas" ? <Cap jenis="lunas" /> : t.status === "batal" ? <Cap jenis="ditolak" label="Dibatalkan" /> : <Cap jenis="menunggu" label="Belum dibayar" />}
      </div>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-tinta-2">Nomor</dt><dd className="font-mono">{t.nomor}</dd>
        <dt className="text-tinta-2">Untuk</dt><dd>{t.pelanggan}</dd>
        <dt className="text-tinta-2">Tanggal</dt><dd>{formatTanggalKalender(t.tanggal)}</dd>
        <dt className="text-tinta-2">Jatuh tempo</dt><dd>{formatTanggalKalender(t.jatuh_tempo)}</dd>
      </dl>
      <table className="mt-4 w-full text-sm">
        <caption className="sr-only">Rincian tagihan</caption>
        <thead><tr className="border-b border-garis-kuat text-left text-tinta-2"><th scope="col" className="py-1 font-semibold">Uraian</th><th scope="col" className="py-1 text-right font-semibold">Jumlah</th><th scope="col" className="py-1 text-right font-semibold">Harga</th><th scope="col" className="py-1 text-right font-semibold">Subtotal</th></tr></thead>
        <tbody>
          {t.baris.map((b, i) => (
            <tr key={i} className="border-b border-garis">
              <td className="py-1.5">{b.uraian}</td><td className="angka py-1.5 text-right">{jumlahTeks(b.jumlah)}</td>
              <td className="py-1.5 text-right"><Rupiah nilai={b.harga} /></td><td className="py-1.5 text-right"><Rupiah nilai={Math.round(b.jumlah * b.harga)} /></td>
            </tr>
          ))}
          <tr className="text-base font-semibold"><td className="py-2" colSpan={3}>Total</td><td className="py-2 text-right" data-testid="total-tagihan"><Rupiah nilai={t.total} /></td></tr>
        </tbody>
      </table>
      {t.catatan && <p className="mt-2 text-sm text-tinta-2">{t.catatan}</p>}

      {t.status === "lunas" && <p className="mt-6 font-semibold text-daun" data-testid="tagihan-lunas">Sudah lunas{t.lunas_tanggal ? ` pada ${formatTanggalKalender(t.lunas_tanggal)}` : ""}. Terima kasih.</p>}
      {t.status === "batal" && <p className="mt-6 text-tinta-2">Tagihan ini sudah dibatalkan dan tidak perlu dibayar.</p>}
      {t.status === "terbit" && (
        <section className="mt-6 rounded-[var(--radius-kartu)] border border-garis p-4" aria-labelledby="judul-bayar">
          <h2 id="judul-bayar" className="font-semibold">Cara bayar</h2>
          {qr && (
            <div className="mt-3 flex flex-col items-center gap-2" data-testid="qris-tagihan">
              <div className="h-56 w-56 bg-[white] p-2 [&_svg]:h-full [&_svg]:w-full" role="img" aria-label={`QRIS ${t.qris_nama}`} dangerouslySetInnerHTML={{ __html: qr }} />
              <p className="text-sm">QRIS atas nama <span className="font-semibold">{t.qris_nama}</span></p>
              <p className="text-center text-base">Pindai, lalu ketik nominal <span className="stabilo px-1 font-semibold">{formatRupiah(t.total)}</span></p>
            </div>
          )}
          {t.qris && t.total > BATAS_QRIS && (
            <p className="mt-2 text-sm" data-testid="batas-qris">Lewat QRIS paling banyak {formatRupiah(BATAS_QRIS)} sekali bayar, jadi tagihan ini dibayar lewat transfer.</p>
          )}
          {t.rekening && <p className="mt-3 text-sm">Transfer ke <span className="font-semibold">{t.rekening}</span> sebesar <Rupiah nilai={t.total} />.</p>}
          {!t.qris && !t.rekening && <p className="mt-2 text-sm text-tinta-2">Tanyakan cara bayar ke {t.usaha}.</p>}
        </section>
      )}
      <p className="mt-6 text-xs text-tinta-2">Dibuat lewat Nadi. Ini bukan faktur pajak.</p>
    </div>
  );
}

export default function HalamanTagihan(props: PageProps<"/i/[kode]">) {
  return (
    <main className="mx-auto w-full max-w-lg px-5 py-8">
      <LogoNadi />
      <h1 className="mt-6 font-judul text-2xl font-extrabold tracking-tight">Tagihan</h1>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi params={props.params} />
      </Suspense>
    </main>
  );
}
