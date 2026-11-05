import type { Metadata } from "next";
import { Suspense } from "react";
import { CocokkanSalinan } from "@/components/tanda/publik";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

// M-17: verifikasi publik dokumen bertanda tangan dari kode cek (status, penanda dan waktu, isi utuh, jejak utuh, cocokkan salinan).
export const metadata: Metadata = { title: "Cek dokumen", robots: { index: false, follow: false } };

type Hasil = {
  judul: string; usaha: string; status: string; sidik: string; isi_utuh: boolean; rantai_utuh: boolean; cap: boolean; butuh_meterai: boolean;
  penanda: { urutan: number; nama: string; status: string; waktu: string | null }[]; jejak: { jenis: string; waktu: string }[];
};

export default function Cek(props: PageProps<"/tanda/cek/[kode]">) {
  return (
    <main className="mx-auto min-h-[70svh] w-full max-w-2xl px-5 py-10">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi params={props.params} />
      </Suspense>
    </main>
  );
}

async function Isi({ params }: { params: PageProps<"/tanda/cek/[kode]">["params"] }) {
  const { kode } = await params;
  const bahasa: Bahasa = await bahasaAplikasi();
  const k = ambilKamus(bahasa);
  const t = k.cekTanda;
  const supabase = await createClient();
  const { data } = /^[0-9A-Fa-f]{10}$/.test(kode) ? await supabase.rpc("verify_sign", { p_kode: kode }) : { data: null };
  const h = data as Hasil | null;
  if (!h) return <div lang={bahasa}><h1 className="font-judul text-3xl font-extrabold tracking-tight">{t.judul}</h1><p className="mt-3 text-tinta-2">{t.tidakAda}</p></div>;
  const waktu = (iso: string) => new Intl.DateTimeFormat(bahasa === "en" ? "en-GB" : "id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(iso)).replace(/(\d{2}):(\d{2})/, "$1.$2");
  return (
    <div lang={bahasa} data-testid="hasil-cek" data-utuh={h.isi_utuh && h.rantai_utuh ? "ya" : "tidak"}>
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">{t.judul}</h1>
      <p className="mt-3 text-lg font-semibold">{h.judul}</p>
      <p className="text-sm text-tinta-2">{h.usaha}, {t.status}: {k.tanda.status[h.status as keyof typeof k.tanda.status] ?? h.status}</p>
      <p className="mt-3 rounded-[var(--radius-kartu)] bg-kertas-2 p-3 text-sm">{k.tanda.jujur}</p>
      <ul className="mt-4 space-y-1 text-sm">
        <li className={h.isi_utuh ? "text-daun" : "font-semibold text-cap"}>{h.isi_utuh ? t.utuh : t.tidakUtuh}</li>
        <li className={h.rantai_utuh ? "text-daun" : "font-semibold text-cap"}>{h.rantai_utuh ? t.rantai : t.rantaiPutus}</li>
        {h.butuh_meterai && <li className="text-tinta-2">{k.tandaPublik.meterai}</li>}
      </ul>
      <ol className="mt-4 list-decimal pl-5 text-sm" data-testid="penanda-cek">
        {h.penanda.map((p) => <li key={p.urutan}>{p.nama}, {p.waktu ? isiTeks(t.ditandatangani, { waktu: `${waktu(p.waktu)} WIB` }) : k.tanda.statusPenanda[p.status as keyof typeof k.tanda.statusPenanda] ?? p.status}</li>)}
      </ol>
      <p className="mt-4 break-all text-xs text-tinta-2">{k.tandaPublik.sidik}: <span className="angka">{h.sidik}</span></p>
      <h2 className="mt-6 font-semibold">{t.cocokkan}</h2>
      <CocokkanSalinan kode={kode} teks={t} />
    </div>
  );
}
