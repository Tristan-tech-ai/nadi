"use client";

import Link from "next/link";
import { useActionState, useId, useRef } from "react";
import { tanyaData, type HasilTanya, type Jawaban } from "@/app/app/tanya/actions";
import { Tombol } from "@/components/ui/tombol";
import { formatRupiah, formatTanggalKalender } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";

type Teks = Kamus["tanya"];

function Kalimat({ j, t, bahasa }: { j: Jawaban; t: Teks; bahasa: Bahasa }) {
  const angka = new Intl.NumberFormat(bahasa === "en" ? "en-US" : "id-ID", { maximumFractionDigits: 2 });
  const n = Number(j.nilai ?? 0);
  const rentang = j.dari === j.sampai ? isiTeks(t.per, { tanggal: formatTanggalKalender(j.sampai, bahasa) })
    : isiTeks(t.rentang, { dari: formatTanggalKalender(j.dari, bahasa), sampai: formatTanggalKalender(j.sampai, bahasa) });
  if (j.niat === "stok") {
    if (!j.rincian?.length) return <p>{t.barangTidakAda}</p>;
    return (
      <ul className="grid gap-1">{j.rincian.map((r) => (
        <li key={r.kode}><span data-pengguna>{r.nama}</span>: <strong className="angka" data-testid="tanya-nilai">{angka.format(Number(r.jumlah))} {r.satuan}</strong></li>))}</ul>
    );
  }
  const nilai = j.satuan === "rupiah" ? formatRupiah(n, { bahasa }) : j.satuan === "jam" ? isiTeks(t.jam, { n: angka.format(n) }) : isiTeks(t.orang, { n: angka.format(n) });
  const tambahan = j.jumlah !== null && j.niat === "invoice_terbit" ? ` ${isiTeks(t.dariInvoice, { n: angka.format(j.jumlah) })}`
    : j.jumlah !== null && j.niat === "hutang" ? ` ${isiTeks(t.dariTagihan, { n: angka.format(j.jumlah) })}` : "";
  return <p>{t.niatNama[j.niat]} {rentang}: <strong className="angka" data-testid="tanya-nilai">{nilai}</strong>{tambahan}</p>;
}

export function FormTanya({ contoh, bahasa, teks: t }: { contoh: string[]; bahasa: Bahasa; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilTanya, FormData>(tanyaData, null);
  const id = useId();
  const isian = useRef<HTMLInputElement>(null);
  return (
    <div className="mt-6">
      <form action={aksi} className="flex flex-wrap items-end gap-2" aria-label={t.judul} data-coba-boleh>
        <div className="flex min-w-0 flex-1 flex-col gap-1"><label htmlFor={id} className="text-sm text-tinta-2">{t.label}</label>
          <input ref={isian} id={id} name="tanya" required minLength={3} maxLength={200} defaultValue={h?.tanya ?? ""} placeholder={contoh[0]}
            className="h-12 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base" /></div>
        <Tombol type="submit" disabled={sibuk} className="h-12">{t.tanya}</Tombol>
      </form>
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <span className="text-tinta-2">{t.contoh}</span>
        {contoh.map((c) => (
          <button key={c} type="button" className="rounded-full border border-garis px-3 py-1 hover:bg-kertas-2"
            onClick={() => { if (isian.current) { isian.current.value = c; isian.current.form?.requestSubmit(); } }}>{c}</button>))}
      </div>
      <div aria-live="polite" className="mt-6">
        {h && "jawaban" in h && (
          <div className="rounded-[var(--radius-kartu)] border border-garis p-4" data-testid="tanya-jawaban">
            <Kalimat j={h.jawaban} t={t} bahasa={bahasa} />
            <p className="mt-2 text-sm"><Link href={h.jawaban.sumber} className="text-laut underline underline-offset-4" data-testid="tanya-sumber">{t.lihatSumber}</Link></p>
            {h.niat.asal !== "bawaan" && (
              <p className="mt-2 text-sm text-tinta-2" data-testid="tanya-asal" data-asal={h.niat.asal} data-token={h.niat.token}>
                {h.niat.asal === "model" ? t.belajar : t.tanpaAi}
              </p>
            )}
            {h.lainnya?.map((j, i) => (
              <div key={i} className="mt-4 border-t border-garis pt-4" data-testid="tanya-jawaban-lain">
                <Kalimat j={j} t={t} bahasa={bahasa} />
                <p className="mt-2 text-sm"><Link href={j.sumber} className="text-laut underline underline-offset-4">{t.lihatSumber}</Link></p>
              </div>
            ))}
            <p className="mt-1 text-xs text-tinta-2">{t.dasar}</p>
          </div>
        )}
        {h && "tidakBisa" in h && <p role="status" className="rounded-[var(--radius-kartu)] bg-kertas-2 p-4" data-testid="tanya-tidak-bisa">{t.tidakBisa}</p>}
        {h && "galat" in h && <p role="alert" className="text-cap">{h.galat}</p>}
      </div>
    </div>
  );
}
