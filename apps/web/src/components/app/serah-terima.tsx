"use client";

import { useActionState } from "react";
import { batalkanBerhenti, catatBerhenti, pindahkanSemua, tandaiButir, type HasilSerah } from "@/app/app/serah-terima/actions";
import { Tombol } from "@/components/ui/tombol";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";

type Teks = Kamus["serahTerima"];

const isian = "h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";

function Hasil({ h }: { h: HasilSerah }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="text-sm text-cap">{h.galat}</p> : <p role="status" className="text-sm text-daun">{h.pesan}</p>;
}

/** Catat berhenti: orang, tanggal surat, tanggal efektif, alasan. Kunci acak per formulir supaya kirim ulang tidak menggandakan. */
export function FormCatatBerhenti({ orang, pilih, hari, kunci, teks: t }: { orang: { id: string; nama: string }[]; pilih: string; hari: string; kunci: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilSerah, FormData>(catatBerhenti, null);
  const isi = h && "galat" in h ? (h.isian ?? {}) : {};
  return (
    <form key={JSON.stringify(isi)} action={aksi} className="mt-4 grid grid-cols-1 gap-3 rounded-[var(--radius-kartu)] border border-garis p-4 text-sm sm:grid-cols-2" aria-label={t.catatAria}>
      <input type="hidden" name="kunci" value={isi.kunci ?? kunci} />
      <label className="flex flex-col gap-1 sm:col-span-2"><span className="text-tinta-2">{t.siapa}</span>
        <select name="orang" required defaultValue={isi.orang ?? pilih} className={isian}>
          <option value="" disabled>{t.pilihOrang}</option>
          {orang.map((o) => <option key={o.id} value={o.id} data-pengguna>{o.nama}</option>)}
        </select></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.tglSurat}</span>
        <input type="date" name="surat" required defaultValue={isi.surat ?? hari} className={isian} /></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.tglEfektif}</span>
        <input type="date" name="efektif" required defaultValue={isi.efektif ?? ""} className={isian} /></label>
      <label className="flex flex-col gap-1 sm:col-span-2"><span className="text-tinta-2">{t.alasan}</span>
        <select name="alasan" required defaultValue={isi.alasan ?? "mundur"} className={isian}>
          <option value="mundur">{t.oMundur}</option>
          <option value="kontrak_selesai">{t.oKontrak}</option>
          <option value="lainnya">{t.oLain}</option>
        </select></label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Tombol type="submit" ragam="kedua" disabled={sibuk}>{sibuk ? t.menyiapkan : t.siapkan}</Tombol>
        <Hasil h={h} />
      </div>
    </form>
  );
}

export function FormPindahkan({ berhenti, jumlah, teks: t }: { berhenti: string; jumlah: number; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilSerah, FormData>(pindahkanSemua, null);
  return (
    <form action={aksi} className="mt-3 flex flex-wrap items-center gap-3">
      <input type="hidden" name="berhenti" value={berhenti} />
      <Tombol type="submit" ragam="utama" disabled={sibuk || jumlah === 0}>{sibuk ? t.memindah : isiTeks(t.pindahkan, { n: jumlah })}</Tombol>
      <Hasil h={h} />
    </form>
  );
}

/** Ganti pengganti satu butir kerja/topi. */
export function FormPengganti({ butir, judul, pengganti, orang, teks: t }: { butir: string; judul: string; pengganti: string | null; orang: { id: string; nama: string }[]; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilSerah, FormData>(tandaiButir, null);
  return (
    <form action={aksi} className="flex flex-wrap items-center gap-2" aria-label={isiTeks(t.penggantiAria, { judul })}>
      <input type="hidden" name="butir" value={butir} />
      <input type="hidden" name="status" value="terbuka" />
      <label className="sr-only" htmlFor={`pengganti-${butir}`}>{isiTeks(t.penggantiLabel, { judul })}</label>
      <select id={`pengganti-${butir}`} name="pengganti" defaultValue={pengganti ?? ""} className={isian}>
        <option value="">{t.belumPengganti}</option>
        {orang.map((o) => <option key={o.id} value={o.id} data-pengguna>{o.nama}</option>)}
      </select>
      <Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.simpan}</Tombol>
      <Hasil h={h} />
    </form>
  );
}

/** Centang butir (ilmu, akses manual) selesai atau buka lagi. */
export function FormCentang({ butir, judul, selesai, teks: t }: { butir: string; judul: string; selesai: boolean; teks: Teks }) {
  const label = selesai ? t.bukaLagi : t.tandaiBeres;
  const [h, aksi, sibuk] = useActionState<HasilSerah, FormData>(tandaiButir, null);
  return (
    <form action={aksi} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="butir" value={butir} />
      <input type="hidden" name="status" value={selesai ? "terbuka" : "selesai"} />
      <Tombol type="submit" ragam="kedua" disabled={sibuk} aria-label={isiTeks(t.centangAria, { aksi: label, judul })}>{label}</Tombol>
      <Hasil h={h} />
    </form>
  );
}

export function FormBatalBerhenti({ berhenti, teks: t }: { berhenti: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilSerah, FormData>(batalkanBerhenti, null);
  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer text-tinta-2">{t.batalkanProses}</summary>
      <form action={aksi} className="mt-2 flex flex-wrap items-end gap-2" aria-label={t.batalkanProses}>
        <input type="hidden" name="berhenti" value={berhenti} />
        <label className="flex min-w-0 flex-1 flex-col gap-1"><span className="text-tinta-2">{t.alasan}</span>
          <input name="alasan" required minLength={3} maxLength={300} className={isian} /></label>
        <Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.batalkan}</Tombol>
        <Hasil h={h} />
      </form>
    </details>
  );
}
