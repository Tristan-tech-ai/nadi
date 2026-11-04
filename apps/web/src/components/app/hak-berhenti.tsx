"use client";

import { useActionState } from "react";
import { ajukanHak, type HasilSerah } from "@/app/app/serah-terima/actions";
import { Tombol } from "@/components/ui/tombol";
import type { Kamus } from "@/lib/i18n/kamus";

type Teks = Kamus["hakBerhenti"];
export type SaranHak = { gaji: number | null; dasarGaji: string; cuti: number | null; cutiHari: number | null; upahHarian: number | null; uangPisah: number | null };

const isian = "h-10 w-full min-w-0 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-right text-base angka";
const titik = (n: number | null) => (n === null ? "" : new Intl.NumberFormat("id-ID").format(n));

/** F3-07E: angka saran dari hitungan Nadi yang boleh diubah pemilik, lalu diajukan sebagai satu usulan Feed. */
export function FormHakBerhenti({ berhenti, saran, teks: t }: { berhenti: string; saran: SaranHak; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilSerah, FormData>(ajukanHak, null);
  const awal = h && "galat" in h ? (h.isian ?? {}) : {};
  const nilai = (k: string, d: number | null) => awal[k] ?? titik(d);
  return (
    <form action={aksi} className="mt-3 grid gap-3 text-sm sm:grid-cols-3" aria-label={t.aria} data-testid="form-hak">
      <input type="hidden" name="berhenti" value={berhenti} />
      <input type="hidden" name="dasar_gaji" value={saran.dasarGaji} />
      <input type="hidden" name="cuti_hari" value={saran.cutiHari ?? ""} />
      <input type="hidden" name="upah_harian" value={saran.upahHarian ?? ""} />
      <label className="flex min-w-0 flex-col gap-1"><span className="text-tinta-2">{t.labelGaji}</span>
        <input name="gaji_akhir" inputMode="numeric" defaultValue={nilai("gaji_akhir", saran.gaji)} className={isian} /></label>
      <label className="flex min-w-0 flex-col gap-1"><span className="text-tinta-2">{t.labelCuti}</span>
        <input name="cuti" inputMode="numeric" defaultValue={nilai("cuti", saran.cuti)} className={isian} /></label>
      <label className="flex min-w-0 flex-col gap-1"><span className="text-tinta-2">{t.labelPisah}</span>
        <input name="uang_pisah" inputMode="numeric" defaultValue={nilai("uang_pisah", saran.uangPisah)} className={isian} /></label>
      <p className="text-xs text-tinta-2 sm:col-span-3">{t.pisahKet}</p>
      <p className="text-tinta-2 sm:col-span-3">{t.ajukanKet}</p>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <Tombol type="submit" ragam="kedua" disabled={sibuk} data-testid="ajukan-hak">{sibuk ? t.mengajukan : t.ajukan}</Tombol>
        {h && ("galat" in h ? <p role="alert" className="text-cap">{h.galat}</p> : <p role="status" className="text-daun" data-testid="hak-terkirim">{h.pesan}</p>)}
      </div>
    </form>
  );
}
