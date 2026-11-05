"use client";

import { useEffect, useState } from "react";
import { FormTanda } from "@/components/tanda/publik";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Dok = {
  judul: string; isi: string; cap: boolean; sidik: string; kode: string; usaha: string; status: string; kedaluwarsa: boolean; butuh_meterai: boolean;
  saya: string; giliran: boolean; status_saya: string; penanda: { urutan: number; nama: string; status: string; waktu: string | null }[];
};

/** Dokumen dimuat dari peramban penanda tangan (kejadian "dibuka" tercatat dengan perangkatnya sendiri). */
export function HalamanTanda({ token, bahasa, teks: t, status: ts }: { token: string; bahasa: Bahasa; teks: Kamus["tandaPublik"]; status: Kamus["tanda"]["statusPenanda"] }) {
  const [d, setD] = useState<Dok | null | "galat">(null);
  useEffect(() => {
    let batal = false;
    void createBrowserSupabase().rpc("sign_view", { p_token: token }).then(({ data, error }) => { if (!batal) setD(error || !data ? "galat" : (data as Dok)); });
    return () => { batal = true; };
  }, [token]);
  if (d === null) return <div className="h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />;
  if (d === "galat") return <p className="text-tinta-2" data-testid="tanda-tidak-berlaku">{t.tidakBerlaku}</p>;
  const waktu = (iso: string) => new Intl.DateTimeFormat(bahasa === "en" ? "en-GB" : "id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)).replace(/(\d{2}):(\d{2})/, "$1.$2");
  return (
    <article data-testid="dokumen-tanda">
      <p className="text-sm text-tinta-2">{isiTeks(t.dari, { usaha: d.usaha })}</p>
      <h1 className="mt-1 font-judul text-3xl font-extrabold tracking-tight">{isiTeks(t.judul, { judul: d.judul })}</h1>
      <p className="mt-3 rounded-[var(--radius-kartu)] bg-kertas-2 p-3 text-sm" data-testid="jenis-tanda">{t.jenis}</p>
      {d.butuh_meterai && <p className="mt-2 text-sm text-tinta-2">{t.meterai}</p>}
      <div className="mt-5 whitespace-pre-line rounded-[var(--radius-kartu)] border border-garis p-4 text-base leading-relaxed" data-testid="isi-dokumen">{d.isi}</div>
      {d.cap && <p className="mt-3 inline-block rotate-[-4deg] rounded-[var(--radius-isian)] border-2 border-cap px-3 py-1 text-sm font-semibold text-cap" aria-label={isiTeks(t.cap, { usaha: d.usaha })}>{d.usaha}</p>}
      <p className="mt-4 break-all text-xs text-tinta-2">{t.sidik}: <span className="angka" data-testid="sidik">{d.sidik}</span></p>
      <h2 className="mt-6 font-semibold">{t.urutan}</h2>
      <ol className="mt-2 list-decimal pl-5 text-sm">
        {d.penanda.map((p) => <li key={p.urutan}>{p.nama}, {ts[p.status as keyof typeof ts] ?? p.status}{p.waktu ? ` (${waktu(p.waktu)})` : ""}</li>)}
      </ol>
      {d.giliran ? <FormTanda token={token} nama={d.saya} kode={d.kode} teks={t} />
        : <p className="mt-6 text-sm text-tinta-2" data-testid="bukan-giliran">{d.status_saya === "ditandatangani" ? t.sudah : d.kedaluwarsa ? t.kedaluwarsa : t.belumGiliran}</p>}
    </article>
  );
}
