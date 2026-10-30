import type { ReactNode } from "react";
import { formatPersen } from "@/lib/format";
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
};

/** Kartu di Feed Keputusan. Tepi bawahnya sobekan kertas thermal (satu-satunya ornamen bentuk, DIRECTION §1). */
export function KartuUsulan({ usulan, aksi }: { usulan: Usulan; aksi?: ReactNode }) {
  return (
    <article className="kartu-thermal relative bg-kertas-2 px-4 pt-4 pb-6 text-tinta">
      <header className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold leading-snug">{usulan.judul}</h3>
        {usulan.status ? <Cap jenis={usulan.status} /> : null}
      </header>
      <p className="mt-1 text-sm text-tinta-2">{usulan.penjelasan}</p>
      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta-2">
        <div>
          <dt className="sr-only">Sumber</dt>
          <dd>{usulan.sumber}</dd>
        </div>
        {usulan.keyakinan !== undefined ? (
          <div>
            <dt className="inline">Yakin </dt>
            <dd className="angka inline">{formatPersen(usulan.keyakinan)}</dd>
          </div>
        ) : null}
        {usulan.dampakRp !== undefined ? (
          <div>
            <dt className="inline">Dampak </dt>
            <dd className="inline font-semibold text-tinta">
              <Rupiah nilai={usulan.dampakRp} ringkas />
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
      <Tombol ukuran="besar" className="flex-1">Setujui</Tombol>
      <Tombol ukuran="besar" ragam="kedua">Tolak</Tombol>
    </>
  );
}
