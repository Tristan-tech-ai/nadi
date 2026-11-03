"use client";

import { useActionState } from "react";
import { ubahTahap, type HasilKeputusan } from "@/app/app/tahap-actions";
import { Tombol } from "@/components/ui/tombol";
import { isiTeks } from "@/lib/i18n/isi-teks";
import { sisip } from "@/lib/i18n/sisip";
import type { Kamus } from "@/lib/i18n/kamus";
import type { Tahap } from "@/lib/rekrut/keputusan";

type Props = {
  lamaran: string;
  nama: string;
  tahap: Tahap;
  tanggal: string | null;
  pesan: string | null;
  hp: string | null;
  wa: { href: string; label: string } | null;
  teks: Kamus["wawancara"];
  bahasa: string;
};

/** Kartu keputusan di layar penilai (F2-05): ubah tahap, pesan singkat untuk pelamar, lalu kirim kabar lewat WhatsApp sendiri. */
export function KeputusanLamaran({ lamaran, nama, tahap, tanggal, pesan, hp, wa, teks: t, bahasa }: Props) {
  const LABEL: Record<Tahap, string> = { masuk: t.tMasuk, ditinjau: t.tDitinjau, ditawari: t.tDitawari, diterima: t.tDiterima, ditolak: t.tDitolak };
  const [h, aksi, sibuk] = useActionState<HasilKeputusan, FormData>(ubahTahap, null);
  const ditawari = tahap === "ditawari";
  return (
    <section className="mt-6 rounded-[var(--radius-kartu)] border border-garis p-4" aria-labelledby="judul-keputusan" data-testid="keputusan">
      <h2 id="judul-keputusan" className="font-semibold">{t.keputusan}</h2>
      <p className="mt-1 text-sm">
        {t.tahapSekarang} <span className="font-semibold" data-testid="tahap-sekarang">{LABEL[tahap]}</span>
        {tanggal && <span className="text-tinta-2">{isiTeks(t.sejak, { tanggal })}</span>}
      </p>
      {pesan && <p className="mt-1 text-sm text-tinta-2">{t.pesanTerakhir} <span data-pengguna>&ldquo;{pesan}&rdquo;</span></p>}

      <form action={aksi} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="lamaran" value={lamaran} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-tinta-2">{sisip(t.pesanUntuk, { nama: <span data-pengguna>{nama}</span> })}</span>
          <textarea name="pesan" maxLength={500} rows={3} placeholder={t.pesanContoh} className="rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 py-2 text-base" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-tinta-2">{t.menit}</span>
          <input type="number" name="menit" min={1} max={600} step={1} inputMode="numeric" className="h-10 w-32 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base" />
        </label>
        <div className="flex flex-wrap gap-2">
          {ditawari && <Tombol type="submit" name="tahap" value="diterima" disabled={sibuk}>{t.tandaiDiterima}</Tombol>}
          <Tombol type="submit" name="tahap" value="ditawari" ragam={ditawari ? "kedua" : "utama"} disabled={sibuk}>{t.tawarkan}</Tombol>
          <Tombol type="submit" name="tahap" value="ditinjau" ragam="kedua" disabled={sibuk}>{t.tandaiDitinjau}</Tombol>
          <Tombol type="submit" name="tahap" value="ditolak" ragam="kedua" disabled={sibuk}>{t.belumCocok}</Tombol>
        </div>
        {h && ("galat" in h ? <p role="alert" className="text-sm text-cap">{h.galat}</p> : <p role="status" className="text-sm text-daun">{h.pesan}</p>)}
      </form>

      {wa ? (
        <div className="mt-4 border-t border-garis pt-3">
          <a href={wa.href} target="_blank" rel="noopener noreferrer" data-testid="wa-kandidat" className="inline-flex h-10 items-center rounded-[var(--radius-isian)] border border-garis-kuat px-3 text-sm font-semibold">
            {wa.label}
          </a>
          <p className="mt-1 text-xs text-tinta-2">{isiTeks(t.waDisiapkan, { hp: hp ?? "" })}{bahasa !== "id" ? ` ${t.waId}` : ""}</p>
        </div>
      ) : (tahap === "ditawari" || tahap === "ditolak") && (
        <p className="mt-4 text-sm text-tinta-2">{t.tanpaHp}</p>
      )}
    </section>
  );
}
