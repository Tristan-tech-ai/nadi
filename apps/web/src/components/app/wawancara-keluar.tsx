"use client";

import { useActionState } from "react";
import { buatTautanKeluar, type HasilKeluar } from "@/app/app/serah-terima/actions";
import { Tombol } from "@/components/ui/tombol";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";
import { tautanWa } from "@/lib/rekrut/keputusan";

// Pesan ke orang yang berhenti selalu bahasa Indonesia (penerima di Indonesia; sama dengan keputusan pesan WA pelamar).
const PESAN_WA = "Halo {nama}, sebelum hari terakhirmu kami ingin mendengar pendapatmu lewat 3 pertanyaan singkat. Jawabanmu tidak memengaruhi hakmu: {tautan}";

/** F3-07D: pemilik membuat tautan wawancara keluar dan mengirimnya sendiri lewat WhatsApp (Nadi tidak mengirim pesan). */
export function TautanKeluar({ berhenti, nama, hp, ada, teks: t, bahasa }: { berhenti: string; nama: string; hp: string | null; ada: boolean; teks: Kamus["wkPemilik"]; bahasa: string }) {
  const [h, aksi, sibuk] = useActionState<HasilKeluar, FormData>(buatTautanKeluar, {});
  const wa = h.tautan ? tautanWa(hp, isiTeks(PESAN_WA, { nama, tautan: h.tautan })) : null;
  return (
    <div className="mt-2 flex flex-col gap-2 text-sm">
      <form action={aksi}>
        <input type="hidden" name="berhenti" value={berhenti} />
        <Tombol type="submit" ragam="kedua" disabled={sibuk} data-testid="buat-tautan-keluar">{sibuk ? t.membuat : ada || h.tautan ? t.buatLagi : t.buat}</Tombol>
      </form>
      {h.tautan ? (
        <>
          <input readOnly value={h.tautan} aria-label={t.tautanAria} className="h-10 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 font-mono text-xs" data-testid="tautan-keluar" />
          {wa ? <a href={wa} target="_blank" rel="noopener noreferrer" className="self-start font-semibold text-laut underline underline-offset-4">{t.kirimWa}</a> : null}
          {bahasa !== "id" ? <p className="text-xs text-tinta-2">{t.waId}</p> : null}
        </>
      ) : null}
      {h.galat ? <p role="alert" className="text-cap">{h.galat}</p> : null}
    </div>
  );
}
