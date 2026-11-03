"use client";

import { useState } from "react";
import { Cap } from "@/components/ui/cap";
import { Rupiah } from "@/components/ui/rupiah";
import { Tombol } from "@/components/ui/tombol";
import { formatAngka } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import type { Kamus } from "@/lib/i18n/kamus";

// Isi nota uji korpus (fixtures/korpus/nota/nota-01.json, sintetis): angka yang benar-benar dibaca Nadi di eval.
const BARIS = [
  { nama: "Teh celup 25", qty: 9, harga: 9500, jumlah: 85500 },
  { nama: "Tepung terigu 1 kg", qty: 6, harga: 13500, jumlah: 81000 },
  { nama: "Bawang merah 1 kg", qty: 5, harga: 42000, jumlah: 210000 },
];
const TOTAL = 376500;
const JEDA = 260; // ms antar baris tercetak

type Putusan = "menunggu" | "diterima" | "ditolak";

/** Demo hidup pahlawan: nota tercetak baris demi baris, lalu menjadi usulan yang bisa disetujui atau ditolak. */
export function DemoNota({ teks, bahasa = "id" }: { teks: Kamus["demo"]; bahasa?: Bahasa }) {
  const [putaran, setPutaran] = useState(0);
  const [putusan, setPutusan] = useState<Putusan>("menunggu");
  const cetak = (i: number) => ({ animationDelay: `${i * JEDA}ms` });
  const ulangi = () => {
    setPutusan("menunggu");
    setPutaran((p) => p + 1);
  };

  return (
    <div key={putaran} className="relative mx-auto w-full max-w-sm">
      <figure aria-label={teks.label} className="rounded-t-[var(--radius-kartu)] border border-b-0 border-garis bg-kertas px-5 pt-5 pb-4 font-mono text-[13px] leading-6 text-tinta shadow-[0_1px_0_var(--garis)]">
        <p className="cetak text-center font-semibold" style={cetak(0)}>UD Sumber Rejeki</p>
        <p className="cetak text-center text-tinta-2" style={cetak(1)}>No: NT-4671 · Tgl: 13/10/2026</p>
        <div className="my-2 border-t border-dashed border-garis-kuat" aria-hidden />
        {BARIS.map((b, i) => (
          <div key={b.nama} className="cetak" style={cetak(i + 2)}>
            <p>{b.nama}</p>
            <p className="flex justify-between text-tinta-2">
              <span className="angka">{b.qty} x {formatAngka(b.harga)}</span>
              <span className="angka text-tinta">{formatAngka(b.jumlah)}</span>
            </p>
          </div>
        ))}
        <div className="my-2 border-t border-dashed border-garis-kuat" aria-hidden />
        <p className="cetak flex justify-between font-semibold" style={cetak(5)}>
          <span>TOTAL</span>
          <span className="angka">{formatAngka(TOTAL)}</span>
        </p>
      </figure>

      <div className="cetak relative -mt-1" style={cetak(7)}>
        <article className="kartu-thermal bg-kertas-2 px-4 pt-4 pb-6" aria-live="polite">
          <header className="flex items-start justify-between gap-3">
            <h2 className="text-base font-semibold leading-snug">
              {teks.judulAwal} <Rupiah nilai={TOTAL} bahasa={bahasa} /> {teks.judulAkhir}
            </h2>
            {putusan !== "menunggu" ? <Cap jenis={putusan} label={putusan === "diterima" ? teks.diterima : teks.ditolak} /> : null}
          </header>
          <p className="mt-1 text-sm text-tinta-2">{teks.ringkas}</p>
          {putusan === "menunggu" ? (
            <div className="mt-4 flex gap-2">
              <Tombol ukuran="besar" className="flex-1" onClick={() => setPutusan("diterima")}>{teks.setujui}</Tombol>
              <Tombol ukuran="besar" ragam="kedua" onClick={() => setPutusan("ditolak")}>{teks.tolak}</Tombol>
            </div>
          ) : (
            <p className="mt-4 flex items-center justify-between gap-3 text-sm">
              <span>{putusan === "diterima" ? teks.tercatat : teks.tidakDicatat}</span>
              <button type="button" onClick={ulangi} className="shrink-0 font-semibold underline underline-offset-4">{teks.ulangi}</button>
            </p>
          )}
        </article>
      </div>
      <p className="mt-3 text-xs text-tinta-2">{teks.catatan}</p>
    </div>
  );
}
