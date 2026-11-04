import Link from "next/link";
import { KakiPoster, KepalaPoster } from "@/components/poster/kepala-kaki";
import { Cap } from "@/components/poster/ilustrasi";
import { VisualFitur } from "@/components/poster/visual-fitur";
import { awalanJalur, type Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus } from "@/lib/i18n/kamus";

// Halaman fitur D-25 (docs/design/DESIGN.md, templat lima bagian dari kerangka): 1 pahlawan bergerak, 2 masalah lawan Nadi,
// 3 tiga langkah, 4 yang tidak dilakukan AI, 5 dua pintu (coba di usaha contoh, fitur berikutnya).
const MEDAN: Record<string, string> = { kunyit: "medan-kunyit", laut: "medan-laut", daun: "medan-daun", cap: "medan-cap", tinta: "medan-tinta", tulang: "medan-tulang" };
const URUT_MASALAH = ["medan-tinta", "medan-cap", "medan-kunyit"];
const URUT_LANGKAH = ["medan-kunyit", "medan-cap", "medan-daun"];

export function HalamanFitur({ slug, bahasa }: { slug: string; bahasa: Bahasa }) {
  const k = ambilKamus(bahasa);
  const p = k.poster;
  const i = k.fitur.findIndex((f) => f.slug === slug);
  const f = k.fitur[i];
  const lanjut = k.fitur[(i + 1) % k.fitur.length];
  const awal = awalanJalur(bahasa);
  const medan = MEDAN[f.warna] ?? "medan-tinta";
  const teksVisual = { diterima: p.capDiterima, lunas: p.capLunas, kartu: p.kartuHp };
  const teksHalaman = k.halamanFitur;

  return (
    <div lang={bahasa} className="poster medan-tinta">
      <section className={medan} aria-labelledby="judul-fitur">
        <KepalaPoster bahasa={bahasa} />
        <div className="bingkai pahlawan-fitur">
          <h1 id="judul-fitur" className="papan papan-raksasa judul-fitur">{f.judul}</h1>
          <div className="pahlawan-fitur-bawah">
            <div className="masuk" style={{ display: "grid", gap: 22, alignContent: "end" }}>
              <p className="teks-pendukung">{f.pendukung}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "14px 24px", alignItems: "center" }}>
                <Link href="/demo" className="tombol-poster">{f.coba}</Link>
                <Link href="/daftar" className="tautan-poster">{p.akhirTombol}</Link>
              </div>
            </div>
            <div className="visual-fitur" data-ui aria-hidden="true">
              <VisualFitur jenis={f.ilustrasi} teks={teksVisual} besar />
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="judul-masalah">
        <h2 id="judul-masalah" className="sr-only">{teksHalaman.masalah}</h2>
        <ul className="tiga-ketuk tiga-lebar">
          {f.masalah.map((m, j) => (
            <li key={m} className={`ketuk masalah-fitur ${URUT_MASALAH[j]}`}>
              <p className="papan masalah-teks"><span className="coret">{m}</span></p>
            </li>
          ))}
        </ul>
      </section>

      <section className="medan-tulang" aria-labelledby="judul-langkah">
        <div className="bingkai" style={{ paddingBlock: "clamp(72px, 10vw, 140px)", display: "grid", gap: 36 }}>
          <h2 id="judul-langkah" className="papan papan-besar">{teksHalaman.langkah}</h2>
          <ol className="langkah-fitur">
            {f.langkah.map((l, j) => (
              <li key={l} className={`${URUT_LANGKAH[j]} masuk`}>
                <div className="kartu-langkah" data-ui aria-hidden="true">
                  <span className="kartu-langkah-judul">{f.pintu}</span>
                  <span className="kartu-langkah-garis" />
                  <span className="kartu-langkah-garis pendek" />
                  {j === 0 ? <span className="kartu-langkah-status">{teksHalaman.masuk}</span> : null}
                  {j === 1 ? <span className="kartu-langkah-status">{teksHalaman.menunggu}</span> : null}
                  {j === 2 ? <Cap teks={p.capDiterima} className="cap-langkah" /> : null}
                </div>
                <p className="ket-langkah"><span className="papan" aria-hidden="true" style={{ fontSize: 44, marginRight: 12 }}>{j + 1}</span>{l}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="medan-tinta" aria-labelledby="judul-janji">
        <div className="bingkai" style={{ paddingBlock: "clamp(72px, 10vw, 140px)", display: "grid", gap: 36 }}>
          <h2 id="judul-janji" className="papan papan-besar">{teksHalaman.janji}</h2>
          <ul style={{ display: "grid", gap: 14 }}>
            {f.janji.map(([ya, t]) => (
              <li key={String(t)} className="ket-langkah" style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <TandaJanji ya={Boolean(ya)} label={ya ? teksHalaman.ya : teksHalaman.tidak} />
                <span>{String(t)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="medan-kunyit" aria-labelledby="judul-pintu-fitur">
        <h2 id="judul-pintu-fitur" className="sr-only">{teksHalaman.pintu}</h2>
        <div className="bingkai" style={{ paddingBlock: "clamp(72px, 10vw, 140px)", display: "grid", gap: 28, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", alignItems: "end" }}>
          <div style={{ display: "grid", gap: 18, justifyItems: "start" }}>
            <p className="papan papan-sedang">{f.coba}</p>
            <Link href="/demo" className="tombol-poster">{p.contoh}</Link>
          </div>
          <Link href={`${awal}/fitur/${lanjut.slug}`} className="papan papan-sedang" style={{ justifySelf: "end", textAlign: "right", textDecoration: "underline", textUnderlineOffset: 8 }}>
            {teksHalaman.berikutnya}: {lanjut.nama}
          </Link>
        </div>
      </section>

      <KakiPoster bahasa={bahasa} />
    </div>
  );
}

function TandaJanji({ ya, label }: { ya: boolean; label: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" role="img" aria-label={label} style={{ flex: "none" }}>
      <circle cx="20" cy="20" r="18" fill={ya ? "var(--poster-daun)" : "var(--poster-cap)"} />
      {ya ? (
        <path d="M12 20.5l5.5 5.5L28 15" fill="none" stroke="var(--poster-daun-tinta)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M13.5 13.5l13 13M26.5 13.5l-13 13" fill="none" stroke="var(--poster-cap-tinta)" strokeWidth="3.5" strokeLinecap="round" />
      )}
    </svg>
  );
}
