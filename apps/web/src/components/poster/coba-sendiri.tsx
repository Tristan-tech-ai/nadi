"use client";

import { useState } from "react";
import { Cap } from "@/components/poster/ilustrasi";
import { Rupiah } from "@/components/ui/rupiah";
import { formatAngka } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";

// Hal hidup di landing (docs/research/psikologi-persuasi.md bagian 9, efek IKEA: aksi pendek yang selalu berhasil). Lima berkas
// korpus sintetis yang benar-benar dibaca Nadi di eval: nota-01, sakit-01, slip-01, absen-01, mutasi-01. Pengunjung memilih berkas, kertasnya tercetak,
// lalu kartu usulan bisa disetujui atau ditolak. Tidak ada yang disimpan.
export type TeksCoba = {
  pilihan: string[];
  diterima: string;
  ditolak: string;
  setujui: string;
  tolak: string;
  ulangi: string;
  kartu: { judul: string; ringkas: string; tercatat: string; tidakDicatat: string }[];
  label: string;
};

type Baris = [string, number | string];
const BERKAS: { kepala: string; sub: string; baris: Baris[]; total?: [string, number]; rp?: number }[] = [
  { kepala: "UD Sumber Rejeki", sub: "NT-4671 · 13/10/2026", baris: [["Teh celup 25 (9 x 9.500)", 85500], ["Tepung terigu 1 kg (6 x 13.500)", 81000], ["Bawang merah 1 kg (5 x 42.000)", 210000]], total: ["TOTAL", 376500], rp: 376500 },
  { kepala: "Surat keterangan sakit", sub: "Klinik Sehat Bersama", baris: [["Nama", "Fitri Astuti"], ["Istirahat", "3 hari"], ["Mulai", "25 Okt 2026"]] },
  { kepala: "Slip gaji Oktober 2026", sub: "Ketut Rahmawati", baris: [["Gaji pokok", 6400000], ["Tunjangan", 1100000], ["Potongan (BPJS, PPh 21)", 304000]], total: ["Diterima", 7196000], rp: 7196000 },
  // absen-01.xlsx: 5 orang x 10 hari; baris Siti Wijaya.
  { kepala: "absen_okt.xlsx", sub: "5 orang, 1 sampai 10 Okt 2026", baris: [["Siti Wijaya 01/10", "07.15-18.25"], ["Siti Wijaya 02/10", "08.16-16.43"], ["Siti Wijaya 06/10", "Sakit"]], total: ["Baris", 50] },
  // mutasi-01.csv: transfer masuk yang menyebut nomor invoice.
  { kepala: "mutasi_okt.csv", sub: "Rekening usaha, Oktober 2026", baris: [["07/10 PEMBAYARAN LISTRIK PLN", -2503000], ["09/10 TRSF CR KAFE SENJA INV/2026/X/0017", 1240000], ["09/10 TRSF DB UD SUMBER REJEKI", -559500]], rp: 1240000 },
];

export function CobaSendiri({ teks, bahasa }: { teks: TeksCoba; bahasa: Bahasa }) {
  const [pilih, setPilih] = useState(0);
  const [putusan, setPutusan] = useState<"menunggu" | "diterima" | "ditolak">("menunggu");
  const [putaran, setPutaran] = useState(0);
  const b = BERKAS[pilih];
  const kartu = teks.kartu[pilih];
  const ganti = (i: number) => {
    setPilih(i);
    setPutusan("menunggu");
    setPutaran((p) => p + 1);
  };
  const nilai = (v: number | string) => (typeof v === "number" ? formatAngka(v, bahasa) : v);
  const tunda = (i: number) => ({ animationDelay: `${i * 110}ms` });

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <div className="pilih-berkas" role="group" aria-label={teks.label}>
        {teks.pilihan.map((p, i) => (
          <button key={p} type="button" aria-pressed={pilih === i} onClick={() => ganti(i)}>{p}</button>
        ))}
      </div>
      <div className="meja-coba" key={putaran} data-ui>
        <figure className="lembar-coba" aria-label={teks.pilihan[pilih]} style={{ margin: 0 }}>
          <p className="cetak-baris" style={{ ...tunda(0), fontWeight: 800, textAlign: "center" }}>{b.kepala}</p>
          <p className="cetak-baris" style={{ ...tunda(1), textAlign: "center", fontSize: 14 }}>{b.sub}</p>
          <div className="pisah-nota" aria-hidden="true" />
          {b.baris.map(([a, v], i) => (
            <p key={a} className="cetak-baris baris" style={tunda(i + 2)}><span>{a}</span><span className="jumlah">{nilai(v)}</span></p>
          ))}
          {b.total ? (
            <>
              <div className="pisah-nota" aria-hidden="true" />
              <p className="cetak-baris baris" style={{ ...tunda(6), fontWeight: 800 }}><span>{b.total[0]}</span><span className="jumlah">{nilai(b.total[1])}</span></p>
            </>
          ) : null}
        </figure>
        <article className="kartu-coba cetak-baris" style={tunda(8)} aria-live="polite">
          <h3>
            {kartu.judul.includes("{rp}") ? (
              <>{kartu.judul.split("{rp}")[0]}<Rupiah nilai={b.rp ?? 0} bahasa={bahasa} />{kartu.judul.split("{rp}")[1]}</>
            ) : kartu.judul}
          </h3>
          {putusan !== "menunggu" ? (
            <Cap teks={putusan === "diterima" ? teks.diterima : teks.ditolak} warna={putusan === "diterima" ? "var(--lunas)" : "var(--stempel)"} className="cap-coba" />
          ) : null}
          <p style={{ fontSize: 14 }}>{kartu.ringkas}</p>
          {putusan === "menunggu" ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="tombol-poster" style={{ flex: 1, background: "var(--poster-lembar-tinta)", color: "var(--poster-lembar)" }} onClick={() => setPutusan("diterima")}>{teks.setujui}</button>
              <button type="button" className="tombol-poster" style={{ background: "var(--poster-tulang)", color: "var(--poster-tulang-tinta)" }} onClick={() => setPutusan("ditolak")}>{teks.tolak}</button>
            </div>
          ) : (
            <p style={{ display: "flex", justifyContent: "space-between", gap: 12, fontWeight: 700, fontSize: 14 }}>
              <span>{putusan === "diterima" ? kartu.tercatat : kartu.tidakDicatat}</span>
              <button type="button" className="tautan-poster tombol-teks" onClick={() => { setPutusan("menunggu"); setPutaran((p) => p + 1); }}>{teks.ulangi}</button>
            </p>
          )}
        </article>
      </div>
    </div>
  );
}
