"use client";

import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";
import { useActionState } from "react";
import { tautPihak, ubahStatus, type HasilSurat } from "@/app/app/surat/actions";
import { Tombol } from "@/components/ui/tombol";

const pilihan = "h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";

function Hasil({ h }: { h: HasilSurat }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="text-sm text-cap">{h.galat}</p> : <p role="status" className="text-sm text-daun">{h.pesan}</p>;
}

export type Kandidat = { id: string; nama: string; yakin: number };

/** Pilih pihak surat: kandidat dari pencocokan nama (bila ragu) atau orang lain dari daftar. */
export function FormTautPihak({ agenda, kandidat, orang, nomor, teks: t }: { agenda: string; kandidat: Kandidat[]; orang: { id: string; nama: string }[]; nomor: string; teks: Kamus["agenda"] }) {
  const [h, aksi, sibuk] = useActionState<HasilSurat, FormData>(tautPihak, null);
  return (
    <div className="mt-2 flex flex-col gap-2 text-sm">
      {kandidat.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {kandidat.map((k) => (
            <form key={k.id} action={aksi}>
              <input type="hidden" name="agenda" value={agenda} />
              <input type="hidden" name="orang" value={k.id} />
              <Tombol type="submit" ragam="kedua" disabled={sibuk}>{isiTeks(t.tautKe, { nama: k.nama, n: Math.round(k.yakin * 100) })}</Tombol>
            </form>
          ))}
        </div>
      )}
      <form action={aksi} className="flex flex-wrap items-end gap-2" aria-label={isiTeks(t.pihakAria, { nomor })}>
        <input type="hidden" name="agenda" value={agenda} />
        <label className="flex flex-col gap-1"><span className="text-tinta-2">{kandidat.length ? t.pilihLain : t.pilihOrang}</span>
          <select name="orang" required defaultValue="" className={pilihan}>
            <option value="" disabled>{t.pilih}</option>
            {orang.map((o) => <option key={o.id} value={o.id}>{o.nama}</option>)}
          </select></label>
        <Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.tautkan}</Tombol>
      </form>
      <Hasil h={h} />
    </div>
  );
}

/** Status tindak lanjut dan catatan. */
export function FormStatusSurat({ agenda, status, catatan, nomor, teks: t }: { agenda: string; status: string; catatan: string | null; nomor: string; teks: Kamus["agenda"] }) {
  const [h, aksi, sibuk] = useActionState<HasilSurat, FormData>(ubahStatus, null);
  return (
    <form action={aksi} className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-[auto_1fr_auto] sm:items-end" aria-label={isiTeks(t.tindakAria, { nomor })}>
      <input type="hidden" name="agenda" value={agenda} />
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.status}</span>
        <select name="status" defaultValue={status} className={pilihan}>
          <option value="baru">{t.stBaru}</option>
          <option value="ditindaklanjuti">{t.stTindak}</option>
          <option value="selesai">{t.stSelesai}</option>
        </select></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.catatanLabel}</span>
        <input name="catatan" defaultValue={catatan ?? ""} maxLength={500} placeholder={t.catatanContoh} className={pilihan} /></label>
      <div className="flex items-center gap-3">
        <Tombol type="submit" ragam="kedua" disabled={sibuk}>{sibuk ? t.menyimpan : t.simpan}</Tombol>
        <Hasil h={h} />
      </div>
    </form>
  );
}
