import Link from "next/link";
import { PemilihBahasa } from "@/components/landing/pemilih-bahasa";
import { IkonFitur } from "@/components/poster/visual-fitur";
import { TandaNadi } from "@/components/ui/logo";
import { awalanJalur, type Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus } from "@/lib/i18n/kamus";
import "./poster.css";

// Kepala permukaan Persuade (docs/design/DESIGN.md bagian 5): empat pilihan (Fitur, Harga, Masuk, Coba usaha contoh). Menu Fitur
// memakai popover HTML bawaan (tanpa JavaScript): panel 9 pintu bergambar di desktop, lembar selayar penuh di HP.
const WARNA_IKON: Record<string, string> = { kunyit: "medan-kunyit", laut: "medan-laut", daun: "medan-daun", cap: "medan-cap", tinta: "medan-tinta", tulang: "medan-tinta" };

export function LogoPoster({ ukuran = 30 }: { ukuran?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <TandaNadi ukuran={ukuran} />
      <span className="papan" style={{ fontSize: ukuran * 1.05, textTransform: "none", lineHeight: 1 }}>nadi</span>
    </span>
  );
}

export function KepalaPoster({ bahasa = "id" }: { bahasa?: Bahasa }) {
  const k = ambilKamus(bahasa);
  const n = k.poster.nav;
  const awal = awalanJalur(bahasa);
  return (
    <header className="bingkai kepala-poster">
      <Link href={awal || "/"} aria-label={n.beranda} className="logo-poster"><LogoPoster /></Link>
      <nav aria-label={n.utama}>
        <button type="button" className="pemicu-fitur" popoverTarget="menu-fitur" aria-haspopup="true">
          {n.fitur} <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <Link href={`${awal}/harga`} className="hanya-lebar">{n.harga}</Link>
        <Link href="/masuk" className="hanya-lebar">{n.masuk}</Link>
        <span className="hanya-lebar"><PemilihBahasa bahasa={bahasa} /></span>
        <Link href="/demo" className="tombol-poster hanya-lebar" style={{ minHeight: 44, padding: "0 18px" }}>{n.coba}</Link>
      </nav>
      <div id="menu-fitur" popover="auto" className="menu-fitur" aria-label={n.menuFitur}>
        <button type="button" className="tutup-menu" popoverTarget="menu-fitur" popoverTargetAction="hide">{n.tutup}</button>
        <div className="kisi-fitur">
          {k.fitur.map((f) => (
            <Link key={f.slug} href={`${awal}/fitur/${f.slug}`}>
              <span className={`ikon-fitur ${WARNA_IKON[f.warna] ?? "medan-tinta"}`}><IkonFitur jenis={f.ilustrasi} /></span>
              <span><b>{f.nama}</b><span>{f.sub}</span></span>
            </Link>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center", marginTop: 18, fontWeight: 700 }}>
          <Link href={`${awal}/harga`}>{n.harga}</Link>
          <Link href="/masuk">{n.masuk}</Link>
          <PemilihBahasa bahasa={bahasa} testId="pemilih-bahasa-menu" />
        </div>
        <Link href="/demo" className="tombol-poster ajakan-menu medan-tinta" style={{ background: "var(--poster-tinta)", color: "var(--poster-tinta-tinta)" }}>{n.coba}</Link>
      </div>
    </header>
  );
}

export function KakiPoster({ bahasa = "id" }: { bahasa?: Bahasa }) {
  const k = ambilKamus(bahasa);
  const kk = k.kaki;
  const awal = awalanJalur(bahasa);
  return (
    <footer className="medan-tinta kaki-poster" style={{ overflow: "hidden" }}>
      <div className="bingkai" style={{ display: "grid", gap: 40, paddingBlock: "72px 0" }}>
        <div style={{ display: "grid", gap: 32, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))" }}>
          <p style={{ fontWeight: 700, maxWidth: "28ch" }}>{kk.slogan}</p>
          <nav aria-label={kk.produk} style={{ display: "grid", gap: 10, alignContent: "start" }}>
            <b>{kk.produk}</b>
            {k.fitur.slice(0, 5).map((f) => <Link key={f.slug} href={`${awal}/fitur/${f.slug}`}>{f.nama}</Link>)}
            <Link href={`${awal}/untuk`}>{kk.untuk}</Link>
            <Link href={`${awal}/integrasi`}>{kk.integrasi}</Link>
            <Link href="/demo">{kk.contohMakanan}</Link>
            <Link href="/demo/toko">{kk.contohToko}</Link>
          </nav>
          <nav aria-label={kk.akun} style={{ display: "grid", gap: 10, alignContent: "start" }}>
            <b>{kk.akun}</b>
            <Link href="/daftar">{kk.buatAkun}</Link>
            <Link href="/masuk">{kk.masuk}</Link>
            <Link href="/masuk/staf">{kk.masukStaf}</Link>
            <Link href={`${awal}/panduan`}>{kk.panduan}</Link>
            <Link href={`${awal}/bantuan`}>{kk.pusatBantuan}</Link>
            <Link href="/alat">{kk.alatGratis}</Link>
            <Link href="/kamus">{kk.kamusIstilah}</Link>
            <Link href="/baru">{kk.yangBaru}</Link>
          </nav>
          <nav aria-label={kk.keamanan} style={{ display: "grid", gap: 10, alignContent: "start" }}>
            <b>Nadi</b>
            <Link href={`${awal}/harga`}>{kk.harga}</Link>
            <Link href={`${awal}/tentang`}>{kk.tentang}</Link>
            <Link href={`${awal}/keamanan`}>{kk.keamanan}</Link>
            <Link href={`${awal}/privasi`}>{kk.privasi}</Link>
            <Link href={`${awal}/syarat`}>{kk.syarat}</Link>
          </nav>
        </div>
        <p className="kecil-poster">© 2026 Nadi</p>
        <div className="nama-raksasa" aria-hidden="true">nadi</div>
      </div>
    </footer>
  );
}
