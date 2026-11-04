import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { Suspense } from "react";
import { FormAjukanThr } from "@/components/app/thr";
import { Rupiah } from "@/components/ui/rupiah";
import { formatTanggalKalender } from "@/lib/format";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "THR" };

type HasilThr = { batas_bayar: string; dasar: string; orang: Baris[] };
type Baris = { id: string; nama: string; mulai: string | null; masa_bulan: number; upah: number | null; thr: number | null; catatan: string | null; harian_lepas?: boolean; bulan_rata?: number | null };

// M-10: THR Keagamaan (Permenaker 6/2016) dihitung database (public.hitung_thr) untuk Hari Raya yang dipilih; hanya pemilik.
async function Isi({ searchParams }: { searchParams: PageProps<"/app/gaji/thr">["searchParams"] }) {
  const sesi = await wajibPerusahaan();
  const bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).thr;
  if (sesi.peran !== "pemilik") return <p className="mt-6">{t.hanyaPemilik}</p>;
  const sp = await searchParams;
  const hari = typeof sp.hari === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.hari) ? sp.hari : "";
  let d: HasilThr | null = null;
  if (hari) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("hitung_thr", { p_hari_raya: hari });
    d = data as HasilThr;
  }
  const total = d ? d.orang.reduce((s, o) => s + (o.thr ?? 0), 0) : 0;
  return (
    <div lang={bahasa}>
      <h1 className="text-2xl font-semibold">{t.judul}</h1>
      <p className="mt-2 text-tinta-2">{t.ket}</p>
      <form method="get" className="mt-4 flex flex-wrap items-end gap-3 text-sm" aria-label={t.pilihAria}>
        <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.hariRaya}</span>
          <input type="date" name="hari" required defaultValue={hari} className="h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base" /></label>
        <button type="submit" className="h-10 rounded-[var(--radius-isian)] border-2 border-tinta px-4 font-semibold">{t.hitung}</button>
      </form>
      {d && (
        <section className="mt-6" aria-labelledby="judul-hasil-thr">
          <h2 id="judul-hasil-thr" className="text-lg font-semibold">{isiTeks(t.batas, { t: formatTanggalKalender(d.batas_bayar, bahasa) })}</h2>
          <table className="mt-3 w-full text-sm" data-testid="tabel-thr">
            <thead><tr className="border-b border-garis text-left"><th className="py-2">{t.nama}</th><th>{t.masa}</th><th className="text-right">{t.thrKol}</th></tr></thead>
            <tbody>
              {d.orang.map((o) => (
                <tr key={o.id} className="border-b border-garis" data-orang={o.nama}>
                  <td className="py-2" data-pengguna>{o.nama}</td>
                  <td className="angka">{o.mulai ? isiTeks(t.bulan, { n: o.masa_bulan }) : "-"}{o.harian_lepas && <span className="block text-xs text-tinta-2">{isiTeks(t.harian, { n: o.bulan_rata ?? 0 })}</span>}</td>
                  <td className="text-right">{o.thr === null ? <span className="text-tinta-2">{o.catatan}</span> : o.thr === 0 ? <span className="text-tinta-2">{o.catatan}</span> : <Rupiah nilai={o.thr} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 font-semibold" data-testid="total-thr">{t.total} <Rupiah nilai={total} /></p>
          <p className="mt-1 text-xs text-tinta-2">{d.dasar}</p>
          {total > 0 && <FormAjukanThr hari={hari} kunci={randomUUID()} teks={t} />}
        </section>
      )}
    </div>
  );
}

export default function HalamanThr(props: PageProps<"/app/gaji/thr">) {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
