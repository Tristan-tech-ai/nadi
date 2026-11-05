import type { Metadata } from "next";
import { Suspense } from "react";
import { formatRupiah } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

// M-19: struk publik penjualan kasir (kode acak), lebar 58 mm saat dicetak.
export const metadata: Metadata = { title: "Struk", robots: { index: false, follow: false } };

export default function Struk(props: PageProps<"/struk/[kode]">) {
  return <Suspense fallback={<main className="mx-auto min-h-[70svh] max-w-xs px-5 py-10" aria-hidden />}><Isi params={props.params} /></Suspense>;
}

async function Isi({ params }: { params: PageProps<"/struk/[kode]">["params"] }) {
  const { kode } = await params;
  const bahasa: Bahasa = await bahasaAplikasi();
  const t = ambilKamus(bahasa).strukPublik;
  const supabase = await createClient();
  const { data } = /^[0-9A-Fa-f]{10}$/.test(kode) ? await supabase.rpc("pos_receipt", { p_kode: kode }) : { data: null };
  const s = data as { usaha: string; kode: string; waktu: string; zona: string; baris: { nama: string; jumlah: number; harga: number }[]; total: number; bayar: string; diterima: number; kembalian: number } | null;
  const rp = (n: number) => formatRupiah(n, { bahasa });
  return (
    <main className="mx-auto min-h-[70svh] w-full max-w-xs px-5 py-10 text-sm print:max-w-[58mm] print:p-0" lang={bahasa}>
      {!s ? <p className="text-tinta-2">{t.tidakAda}</p> : (
        <div data-testid="struk">
          <h1 className="text-center text-base font-semibold">{isiTeks(t.judul, { usaha: s.usaha })}</h1>
          <p className="angka text-center text-xs text-tinta-2">{s.kode} {new Intl.DateTimeFormat(bahasa === "en" ? "en-GB" : "id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: s.zona || "Asia/Jakarta" }).format(new Date(s.waktu)).replace(/(\d{2}):(\d{2})/, "$1.$2")}</p>
          <ul className="mt-3 border-y border-dashed border-garis-kuat py-2">
            {s.baris.map((b, i) => <li key={i} className="flex justify-between gap-2"><span>{b.nama} x{b.jumlah}</span><span className="angka">{rp(b.harga * b.jumlah)}</span></li>)}
          </ul>
          <p className="mt-2 flex justify-between font-semibold"><span>{t.total}</span><span className="angka" data-testid="struk-total">{rp(s.total)}</span></p>
          <p className="flex justify-between"><span>{t.bayar} ({s.bayar})</span><span className="angka">{rp(s.diterima)}</span></p>
          {s.kembalian > 0 && <p className="flex justify-between"><span>{t.kembalian}</span><span className="angka">{rp(s.kembalian)}</span></p>}
          <p className="mt-3 text-center">{t.terima}</p>
        </div>
      )}
    </main>
  );
}
