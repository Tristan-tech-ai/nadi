import Link from "next/link";
import type { ReactNode } from "react";
import { formatPersen } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { Cap, type JenisCap } from "./cap";
import { Rupiah } from "./rupiah";
import { Tombol } from "./tombol";

export type Usulan = {
  judul: string;
  penjelasan: string;
  sumber: string;
  keyakinan?: number;
  dampakRp?: number;
  status?: JenisCap;
  /** Keterangan tambahan dari Nadi, misalnya skor rubrik pelamar. */
  catatan?: string;
  /** Tautan lanjutan, misalnya ke wawancara suara pelamar. */
  tautan?: { href: string; label: string };
  /** Usulan berumur kurang dari 24 jam (D-05): penanda teks, bukan warna saja. */
  baru?: boolean;
};

export type TeksKartu = { setujui: string; tolak: string; batalkan: string; disetujui: string; ditolak: string; baru: string; sumber: string; yakin: string; dampak: string };

/** Teks bawaan = kamus id `kartu` (diuji sama di kartu-usulan.test.ts); ditulis di sini agar kamus tidak ikut ke bundel klien. */
export const TEKS_KARTU_ID: TeksKartu = { setujui: "Setujui", tolak: "Tolak", batalkan: "Batalkan", disetujui: "Disetujui.", ditolak: "Ditolak.", baru: "Baru", sumber: "Sumber", yakin: "Yakin", dampak: "Dampak" };

/** Kartu di Feed Keputusan. Tepi bawahnya sobekan kertas thermal (satu-satunya ornamen bentuk, DIRECTION §1).
 *  `isiLang` menandai judul dan penjelasan yang ditulis dalam bahasa lain dari antarmuka (WCAG 3.1.2). */
export function KartuUsulan({ usulan, aksi, teks = TEKS_KARTU_ID, bahasa = "id", isiLang }: { usulan: Usulan; aksi?: ReactNode; teks?: TeksKartu; bahasa?: Bahasa; isiLang?: string }) {
  return (
    <article className="kartu-thermal relative bg-kertas-2 px-4 pt-4 pb-6 text-tinta">
      <header className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold leading-snug" lang={isiLang}>{usulan.judul}</h3>
        {usulan.baru || usulan.status ? (
          <div className="flex shrink-0 items-center gap-2">
            {usulan.baru ? (
              <span className="rounded-full border border-garis-kuat px-2 py-0.5 text-xs font-semibold" data-testid="penanda-baru">
                {teks.baru}
              </span>
            ) : null}
            {usulan.status ? <Cap jenis={usulan.status} /> : null}
          </div>
        ) : null}
      </header>
      <p className="mt-1 text-sm text-tinta-2" lang={isiLang}>{usulan.penjelasan}</p>
      {usulan.catatan ? <p className="mt-2 text-sm" data-testid="catatan-usulan" lang={isiLang}>{usulan.catatan}</p> : null}
      {usulan.tautan ? (
        <Link href={usulan.tautan.href} className="mt-2 inline-block text-sm font-semibold text-laut underline underline-offset-4" data-testid="tautan-usulan">
          {usulan.tautan.label}
        </Link>
      ) : null}
      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta-2">
        <div>
          <dt className="sr-only">{teks.sumber}</dt>
          <dd>{usulan.sumber}</dd>
        </div>
        {usulan.keyakinan !== undefined ? (
          <div>
            <dt className="inline">{teks.yakin} </dt>
            <dd className="angka inline">{formatPersen(usulan.keyakinan)}</dd>
          </div>
        ) : null}
        {usulan.dampakRp !== undefined ? (
          <div>
            <dt className="inline">{teks.dampak} </dt>
            <dd className="inline font-semibold text-tinta">
              <Rupiah nilai={usulan.dampakRp} ringkas bahasa={bahasa} />
            </dd>
          </div>
        ) : null}
      </dl>
      {aksi ? <div className="mt-4 flex gap-2">{aksi}</div> : null}
    </article>
  );
}

export function AksiUsulan() {
  return (
    <>
      <Tombol ukuran="besar" className="flex-1">{TEKS_KARTU_ID.setujui}</Tombol>
      <Tombol ukuran="besar" ragam="kedua">{TEKS_KARTU_ID.tolak}</Tombol>
    </>
  );
}
