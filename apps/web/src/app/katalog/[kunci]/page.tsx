import type { Metadata } from "next";
import { Suspense } from "react";
import { Rupiah } from "@/components/ui/rupiah";
import { formatRupiah } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { tautanWa } from "@/lib/katalog";
import { createClient } from "@/lib/supabase/server";

// M-16B: katalog publik. Pesanan dikirim pembeli sendiri lewat WhatsApp (tautan wa.me berisi teks), tanpa WhatsApp API.
export const metadata: Metadata = { title: "Katalog", robots: { index: false, follow: false } };

export default function Katalog(props: PageProps<"/katalog/[kunci]">) {
  return (
    <Suspense fallback={<main className="mx-auto min-h-[70svh] w-full max-w-2xl px-5 py-10" aria-hidden><div className="h-9 w-48 animate-pulse rounded-[var(--radius-isian)] bg-kertas-2" /></main>}>
      <Isi params={props.params} />
    </Suspense>
  );
}

async function Isi({ params }: { params: PageProps<"/katalog/[kunci]">["params"] }) {
  const { kunci } = await params;
  const bahasa: Bahasa = await bahasaAplikasi();
  const t = ambilKamus(bahasa).katalogPublik;
  const supabase = await createClient();
  const { data } = /^[0-9a-f]{18}$/.test(kunci) ? await supabase.rpc("catalog_public", { p_kunci: kunci }) : { data: null };
  const k = data as { usaha: string; wa: string; produk: { nama: string; harga: number; satuan: string; kategori: string | null }[] } | null;
  return (
    <main className="mx-auto min-h-[70svh] w-full max-w-2xl px-5 py-10" lang={bahasa}>
      {!k ? <p className="text-tinta-2">{t.tidakAktif}</p> : (
        <>
          <h1 className="font-judul text-3xl font-extrabold tracking-tight">{isiTeks(t.judul, { usaha: k.usaha })}</h1>
          {k.produk.length === 0 ? <p className="mt-4 text-tinta-2">{t.kosong}</p> : (
            <ul className="mt-6 divide-y divide-garis border-y border-garis" data-testid="katalog">
              {k.produk.map((p) => {
                const wa = tautanWa(k.wa, isiTeks(t.teks, { usaha: k.usaha, nama: p.nama, harga: `${formatRupiah(p.harga, { bahasa })}/${p.satuan}` }));
                return (
                  <li key={p.nama} className="flex flex-wrap items-center justify-between gap-3 py-4" data-nama={p.nama}>
                    <div><p className="font-semibold">{p.nama}</p><p className="text-sm text-tinta-2"><Rupiah nilai={p.harga} bahasa={bahasa} /> / {p.satuan}{p.kategori ? `, ${p.kategori}` : ""}</p></div>
                    {wa && <a href={wa} target="_blank" rel="noopener noreferrer" aria-label={`${t.pesan}: ${p.nama}`} className="inline-flex h-11 items-center rounded-[var(--radius-isian)] bg-tinta px-4 text-sm font-semibold text-kertas">{t.pesan}</a>}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
