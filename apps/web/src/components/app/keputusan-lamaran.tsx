"use client";

import { useActionState } from "react";
import { ubahTahap, type HasilKeputusan } from "@/app/app/tahap-actions";
import { Tombol } from "@/components/ui/tombol";
import { LABEL_PEMILIK, type Tahap } from "@/lib/rekrut/keputusan";

type Props = {
  lamaran: string;
  nama: string;
  tahap: Tahap;
  tanggal: string | null;
  pesan: string | null;
  hp: string | null;
  wa: { href: string; label: string } | null;
};

/** Kartu keputusan di layar penilai (F2-05): ubah tahap, pesan singkat untuk pelamar, lalu kirim kabar lewat WhatsApp sendiri. */
export function KeputusanLamaran({ lamaran, nama, tahap, tanggal, pesan, hp, wa }: Props) {
  const [h, aksi, sibuk] = useActionState<HasilKeputusan, FormData>(ubahTahap, null);
  const ditawari = tahap === "ditawari";
  return (
    <section className="mt-6 rounded-[var(--radius-kartu)] border border-garis p-4" aria-labelledby="judul-keputusan" data-testid="keputusan">
      <h2 id="judul-keputusan" className="font-semibold">Keputusan</h2>
      <p className="mt-1 text-sm">
        Tahap sekarang: <span className="font-semibold" data-testid="tahap-sekarang">{LABEL_PEMILIK[tahap]}</span>
        {tanggal && <span className="text-tinta-2"> sejak {tanggal}</span>}
      </p>
      {pesan && <p className="mt-1 text-sm text-tinta-2">Pesan terakhir untuk pelamar: &ldquo;{pesan}&rdquo;</p>}

      <form action={aksi} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="lamaran" value={lamaran} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-tinta-2">Pesan untuk {nama} (boleh kosong, tampil di halaman status lamarannya)</span>
          <textarea name="pesan" maxLength={500} rows={3} placeholder="Misalnya: datang Senin 09.00, bawa KTP." className="rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 py-2 text-base" />
        </label>
        <div className="flex flex-wrap gap-2">
          {ditawari && <Tombol type="submit" name="tahap" value="diterima" disabled={sibuk}>Tandai diterima</Tombol>}
          <Tombol type="submit" name="tahap" value="ditawari" ragam={ditawari ? "kedua" : "utama"} disabled={sibuk}>Tawarkan kerja</Tombol>
          <Tombol type="submit" name="tahap" value="ditinjau" ragam="kedua" disabled={sibuk}>Tandai ditinjau</Tombol>
          <Tombol type="submit" name="tahap" value="ditolak" ragam="kedua" disabled={sibuk}>Belum cocok</Tombol>
        </div>
        {h && ("galat" in h ? <p role="alert" className="text-sm text-cap">{h.galat}</p> : <p role="status" className="text-sm text-daun">{h.pesan}</p>)}
      </form>

      {wa ? (
        <div className="mt-4 border-t border-garis pt-3">
          <a href={wa.href} target="_blank" rel="noopener noreferrer" data-testid="wa-kandidat" className="inline-flex h-10 items-center rounded-[var(--radius-isian)] border border-garis-kuat px-3 text-sm font-semibold">
            {wa.label}
          </a>
          <p className="mt-1 text-xs text-tinta-2">Teksnya sudah disiapkan Nadi untuk {hp}. Periksa dulu sebelum dikirim dari WhatsApp-mu.</p>
        </div>
      ) : (tahap === "ditawari" || tahap === "ditolak") && (
        <p className="mt-4 text-sm text-tinta-2">Nomor HP pelamar tidak tercatat, jadi kabar lewat WhatsApp tidak bisa disiapkan.</p>
      )}
    </section>
  );
}
