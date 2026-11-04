import Link from "next/link";
import { Banding } from "@/components/poster/banding";
import { CobaSendiri } from "@/components/poster/coba-sendiri";
import { ChatWa, ExcelAbsen, Ktp, Kuitansi, Mutasi, Nota, Ponsel, SlipGaji, SuratDokter } from "@/components/poster/ilustrasi";
import { LayarFeed } from "@/components/poster/layar-feed";
import type { Usulan } from "@/components/ui/kartu-usulan";
import { GantiUsaha } from "@/components/poster/ganti-usaha";
import { KakiPoster, KepalaPoster } from "@/components/poster/kepala-kaki";
import { VisualFitur } from "@/components/poster/visual-fitur";
import { Rupiah } from "@/components/ui/rupiah";
import { awalanJalur, type Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus } from "@/lib/i18n/kamus";
import { PAKET } from "@/lib/paket";

// Landing D-20 (docs/design/DESIGN.md, kerangka artefak kerangka v2 yang disetujui Tristan). Visual dulu: setiap bagian satu
// lapangan warna dan satu gambar yang bisa dipahami tanpa membaca. Urutan mengikuti psikologi-persuasi.md bagian 11: untuk aku
// (benda dari duniaku), bekerja (demonstrasi data korpus), aku tetap memegang kendali (janji).
const MEDAN: Record<string, string> = { kunyit: "medan-kunyit", laut: "medan-laut", daun: "medan-daun", cap: "medan-cap", tinta: "medan-tinta", tulang: "medan-tulang" };

export function BerandaPoster({ bahasa }: { bahasa: Bahasa }) {
  const k = ambilKamus(bahasa);
  const p = k.poster;
  const awal = awalanJalur(bahasa);
  const feed = p.feedMini as Usulan[];
  const teksVisual = { diterima: p.capDiterima, lunas: p.capLunas, kartu: p.kartuHp, feed, teksKartu: k.kartu, bahasa };

  return (
    <div lang={bahasa} className="poster medan-tinta">
      <main id="isi">
      {/* 1. Pengait: kertas usaha yang kacau tersedot ke HP dan keluar sebagai kartu bercap (digerakkan gulir). */}
      <section className="pengait medan-kunyit" aria-labelledby="judul-utama">
        <div className="pengait-panggung">
          <KepalaPoster bahasa={bahasa} />
          <div className="bingkai pengait-isi">
            <h1 id="judul-utama" className="papan papan-raksasa">
              <span style={{ display: "block" }}>{p.judul1}</span>
              <span style={{ display: "block" }} className="sorot-teks">{p.judul2}</span>
            </h1>
          </div>
          <div className="bingkai pengait-bawah">
            <div style={{ display: "grid", gap: 22, alignContent: "end" }}>
              <p className="teks-pendukung">{p.pendukung}</p>
              {/* Jenis usaha berganti (blueprint fixed-anchor-cycle): "Nadi untuk" diam, kata kedua bergulir. Tanpa gerak = daftar biasa. */}
              <p className="pita-usaha" data-testid="pita-usaha">
                <span>{p.untuk}</span>{" "}
                <GantiUsaha usaha={p.usaha} />
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "14px 24px", alignItems: "center" }}>
                <Link href="/daftar" className="tombol-poster">{p.mulai}</Link>
                <Link href="/demo" className="tautan-poster">{p.contoh}</Link>
              </div>
              <p className="petunjuk-gulir" aria-hidden="true">{p.gulir}</p>
            </div>
            <div className="pengait-meja" aria-hidden="true" data-ui>
              <div className="kertas-kacau kk-1" data-jenis="nota"><Nota /></div>
              <div className="kertas-kacau lebar kk-2" data-jenis="kuitansi"><Kuitansi /></div>
              <div className="kertas-kacau lebar kk-3" data-jenis="chat"><ChatWa teks={p.kacau.chat1} /></div>
              <div className="kertas-kacau lebar kk-4" data-jenis="excel"><ExcelAbsen /></div>
              <div className="kertas-kacau kk-5" data-jenis="surat"><SuratDokter /></div>
              <div className="kertas-kacau lebar kk-6" data-jenis="slip"><SlipGaji /></div>
              <div className="kertas-kacau lebar kk-7" data-jenis="ktp"><Ktp /></div>
              <div className="kertas-kacau lebar kk-8" data-jenis="mutasi"><Mutasi /></div>
              <div className="ponsel-tengah">
                <Ponsel>
                  <LayarFeed kartu={feed} teks={k.kartu} bahasa={bahasa} />
                </Ponsel>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Coba sendiri: hal hidup dengan berkas korpus asli. */}
      <section className="medan-tinta" aria-labelledby="judul-coba">
        <div className="bingkai coba">
          <div className="masuk judul-coba" style={{ display: "grid", gap: 18, alignContent: "start" }}>
            <h2 id="judul-coba" className="papan papan-besar">{p.cobaJudul1} <span className="sorot-teks">{p.cobaJudul2}</span></h2>
            <p style={{ maxWidth: "44ch" }}>{p.cobaKet}</p>
          </div>
          <CobaSendiri
            bahasa={bahasa}
            teks={{ pilihan: p.pilihan, diterima: p.capDiterima, ditolak: p.capDitolak, setujui: p.setujui, tolak: p.tolak, ulangi: p.ulangi, kartu: p.kartuCoba, label: p.cobaLabel }}
          />
        </div>
      </section>

      {/* 3. Cara kerja dalam tiga kata. */}
      <section aria-labelledby="judul-ketuk">
        <h2 id="judul-ketuk" className="sr-only">{p.ketukJudul}</h2>
        <ol className="tiga-ketuk">
          <li className="ketuk medan-laut">
            <span className="wadah-kilat"><svg className="gambar-ketuk" viewBox="0 0 120 160" aria-hidden="true">
              <rect x="20" y="6" width="80" height="148" rx="12" fill="var(--poster-tinta)" stroke="currentColor" strokeWidth="3" />
              <rect x="27" y="18" width="66" height="112" rx="6" fill="var(--poster-lembar)" />
              <rect x="38" y="30" width="44" height="86" rx="3" fill="var(--poster-tulang)" stroke="var(--poster-lembar-tinta)" strokeWidth="2" />
              <path d="M46 48h28M46 62h20M46 76h28M46 98h28" stroke="var(--poster-lembar-tinta)" strokeWidth="3" strokeLinecap="round" />
              <circle cx="60" cy="142" r="6" fill="var(--poster-lembar)" />
            </svg><span className="kilat-kamera" aria-hidden="true" /></span>
            <div><p className="papan papan-besar">{p.ketuk[0]}</p><p className="ket-ketuk">{p.ketukKet[0]}</p></div>
          </li>
          <li className="ketuk medan-cap">
            <svg className="gambar-ketuk" viewBox="0 0 140 110" aria-hidden="true">
              <rect x="6" y="6" width="128" height="86" rx="8" fill="var(--poster-lembar)" />
              <path d="M20 28h80M20 44h56" stroke="var(--poster-lembar-tinta)" strokeWidth="5" strokeLinecap="round" />
              <g className="cap-ketuk"><rect x="54" y="54" width="72" height="28" rx="3" fill="none" stroke="var(--lunas)" strokeWidth="4" /><text x="90" y="73" textAnchor="middle" fontSize="13" fontWeight="800" fill="var(--lunas)" fontFamily="var(--font-jakarta), sans-serif">{p.capDiterima}</text></g>
            </svg>
            <div><p className="papan papan-besar">{p.ketuk[1]}</p><p className="ket-ketuk">{p.ketukKet[1]}</p></div>
          </li>
          <li className="ketuk medan-daun">
            <svg className="gambar-ketuk" viewBox="0 0 140 110" aria-hidden="true">
              <rect x="6" y="6" width="128" height="98" rx="6" fill="var(--poster-lembar)" />
              <path d="M6 30h128M6 52h128M6 74h128M40 6v98" stroke="var(--poster-lembar-tinta)" strokeOpacity="0.25" strokeWidth="2" />
              <g className="baris-ketuk"><rect x="40" y="74" width="94" height="22" fill="var(--sorot)" /><text x="48" y="90" fontSize="12" fontWeight="800" fill="var(--poster-kunyit-tinta)" fontFamily="var(--font-jakarta), sans-serif">376.500</text></g>
            </svg>
            <div><p className="papan papan-besar">{p.ketuk[2]}</p><p className="ket-ketuk">{p.ketukKet[2]}</p></div>
          </li>
        </ol>
      </section>

      {/* 4. Sebelum dan sesudah, digeser pengunjung. */}
      <section aria-label={p.bandingJudul}>
        <Banding teks={{ label: p.bandingJudul, tanpa: p.tanpa, dengan: p.dengan, tanpaKet: p.tanpaKet, denganKet: p.denganKet, kartu: p.kartuHp, diterima: p.capDiterima, chat: p.kacau.chat1, feed, teksKartu: k.kartu, bahasa }} />
      </section>

      {/* 5. Sembilan pintu fitur. */}
      <section id="fitur" className="medan-tulang" aria-labelledby="judul-pintu" style={{ scrollMarginTop: 24 }}>
        <div className="bingkai" style={{ paddingBlock: "clamp(72px, 10vw, 140px)", display: "grid", gap: 40 }}>
          <h2 id="judul-pintu" className="papan papan-besar masuk"><span>{p.pintuJudul}</span></h2>
          <ul className="pintu">
            {k.fitur.map((f) => (
              <li key={f.slug}>
                <Link href={`${awal}/fitur/${f.slug}`} className={MEDAN[f.warna] ?? "medan-tinta"}>
                  <span className="lihat" data-ui><VisualFitur jenis={f.ilustrasi} teks={teksVisual} /></span>
                  <span className="nama"><span>{f.pintu}</span><Panah /></span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 6. Kendali tetap di pemilik. */}
      <section id="keamanan" className="medan-laut" aria-labelledby="judul-aman" style={{ scrollMarginTop: 24 }}>
        <div className="bingkai" style={{ paddingBlock: "clamp(72px, 10vw, 140px)", display: "grid", gap: 44 }}>
          <h2 id="judul-aman" className="papan papan-besar masuk"><span>{p.amanJudul}</span></h2>
          <ul className="janji">
            {p.aman.map((a, i) => <li key={a}><IkonJanji i={i} />{a}</li>)}
          </ul>
        </div>
      </section>

      {/* 7. Harga. */}
      <section id="harga" className="medan-kunyit" aria-labelledby="judul-harga" style={{ scrollMarginTop: 24 }}>
        <div className="bingkai harga-dua" style={{ paddingBlock: "clamp(72px, 10vw, 140px)" }}>
          <div className="masuk" style={{ display: "grid", gap: 18, alignContent: "start" }}>
            <h2 id="judul-harga" className="papan papan-besar">{p.hargaJudul}</h2>
            <p style={{ fontWeight: 700, maxWidth: "36ch" }}>{p.hargaSorot} {p.hargaRencana}</p>
          </div>
          <ul className="harga-poster">
            {PAKET.map((pk) => {
              const t = k.paket[pk.kode];
              return (
                <li key={pk.kode}>
                  <p className="angka-harga"><Rupiah nilai={pk.harga} bahasa={bahasa} /></p>
                  <p><b>{t.nama}</b>. {t.isi[1] ?? t.isi[0]}</p>
                </li>
              );
            })}
          </ul>
          <Link href={`${awal}/harga`} className="tautan-poster">{p.hargaLengkap}</Link>
        </div>
      </section>

      {/* 8. Pertanyaan: hanya pertanyaannya yang terlihat, jawabannya dibuka bila perlu. */}
      <section id="faq" className="medan-tulang" aria-labelledby="judul-tanya">
        <div className="bingkai" style={{ paddingBlock: "clamp(72px, 10vw, 140px)", display: "grid", gap: 32 }}>
          <h2 id="judul-tanya" className="papan papan-besar">{p.tanyaJudul}</h2>
          <div className="tanya">
            {k.isi.faq.map((f) => (
              <details key={f.tanya}><summary>{f.tanya}</summary><p>{f.jawab}</p></details>
            ))}
          </div>
          <div className="sedang-dibuat">
            <p style={{ fontWeight: 800 }}>{p.sedangDibuat}</p>
            <ul>{k.isi.sedangDibuat.map((s) => <li key={s}>{s}</li>)}</ul>
          </div>
        </div>
      </section>

      {/* 9. Penutup: satu tombol. */}
      <section className="medan-cap" aria-labelledby="judul-mulai">
        <div className="bingkai masuk" style={{ paddingBlock: "clamp(72px, 9vw, 128px)", display: "grid", gap: 28, justifyItems: "start" }}>
          <h2 id="judul-mulai" className="papan papan-raksasa">{p.akhirJudul}</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "14px 24px", alignItems: "center" }}>
            <Link href="/daftar" className="tombol-poster">{p.akhirTombol}</Link>
            <Link href="/demo" className="tautan-poster">{p.akhirContoh}</Link>
          </div>
        </div>
      </section>

      </main>
      <KakiPoster bahasa={bahasa} />
    </div>
  );
}

function Panah() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" focusable="false">
      <path d="M4 11h13M12 5l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Ikon janji keamanan: gambar garis, satu ketebalan. */
function IkonJanji({ i }: { i: number }) {
  const g = { fill: "none", stroke: "currentColor", strokeWidth: 2.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const isi = [
    <><rect x="6" y="8" width="16" height="32" rx="2" {...g} /><rect x="26" y="8" width="16" height="32" rx="2" {...g} /></>,
    <><circle cx="24" cy="24" r="16" {...g} /><path d="M18 24h12M24 18v12" {...g} /><path d="M12 12l24 24" {...g} /></>,
    <><rect x="6" y="12" width="36" height="24" rx="3" {...g} /><path d="M12 22h10M12 28h6M30 20h6v8h-6z" {...g} /></>,
    <><rect x="14" y="4" width="20" height="40" rx="4" {...g} /><circle cx="24" cy="20" r="5" {...g} /></>,
    <><path d="M10 6h22l6 6v30H10z" {...g} /><path d="M16 20h16M16 27h16M16 34h10" {...g} /></>,
    <><path d="M14 18a12 12 0 1 1-2 12" {...g} /><path d="M8 12v8h8" {...g} /></>,
  ];
  return <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">{isi[i % isi.length]}</svg>;
}

