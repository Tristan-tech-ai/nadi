"use client";

import { useState } from "react";
import { Cap, ChatWa, ExcelAbsen, Kuitansi, Nota, Ponsel, SuratDokter } from "@/components/poster/ilustrasi";

// Penggeser sebelum/sesudah (kerangka layar 3). Pengunjung sendiri yang menggeser: kiri meja kasir penuh kertas, kanan HP dengan
// kartu bercap. Input range penuh di atas gambar, jadi bisa dengan jari, tetikus, dan papan ketik (panah kiri/kanan).
export type TeksBanding = { label: string; tanpa: string; dengan: string; tanpaKet: string; denganKet: string; kartu: string[]; diterima: string; chat: string };

export function Banding({ teks }: { teks: TeksBanding }) {
  const [g, setG] = useState(52);
  return (
    <div className="banding" style={{ ["--g" as string]: `${g}%` }}>
      <div className="sisi medan-tulang">
        <div style={{ display: "grid", gap: 10, maxWidth: "40%" }}>
          <p className="papan papan-besar">{teks.tanpa}</p>
          <p style={{ fontWeight: 700 }}>{teks.tanpaKet}</p>
        </div>
        <div className="meja-berantakan" aria-hidden="true" data-ui>
          <Nota className="kertas-kacau" style={{ position: "absolute", left: "0%", bottom: "6%", rotate: "-10deg" }} />
          <Kuitansi className="kertas-kacau lebar" style={{ position: "absolute", left: "26%", bottom: "30%", rotate: "8deg" }} />
          <ExcelAbsen className="kertas-kacau lebar" style={{ position: "absolute", left: "48%", bottom: "0%", rotate: "-5deg" }} />
          <SuratDokter className="kertas-kacau" style={{ position: "absolute", left: "70%", bottom: "26%", rotate: "11deg" }} />
          <ChatWa teks={teks.chat} className="kertas-kacau lebar" style={{ position: "absolute", left: "10%", bottom: "58%", rotate: "-3deg" }} />
        </div>
      </div>
      <div className="sisi sesudah medan-laut">
        <div className="isi-sesudah" style={{ display: "grid", gap: 10, maxWidth: "40%" }}>
          <p className="papan papan-besar">{teks.dengan}</p>
          <p style={{ fontWeight: 700 }}>{teks.denganKet}</p>
        </div>
        <div className="hp-rapi" aria-hidden="true" data-ui>
          <Ponsel>
            {teks.kartu.slice(0, 4).map((k) => (
              <div key={k} className="kartu-ponsel" style={{ animation: "none" }}>{k}<Cap teks={teks.diterima} className="cap-ponsel" style={{ animation: "none" }} /></div>
            ))}
          </Ponsel>
        </div>
      </div>
      <div className="pegangan" aria-hidden="true"><span><svg width="28" height="16" viewBox="0 0 28 16" focusable="false"><path d="M8 2L2 8l6 6M20 2l6 6-6 6M2 8h24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg></span></div>
      <label htmlFor="geser-banding" className="sr-only">{teks.label}</label>
      <input id="geser-banding" type="range" min={6} max={94} value={g} onChange={(e) => setG(Number(e.target.value))} aria-valuetext={`${g}%`} />
    </div>
  );
}
