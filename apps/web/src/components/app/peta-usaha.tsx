"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export type ZonaPeta = {
  id: string;
  nama: string;
  jenis: "meja" | "antrean" | "rak";
  poligon: [number, number][];
  status?: "kosong" | "terisi" | null;
  jumlah?: number | null;
  sejak?: string | null;
};
type Pesan = { zona: string; status?: "kosong" | "terisi"; jumlah?: number; sejak?: string };

const LEBAR = 1000;
const TINGGI = 750;

function teksZona(z: ZonaPeta) {
  if (z.jenis === "meja") return z.status === "terisi" ? "Terisi" : z.status === "kosong" ? "Kosong" : "Belum ada data";
  return typeof z.jumlah === "number" ? `${z.jumlah} orang` : "Belum ada data";
}

function jam(iso?: string | null) {
  return iso ? new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "";
}

/** Denah langsung: poligon zona berlabel status, diperbarui dari Supabase Realtime Broadcast tanpa muat ulang. */
export function PetaUsaha({ awal, topik, privat, judul, muatAwal }: {
  awal?: ZonaPeta[];
  topik?: string;
  privat: boolean;
  judul: string;
  /** Demo: ambil denah awal di peramban (halaman demo di-cache server berjam-jam). */
  muatAwal?: string;
}) {
  const [zona, setZona] = useState<ZonaPeta[]>(awal ?? []);
  const [topikAktif, setTopikAktif] = useState(topik);
  const [hidup, setHidup] = useState(false);
  const [berubah, setBerubah] = useState<string | null>(null);
  const [galat, setGalat] = useState(false);
  const sb = useRef(createBrowserSupabase());

  useEffect(() => {
    if (!muatAwal) return;
    let batal = false;
    sb.current.rpc("peta_demo", { p_kunci: muatAwal }).then(({ data, error }) => {
      if (batal) return;
      if (error || !data) return setGalat(true);
      const d = data as { topik: string; zona: ZonaPeta[] };
      setZona(d.zona);
      setTopikAktif(d.topik);
    });
    return () => {
      batal = true;
    };
  }, [muatAwal]);

  useEffect(() => {
    if (!topikAktif) return;
    const klien = sb.current;
    let kanal: ReturnType<typeof klien.channel> | null = null;
    let batal = false;
    (async () => {
      if (privat) await klien.realtime.setAuth();
      if (batal) return;
      kanal = klien
        .channel(topikAktif, { config: { private: privat } })
        .on("broadcast", { event: "zona" }, ({ payload }) => {
          const p = payload as Pesan;
          setZona((zs) => zs.map((z) => (z.id === p.zona ? { ...z, status: p.status ?? z.status, jumlah: p.jumlah ?? z.jumlah, sejak: p.sejak ?? z.sejak } : z)));
          setBerubah(p.zona);
        })
        .subscribe((s) => setHidup(s === "SUBSCRIBED"));
    })();
    return () => {
      batal = true;
      if (kanal) klien.removeChannel(kanal);
    };
  }, [topikAktif, privat]);

  const meja = zona.filter((z) => z.jenis === "meja");
  const terisi = meja.filter((z) => z.status === "terisi").length;
  const antre = zona.filter((z) => z.jenis !== "meja").reduce((n, z) => n + (z.jumlah ?? 0), 0);
  const zonaBerubah = zona.find((z) => z.id === berubah);

  return (
    <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-peta" data-testid="peta-usaha">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="judul-peta" className="text-lg font-semibold">{judul}</h2>
        <p className="flex items-center gap-2 text-sm text-tinta-2" data-testid="peta-hidup" data-hidup={hidup ? "ya" : "tidak"}>
          {hidup ? <span className="denyut inline-block size-2 rounded-full bg-daun" aria-hidden /> : null}
          {hidup ? "Langsung" : "Menyambung..."}
        </p>
      </div>
      {galat ? (
        <p role="alert" className="mt-3 text-sm text-tinta-2">Denah belum bisa dibuka. Coba muat ulang sebentar lagi.</p>
      ) : !zona.length ? (
        <p className="mt-3 text-sm text-tinta-2" data-testid="peta-kosong">Belum ada zona. Gambar zona meja atau antrean di Mata, lalu denahnya muncul di sini.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-tinta-2" data-testid="peta-ringkas">
            {meja.length ? `${terisi} dari ${meja.length} meja terisi` : null}
            {meja.length && zona.length > meja.length ? ", " : null}
            {zona.length > meja.length ? `${antre} orang di antrean dan rak` : null}.
          </p>
          <svg viewBox={`0 0 ${LEBAR} ${TINGGI}`} className="mt-3 w-full rounded-[var(--radius-kartu)] border border-garis bg-kertas-2" role="img" aria-label={`Denah ${judul.toLowerCase()}`}>
            {zona.map((z) => {
              const titik = z.poligon.map(([x, y]) => `${x * LEBAR},${y * TINGGI}`).join(" ");
              const cx = (z.poligon.reduce((s, [x]) => s + x, 0) / z.poligon.length) * LEBAR;
              const cy = (z.poligon.reduce((s, [, y]) => s + y, 0) / z.poligon.length) * TINGGI;
              const penuh = z.jenis === "meja" ? z.status === "terisi" : (z.jumlah ?? 0) > 0;
              // Di atas kunyit teks harus gelap di kedua tema (kertas gelap = hampir hitam), bukan tinta yang terang di tema gelap.
              const tinta = penuh ? "fill-tinta dark:fill-kertas" : "fill-tinta";
              return (
                <g key={z.id} data-testid="peta-zona" data-nama={z.nama} data-status={z.jenis === "meja" ? z.status ?? "" : String(z.jumlah ?? "")}>
                  <polygon points={titik} className={penuh ? "fill-kunyit stroke-tinta" : "fill-kertas stroke-garis-kuat"} strokeWidth={3} />
                  <text x={cx} y={cy - 8} textAnchor="middle" className={`${tinta} text-[28px] font-semibold`}>{z.nama}</text>
                  <text x={cx} y={cy + 26} textAnchor="middle" className={`${tinta} text-[24px]`}>{teksZona(z)}</text>
                </g>
              );
            })}
          </svg>
          <ul className="mt-3 grid gap-x-6 divide-y divide-garis border-y border-garis text-sm sm:grid-cols-2 sm:divide-y-0">
            {zona.map((z) => (
              <li key={z.id} className="flex justify-between gap-3 py-1.5">
                <span>{z.nama}</span>
                <span className="text-tinta-2">{teksZona(z)}{z.sejak ? `, sejak ${jam(z.sejak)}` : ""}</span>
              </li>
            ))}
          </ul>
          <p className="sr-only" aria-live="polite">{zonaBerubah ? `${zonaBerubah.nama} sekarang ${teksZona(zonaBerubah).toLowerCase()}.` : ""}</p>
        </>
      )}
    </section>
  );
}
