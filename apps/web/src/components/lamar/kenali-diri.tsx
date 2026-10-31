"use client";

import { useState } from "react";
import { Tombol } from "@/components/ui/tombol";
import { PILIHAN_IPIP } from "@/lib/rekrut/ipip";
import { IPIP_50 } from "@/lib/rekrut/ipip-50";
import { createBrowserSupabase } from "@/lib/supabase/browser";

/** Kuesioner IPIP 50 butir, opsional (F2-04). Skor tidak dipakai untuk meranking; lihat docs/research/uji-kerja.md. */
export function KenaliDiri({ lamaran, usaha }: { lamaran: string; usaha: string }) {
  const [buka, setBuka] = useState(false);
  const [jawab, setJawab] = useState<Record<number, number>>({});
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [terkirim, setTerkirim] = useState(false);
  const terisi = Object.keys(jawab).length;

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    if (!terisi) return setGalat("Pilih jawaban untuk minimal satu pernyataan, atau lewati bagian ini.");
    setSibuk(true);
    setGalat(null);
    const { error } = await createBrowserSupabase().rpc("uji_kirim", { p_lamaran: lamaran, p_jenis: "ipip", p_jawaban: jawab });
    setSibuk(false);
    if (error) return setGalat(error.code === "23505" ? "Kuesioner ini sudah terkirim sebelumnya." : `${error.message} Coba kirim lagi.`);
    setTerkirim(true);
  }

  return (
    <section className="mt-6 rounded-[var(--radius-kartu)] border border-garis p-5" aria-labelledby="judul-diri" data-testid="kenali-diri">
      <h2 id="judul-diri" className="text-lg font-semibold">Kenali dirimu</h2>
      {terkirim ? (
        <p role="status" className="mt-1" data-testid="diri-terkirim">Terkirim. {terisi} dari 50 pernyataan dijawab.</p>
      ) : !buka ? (
        <>
          <p className="mt-1 text-tinta-2">
            Tidak wajib. 50 pernyataan tentang kebiasaanmu, sekitar 7 menit. {usaha} memakainya sebagai bahan obrolan, bukan untuk menolak lamaran. Tidak ada jawaban benar atau salah.
          </p>
          <Tombol ragam="kedua" onClick={() => setBuka(true)} className="mt-3" data-testid="buka-diri">Isi kuesioner</Tombol>
        </>
      ) : (
        <form onSubmit={kirim} className="mt-1 flex flex-col gap-4">
          <p className="text-tinta-2">Seberapa sesuai pernyataan ini dengan dirimu sehari-hari?</p>
          <ol className="flex flex-col gap-3">
            {IPIP_50.map((b) => (
              <li key={b.no} className="rounded-[var(--radius-kartu)] bg-kertas-2 p-4">
                <fieldset>
                  <legend className="font-semibold"><span className="text-sm font-normal text-tinta-2">{b.no}. </span>{b.id}</legend>
                  <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-4">
                    {PILIHAN_IPIP.map((p) => (
                      <label key={p.nilai} className="flex min-h-11 items-center gap-2 text-sm">
                        <input type="radio" name={`ipip-${b.no}`} value={p.nilai} checked={jawab[b.no] === p.nilai} onChange={() => setJawab((j) => ({ ...j, [b.no]: p.nilai }))} className="size-5 accent-[var(--tinta)]" />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </li>
            ))}
          </ol>
          <p className="text-sm text-tinta-2">{terisi} dari 50 dijawab. Yang kosong tidak dihitung.</p>
          {galat && <p role="alert" className="text-sm text-cap">{galat}</p>}
          <Tombol type="submit" ragam="kedua" disabled={sibuk} className="self-start" data-testid="kirim-diri">{sibuk ? "Mengirim..." : "Kirim kuesioner"}</Tombol>
        </form>
      )}
    </section>
  );
}
