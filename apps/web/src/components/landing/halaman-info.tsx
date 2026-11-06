import Link from "next/link";
import type { ReactNode } from "react";
import { KakiPoster, KepalaPoster } from "@/components/poster/kepala-kaki";
import { VisualFitur } from "@/components/poster/visual-fitur";
import type { Usulan } from "@/components/ui/kartu-usulan";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus } from "@/lib/i18n/kamus";

export type WarnaHalaman = "kunyit" | "laut" | "daun" | "cap" | "tulang";

/**
 * Kerangka halaman pendukung publik (D-26, docs/design/DESIGN.md mode Read): kepala dan kaki poster, judul di lapangan warna,
 * lalu lembar baca. Keterbacaan menang dari estetika: teks 17 px tinta penuh, baris paling lebar sekitar 66 karakter, tabel tetap
 * tabel, pemisah berupa ruang (tanpa garis rambut). Di layar lebar bagian boleh membawa potongan antarmuka asli di kolom kanan.
 */
export function HalamanInfo({ judul, pengantar, draf, children, bahasa = "id", warna = "kunyit" }:
  { judul: string; pengantar?: string; draf?: string; children: ReactNode; bahasa?: Bahasa; warna?: WarnaHalaman }) {
  const p = ambilKamus(bahasa).poster;
  return (
    <div lang={bahasa} className="poster medan-lembar">
      <main id="isi">
        <section className={`medan-${warna}`} aria-labelledby="judul-halaman">
          <KepalaPoster bahasa={bahasa} />
          <div className="bingkai kepala-baca">
            <h1 id="judul-halaman" className="papan papan-besar">{judul}</h1>
            {pengantar && <p className="pengantar-baca">{pengantar}</p>}
          </div>
        </section>
        <div className="bingkai isi-baca">
          {draf && (
            <p className="catatan-draf" role="note">
              <span className="font-bold">{bahasa === "en" ? "Draft." : "Draf."}</span> {draf}
            </p>
          )}
          {children}
        </div>
        {/* L-01: satu tujuan per halaman. Setiap halaman pendukung berakhir di ajakan yang sama dengan landing. */}
        <section className="medan-cap" aria-labelledby="judul-ajakan" data-testid="ajakan-akhir">
          <div className="bingkai" style={{ paddingBlock: "clamp(64px, 8vw, 112px)", display: "grid", gap: 24, justifyItems: "start" }}>
            <h2 id="judul-ajakan" className="papan papan-besar">{p.akhirJudul}</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "14px 24px", alignItems: "center" }}>
              <Link href="/demo" className="tombol-poster">{p.nav.coba}</Link>
              <Link href="/daftar" className="tautan-poster">{p.akhirTombol}</Link>
            </div>
          </div>
        </section>
      </main>
      <KakiPoster bahasa={bahasa} />
    </div>
  );
}

/** Potongan antarmuka (gambar kerja Nadi yang sama dengan landing) untuk kolom kanan bagian baca. */
export function GambarBaca({ jenis, bahasa }: { jenis: string; bahasa: Bahasa }) {
  const k = ambilKamus(bahasa);
  const p = k.poster;
  const teks = { diterima: p.capDiterima, lunas: p.capLunas, kartu: p.kartuHp, feed: p.feedMini as Usulan[], teksKartu: k.kartu, bahasa };
  return <div className="gambar-baca" data-ui aria-hidden="true"><VisualFitur jenis={jenis} teks={teks} /></div>;
}

/** Satu bagian berjudul di halaman pendukung; `gambar` (opsional) tampil di kolom kanan pada layar lebar. */
export function Bagian({ judul, children, gambar }: { judul: string; children: ReactNode; gambar?: ReactNode }) {
  return (
    <section className={`bagian-baca masuk${gambar ? " baca-dua" : ""}`}>
      <div>
        <h2 className="papan papan-sedang">{judul}</h2>
        <div className="mt-4 space-y-3">{children}</div>
      </div>
      {gambar}
    </section>
  );
}
