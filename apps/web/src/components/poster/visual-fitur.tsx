// Gambar bergerak per fitur (pintu di landing dan pahlawan halaman fitur). Gerak lewat kelas di poster.css; diam saat gerak
// dikurangi. Semua dekoratif: nama fitur ada di teks tautan atau judul.
import type { ReactNode } from "react";
import { LayarFeed } from "@/components/poster/layar-feed";
import type { TeksKartu, Usulan } from "@/components/ui/kartu-usulan";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { Cap, Denah, KodeContoh, Nota, Ponsel } from "@/components/poster/ilustrasi";

export type JenisVisual = "nota" | "feed" | "absen" | "gaji" | "tagihan" | "jadwal" | "mata" | "rekrut" | "pajak";

type Teks = { diterima: string; lunas: string; kartu: string[]; feed?: Usulan[]; teksKartu?: TeksKartu; bahasa?: Bahasa };

export function VisualFitur({ jenis, teks, besar = false }: { jenis: string; teks: Teks; besar?: boolean }) {
  const ukur = besar ? "min(78%, 420px)" : "52%";
  switch (jenis as JenisVisual) {
    case "nota":
      return (
        <div aria-hidden="true" style={{ position: "absolute", left: "50%", top: "50%", translate: "-50% -50%", width: besar ? "min(60%, 300px)" : "40%" }}>
          <Nota />
          <span className="nota-pindai" style={{ position: "absolute", left: "-6%", right: "-6%", top: "8%", height: 4, background: "var(--sorot)", ["--pindai" as string]: besar ? "300px" : "110px" }} />
        </div>
      );
    case "feed":
      return (
        <div aria-hidden="true" style={{ position: "absolute", left: "50%", top: besar ? "50%" : "58%", translate: "-50% -50%", scale: besar ? "1.25" : "0.86" }}>
          <Ponsel>
            {teks.feed ? <LayarFeed kartu={teks.feed} teks={teks.teksKartu} bahasa={teks.bahasa} jumlah={2} /> : teks.kartu.slice(0, 3).map((k, i) => (
              <div key={k} className="kartu-ponsel">{k}{i < 2 ? <Cap teks={teks.diterima} className="cap-ponsel" /> : null}</div>
            ))}
          </Ponsel>
        </div>
      );
    case "absen":
      return (
        <div aria-hidden="true" style={{ position: "absolute", left: "50%", top: "50%", translate: "-50% -50%", display: "flex", gap: besar ? 28 : 14, alignItems: "center", width: besar ? "min(86%, 480px)" : "78%" }}>
          <KodeContoh className="qr-berkedip" style={{ width: "58%", flex: "none" }} />
          <span className="papan hitung-mundur" style={{ fontSize: besar ? "clamp(64px, 10vw, 128px)" : "clamp(36px, 15cqw, 76px)" }} />
        </div>
      );
    case "gaji":
      return (
        <div aria-hidden="true" className="slip-tersusun" style={{ position: "absolute", left: "50%", top: "50%", translate: "-50% -50%", width: ukur, display: "grid", gap: besar ? 12 : 6, background: "var(--poster-lembar)", color: "var(--poster-lembar-tinta)", borderRadius: 10, padding: besar ? 26 : 14, fontWeight: 800, fontSize: besar ? 20 : 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Pokok</span><span>6.400.000</span></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Tunjangan</span><span>1.100.000</span></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>PPh 21, BPJS</span><span>304.000</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--lunas)" }}><span>Ketut</span><span>7.196.000</span></div>
        </div>
      );
    case "tagihan":
      return (
        <div aria-hidden="true" style={{ position: "absolute", left: "50%", top: "48%", translate: "-50% -50%", width: besar ? "min(56%, 300px)" : "42%" }}>
          <KodeContoh />
          <Cap teks={teks.lunas} className="cap-ketuk" style={{ position: "absolute", right: "-22%", bottom: "-10%", width: "64%" }} />
        </div>
      );
    case "jadwal": {
      const hari = ["S", "S", "R", "K", "J", "S", "M"];
      return (
        <div aria-hidden="true" style={{ position: "absolute", left: "8%", right: "8%", top: "26%", display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, fontWeight: 800, fontSize: besar ? 18 : 12 }}>
          {hari.map((h, i) => (
            <div key={i} style={{ display: "grid", gap: 6, justifyItems: "center" }}>
              <span>{h}</span>
              <span style={{ width: "100%", height: besar ? 120 : 52, background: "currentColor", opacity: 0.14, borderRadius: 4 }} />
            </div>
          ))}
          <span className="shift-geser" style={{ position: "absolute", left: 0, top: besar ? 30 : 22, width: "calc((100% - 36px) / 7)", height: besar ? 60 : 26, background: "var(--poster-cap)", borderRadius: 4, ["--geser" as string]: "600%" }} />
        </div>
      );
    }
    case "mata":
      return <Denah style={{ position: "absolute", left: "50%", top: "50%", translate: "-50% -50%", width: besar ? "min(84%, 520px)" : "70%" }} />;
    case "rekrut":
      return (
        <div aria-hidden="true" className="gelombang" style={{ position: "absolute", left: "12%", right: "12%", top: "30%", height: besar ? "38%" : "34%", display: "flex", gap: "3%", alignItems: "center" }}>
          {[1, 0.6, 0.9, 0.45, 1, 0.7, 0.95, 0.4, 0.8, 0.55].map((h, i) => (
            <i key={i} style={{ flex: 1, height: `${h * 100}%`, background: "currentColor", borderRadius: 6 }} />
          ))}
        </div>
      );
    case "pajak":
      return (
        <div aria-hidden="true" style={{ position: "absolute", left: "50%", top: "50%", translate: "-50% -50%", width: ukur, display: "grid", gap: besar ? 10 : 6 }}>
          <span className="papan" style={{ fontSize: besar ? "clamp(56px, 9vw, 120px)" : "clamp(40px, 14cqw, 72px)", color: "var(--sorot)" }}>0,5%</span>
          <span style={{ fontWeight: 800, fontSize: besar ? 20 : 13 }}>PPh final UMKM, PP 55/2022</span>
        </div>
      );
    default:
      return null;
  }
}

/** Ikon garis untuk menu Fitur (satu ketebalan, 30 px). */
export function IkonFitur({ jenis }: { jenis: string }) {
  const g = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const isi: Record<string, ReactNode> = {
    nota: <><rect x="7" y="3" width="16" height="24" rx="2" {...g} /><path d="M11 10h8M11 15h8M11 20h5" {...g} /></>,
    feed: <><rect x="9" y="2" width="12" height="26" rx="3" {...g} /><path d="M12 14l2.5 2.5L19 12" {...g} /></>,
    absen: <><path d="M4 4h7v7H4zM19 4h7v7h-7zM4 19h7v7H4z" {...g} /><path d="M18 18h3v3h-3zM23 23h3v3h-3z" {...g} /></>,
    gaji: <><rect x="3" y="7" width="24" height="16" rx="2" {...g} /><circle cx="15" cy="15" r="3.5" {...g} /></>,
    tagihan: <><path d="M6 3h18v24l-3.5-2.5L17 27l-3-2.5L11 27l-2.5-2.5L6 27z" {...g} /><path d="M10 10h10M10 15h7" {...g} /></>,
    jadwal: <><rect x="3" y="6" width="24" height="21" rx="2" {...g} /><path d="M3 12h24M10 3v5M20 3v5" {...g} /></>,
    mata: <><path d="M2 15s5-9 13-9 13 9 13 9-5 9-13 9S2 15 2 15z" {...g} /><circle cx="15" cy="15" r="4" {...g} /></>,
    rekrut: <><path d="M6 12v6M10 8v14M14 5v20M18 9v12M22 12v6" {...g} /></>,
    pajak: <><path d="M5 25L25 5" {...g} /><circle cx="8" cy="8" r="3.5" {...g} /><circle cx="22" cy="22" r="3.5" {...g} /></>,
  };
  return <svg viewBox="0 0 30 30" aria-hidden="true" focusable="false">{isi[jenis]}</svg>;
}
