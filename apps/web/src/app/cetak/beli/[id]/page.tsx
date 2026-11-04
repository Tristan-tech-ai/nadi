import type { Metadata } from "next";
import { Suspense } from "react";
import { TombolCetak } from "@/components/app/surat-keluar";
import { formatAngka, formatRupiah } from "@/lib/format";
import { tanggalPanjang } from "@/lib/surat/kalimat";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Cetak dokumen pembelian", robots: { index: false } };

// M-04: lembar A4 permintaan pembelian, pesanan pembelian (PO) untuk pemasok, dan bukti penerimaan barang. Dokumen untuk pemasok di
// Indonesia, jadi selalu bahasa Indonesia (sama dengan cetak penjualan). Penerimaan barang tanpa harga.
type Dok = { jenis: "permintaan" | "pesanan_beli" | "penerimaan"; nomor: string; pemasok: string; baris: { uraian: string; jumlah: number; harga: number }[]; total: number;
  tanggal: string; catatan: string | null; perusahaan: { nama: string } | null };
const JUDUL = { permintaan: "Permintaan pembelian", pesanan_beli: "Pesanan pembelian", penerimaan: "Bukti penerimaan barang" } as const;

async function Lembar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("dokumen_beli").select("jenis, nomor, pemasok, baris, total, tanggal, catatan, perusahaan:perusahaan_id(nama)").eq("id", id).maybeSingle();
  const d = data as unknown as Dok | null;
  if (!d) return <p className="p-8 text-tinta-2">Dokumen tidak ditemukan, atau kamu tidak punya akses ke dokumen ini.</p>;
  const harga = d.jenis !== "penerimaan";
  return (
    <article className="lembar mx-auto flex min-h-[297mm] w-full max-w-[210mm] flex-col bg-kertas px-[20mm] py-[18mm] text-tinta print:min-h-0 print:p-0" data-testid="lembar-beli">
      <header className="flex items-end justify-between border-b-2 border-tinta pb-3">
        <p className="font-judul text-2xl font-extrabold">{d.perusahaan?.nama ?? ""}</p>
        <div className="text-right"><h1 className="text-lg font-bold">{JUDUL[d.jenis]}</h1><p className="font-mono text-sm">{d.nomor}</p></div>
      </header>
      <dl className="mt-6 grid grid-cols-2 gap-2 text-sm">
        <div><dt className="text-tinta-2">{d.jenis === "penerimaan" ? "Dari pemasok" : "Kepada"}</dt><dd className="font-semibold">{d.pemasok}</dd></div>
        <div className="text-right"><dt className="text-tinta-2">Tanggal</dt><dd>{tanggalPanjang(d.tanggal)}</dd></div>
      </dl>
      <table className="mt-6 w-full border-y-2 border-tinta text-sm">
        <thead><tr className="border-b border-tinta text-left"><th className="py-2">Uraian</th><th className="py-2 text-right">Jumlah</th>
          {harga && <><th className="py-2 text-right">Harga</th><th className="py-2 text-right">Subtotal</th></>}</tr></thead>
        <tbody>
          {d.baris.map((b, i) => (
            <tr key={i} className="border-b border-garis"><td className="py-2">{b.uraian}</td><td className="angka py-2 text-right">{formatAngka(b.jumlah)}</td>
              {harga && <><td className="angka py-2 text-right">{formatRupiah(b.harga)}</td><td className="angka py-2 text-right">{formatRupiah(Math.round(b.jumlah * b.harga))}</td></>}</tr>
          ))}
        </tbody>
      </table>
      {harga && (
        <div className="mt-3 ml-auto w-72 text-sm">
          <p className="flex justify-between font-bold"><span>Total</span><span className="angka">{formatRupiah(d.total)}</span></p>
        </div>
      )}
      {d.catatan ? <p className="mt-6 text-sm">{d.catatan}</p> : null}
      <div className="mt-12 grid grid-cols-2 gap-8 text-sm">
        {d.jenis !== "permintaan" ? <div><p>{d.jenis === "penerimaan" ? "Diterima oleh" : "Disetujui pemasok"}</p><div className="h-20" aria-hidden /><p className="border-t border-tinta pt-1 text-tinta-2">Nama, tanda tangan, tanggal</p></div> : <div />}
        <div><p>Hormat kami</p><div className="h-20" aria-hidden /><p className="border-t border-tinta pt-1 text-tinta-2">{d.perusahaan?.nama ?? ""}</p></div>
      </div>
    </article>
  );
}

export default function CetakBeli(props: PageProps<"/cetak/beli/[id]">) {
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
