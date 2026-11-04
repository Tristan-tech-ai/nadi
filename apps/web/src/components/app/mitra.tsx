"use client";

import { useActionState } from "react";
import { batalkanPermintaan, kirimPermintaan, type HasilMitra } from "@/app/app/mitra/actions";
import { Tombol } from "@/components/ui/tombol";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";

type Teks = Kamus["mitraForm"];
const isian = "w-full min-w-0 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";

function Hasil({ h }: { h: HasilMitra }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="text-sm text-cap">{h.galat}</p> : <p role="status" className="text-sm text-daun" data-testid="permintaan-tersimpan">{h.pesan}</p>;
}

/** Formulir permintaan ke satu mitra: pilih layanan dan tulis kebutuhan. Kunci acak per formulir agar kirim ulang tidak ganda. */
export function FormPermintaan({ mitra, nama, layanan, kunci, teks: t, isiLang }: { mitra: string; nama: string; layanan: string[]; kunci: string; teks: Teks; isiLang?: string }) {
  const [h, aksi, sibuk] = useActionState<HasilMitra, FormData>(kirimPermintaan, null);
  const awal = h && "galat" in h ? (h.isian ?? {}) : {};
  return (
    <details className="mt-2 text-sm" open={Boolean(h)}>
      <summary className="cursor-pointer font-semibold underline underline-offset-4">{t.buka}</summary>
      <form action={aksi} className="mt-2 grid gap-2" aria-label={isiTeks(t.aria, { nama })}>
        <input type="hidden" name="mitra" value={mitra} />
        <input type="hidden" name="kunci" value={awal.kunci ?? kunci} />
        <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.layanan}</span>
          <select name="layanan" defaultValue={awal.layanan ?? layanan[0]} className={`${isian} h-10`} lang={isiLang}>
            {layanan.map((l) => <option key={l} value={l}>{l}</option>)}
          </select></label>
        <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.pesan}</span>
          <textarea name="pesan" required minLength={10} maxLength={1000} rows={3} defaultValue={awal.pesan ?? ""} placeholder={t.pesanContoh} className={`${isian} py-2`} /></label>
        <div className="flex flex-wrap items-center gap-3">
          <Tombol type="submit" ragam="kedua" disabled={sibuk} data-testid="kirim-permintaan">{sibuk ? t.mengirim : t.kirim}</Tombol>
          <Hasil h={h} />
        </div>
      </form>
    </details>
  );
}

export function FormBatalPermintaan({ permintaan, nama, teks: t }: { permintaan: string; nama: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilMitra, FormData>(batalkanPermintaan, null);
  return (
    <form action={aksi} className="flex flex-wrap items-center gap-2 text-sm">
      <input type="hidden" name="permintaan" value={permintaan} />
      <button type="submit" disabled={sibuk} className="text-tinta-2 underline underline-offset-4" aria-label={isiTeks(t.batalAria, { nama })}>{t.batalkan}</button>
      <Hasil h={h} />
    </form>
  );
}
