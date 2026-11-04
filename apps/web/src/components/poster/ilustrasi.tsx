// Ilustrasi permukaan Persuade (docs/design/DESIGN.md bagian 6): SVG buatan sendiri, garis tinta 3 px, isian warna lewat token
// sehingga ikut tema gelap. Angka dan nama dari korpus sintetis. Semua dekoratif (aria-hidden); maknanya ada di teks halaman.
import type { CSSProperties, ReactNode } from "react";

type Svg = { className?: string; style?: CSSProperties };
const garis = { stroke: "currentColor", strokeWidth: 3, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

export function Lembar({ children, className, style, lebar = 120, tinggi = 150 }: Svg & { children?: ReactNode; lebar?: number; tinggi?: number }) {
  return (
    <svg viewBox={`0 0 ${lebar} ${tinggi}`} className={className} style={style} aria-hidden="true" focusable="false">
      <rect x="3" y="3" width={lebar - 6} height={tinggi - 6} rx="6" fill="var(--poster-lembar)" {...garis} />
      {children}
    </svg>
  );
}

/** Nota pemasok nota-01: UD Sumber Rejeki, 3 baris, total 376.500. */
export function Nota({ className, style }: Svg) {
  return (
    <Lembar className={className} style={style} lebar={140} tinggi={160}>
      <g fill="var(--poster-lembar-tinta)" fontFamily="var(--font-jakarta), sans-serif">
        <text x="70" y="26" textAnchor="middle" fontSize="11" fontWeight="800">UD Sumber Rejeki</text>
        <text x="70" y="40" textAnchor="middle" fontSize="8">NT-4671 · 13/10/2026</text>
        <text x="14" y="62" fontSize="9">Teh celup 25</text><text x="126" y="62" textAnchor="end" fontSize="9">85.500</text>
        <text x="14" y="80" fontSize="9">Tepung terigu</text><text x="126" y="80" textAnchor="end" fontSize="9">81.000</text>
        <text x="14" y="98" fontSize="9">Bawang merah</text><text x="126" y="98" textAnchor="end" fontSize="9">210.000</text>
        <text x="14" y="130" fontSize="10" fontWeight="800">TOTAL</text><text x="126" y="130" textAnchor="end" fontSize="11" fontWeight="800">376.500</text>
      </g>
      <path d="M14 112h112" stroke="var(--poster-lembar-tinta)" strokeWidth="1.5" strokeDasharray="3 3" />
    </Lembar>
  );
}

export function Kuitansi({ className, style }: Svg) {
  return (
    <Lembar className={className} style={style} lebar={150} tinggi={96}>
      <g fill="var(--poster-lembar-tinta)" fontFamily="var(--font-jakarta), sans-serif">
        <text x="14" y="26" fontSize="12" fontWeight="800">KUITANSI</text>
        <text x="14" y="48" fontSize="9">Terima dari Bu Rina</text>
        <text x="14" y="76" fontSize="15" fontWeight="800">Rp1.200.000</text>
      </g>
      <rect x="104" y="54" width="32" height="28" rx="2" fill="none" stroke="var(--stempel)" strokeWidth="2.5" transform="rotate(-8 120 68)" />
    </Lembar>
  );
}

export function ChatWa({ teks, className, style }: Svg & { teks: string }) {
  return (
    <svg viewBox="0 0 170 58" className={className} style={style} aria-hidden="true" focusable="false">
      <path d="M10 4h150a6 6 0 0 1 6 6v32a6 6 0 0 1-6 6H30l-14 8 2-8h-8a6 6 0 0 1-6-6V10a6 6 0 0 1 6-6z" fill="var(--poster-daun)" {...garis} stroke="var(--poster-daun-tinta)" />
      <text x="85" y="31" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--poster-daun-tinta)" fontFamily="var(--font-jakarta), sans-serif">{teks}</text>
    </svg>
  );
}

export function ExcelAbsen({ className, style }: Svg) {
  const sel = [];
  for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) sel.push(<rect key={`${r}-${c}`} x={10 + c * 34} y={26 + r * 18} width="32" height="16" fill={r === 0 ? "var(--poster-daun)" : "var(--poster-lembar)"} stroke="var(--poster-lembar-tinta)" strokeWidth="1" />);
  return (
    <Lembar className={className} style={style} lebar={156} tinggi={144}>
      <text x="12" y="18" fontSize="10" fontWeight="800" fill="var(--poster-lembar-tinta)" fontFamily="var(--font-jakarta), sans-serif">absen_okt.xlsx</text>
      {sel}
    </Lembar>
  );
}

export function SuratDokter({ className, style }: Svg) {
  return (
    <Lembar className={className} style={style} lebar={118} tinggi={150}>
      <g fill="var(--poster-lembar-tinta)" fontFamily="var(--font-jakarta), sans-serif">
        <text x="59" y="26" textAnchor="middle" fontSize="10" fontWeight="800">SURAT SAKIT</text>
        <text x="14" y="52" fontSize="9">Fitri Astuti</text>
        <text x="14" y="70" fontSize="9">Istirahat 3 hari</text>
        <text x="14" y="88" fontSize="9">mulai 25 Okt 2026</text>
      </g>
      <circle cx="84" cy="120" r="16" fill="none" stroke="var(--poster-laut)" strokeWidth="2.5" />
    </Lembar>
  );
}

export function SlipGaji({ className, style }: Svg) {
  const baris: [string, string][] = [["Pokok", "6.400.000"], ["Tunjangan", "1.100.000"], ["Potongan", "304.000"]];
  return (
    <Lembar className={className} style={style} lebar={150} tinggi={130}>
      <g fill="var(--poster-lembar-tinta)" fontFamily="var(--font-jakarta), sans-serif">
        <text x="14" y="24" fontSize="10" fontWeight="800">Slip gaji Okt 2026</text>
        <text x="14" y="38" fontSize="8">Ketut Rahmawati</text>
        {baris.map(([a, b], i) => (
          <g key={a}><text x="14" y={60 + i * 16} fontSize="9">{a}</text><text x="136" y={60 + i * 16} textAnchor="end" fontSize="9">{b}</text></g>
        ))}
        <text x="14" y="116" fontSize="10" fontWeight="800" fill="var(--lunas)">Diterima</text>
        <text x="136" y="116" textAnchor="end" fontSize="11" fontWeight="800" fill="var(--lunas)">7.196.000</text>
      </g>
    </Lembar>
  );
}

/** KTP contoh korpus ktp-01 (sintetis, kode provinsi 99 yang tidak ada, bertanda CONTOH). */
export function Ktp({ className, style }: Svg) {
  return (
    <Lembar className={className} style={style} lebar={170} tinggi={108}>
      <rect x="3" y="3" width="164" height="22" rx="6" fill="var(--poster-laut)" />
      <g fill="var(--poster-lembar-tinta)" fontFamily="var(--font-jakarta), sans-serif">
        <text x="85" y="18" textAnchor="middle" fontSize="10" fontWeight="800" fill="var(--poster-laut-tinta)">KTP CONTOH</text>
        <text x="12" y="44" fontSize="8">NIK 9921 01•• •••• 1840</text>
        <text x="12" y="62" fontSize="10" fontWeight="800">AGUS ASTUTI</text>
        <text x="12" y="78" fontSize="8">26-05-1983</text>
      </g>
      <rect x="122" y="34" width="34" height="44" rx="3" fill="var(--poster-tulang)" stroke="var(--poster-lembar-tinta)" strokeWidth="1.5" />
      <circle cx="139" cy="50" r="7" fill="none" stroke="var(--poster-lembar-tinta)" strokeWidth="1.5" />
      <path d="M128 74c3-8 19-8 22 0" fill="none" stroke="var(--poster-lembar-tinta)" strokeWidth="1.5" />
    </Lembar>
  );
}

/** Mutasi rekening korpus mutasi-01: tiga baris Oktober 2026, satu transfer masuk Kafe Senja. */
export function Mutasi({ className, style }: Svg) {
  const baris: [string, string, string][] = [["07/10", "PLN", "-2.503.000"], ["09/10", "KAFE SENJA", "+1.240.000"], ["09/10", "UD SUMBER", "-559.500"]];
  return (
    <Lembar className={className} style={style} lebar={160} tinggi={112}>
      <g fill="var(--poster-lembar-tinta)" fontFamily="var(--font-jakarta), sans-serif">
        <text x="12" y="22" fontSize="10" fontWeight="800">mutasi_okt.csv</text>
        {baris.map(([t, k, n], i) => (
          <g key={k}>
            {i === 1 ? <rect x="8" y={34 + i * 22} width="144" height="18" fill="var(--sorot)" /> : null}
            <text x="12" y={47 + i * 22} fontSize="8">{t}</text>
            <text x="40" y={47 + i * 22} fontSize="8" fontWeight="700">{k}</text>
            <text x="148" y={47 + i * 22} textAnchor="end" fontSize="8" fontWeight="700">{n}</text>
          </g>
        ))}
      </g>
    </Lembar>
  );
}

/** Cap stempel berbingkai: teks kapital pendek (DITERIMA, LUNAS). */
export function Cap({ teks, warna = "var(--lunas)", className, style }: Svg & { teks: string; warna?: string }) {
  const w = Math.max(70, teks.length * 9 + 24);
  return (
    <svg viewBox={`0 0 ${w} 34`} className={className} style={style} aria-hidden="true" focusable="false">
      <rect x="3" y="3" width={w - 6} height="28" rx="3" fill="none" stroke={warna} strokeWidth="3.5" />
      <text x={w / 2} y="23" textAnchor="middle" fontSize="14" fontWeight="800" letterSpacing="1" fill={warna} fontFamily="var(--font-jakarta), sans-serif">{teks}</text>
    </svg>
  );
}

/** Kode QR contoh dari pola tetap (bukan QRIS sungguhan). */
export function KodeContoh({ className, style }: Svg) {
  const pola = "1111111010110111111110000010011101000001101110101110010111011011101001001101011101101110101101001011101100000101010010000011111111010101011111110000000001100000000110101111010111110100100110101100110010111100010111000100101011101101100011000011100110001111011010001111010101011111101011000001001010101000101110101101111101011011101001011101001110110111100001010001100000101000101101101111111010110110011";
  const n = 21;
  const sel = [];
  for (let i = 0; i < n * n; i++) if (pola[i % pola.length] === "1") sel.push(<rect key={i} x={(i % n) * 4} y={Math.floor(i / n) * 4} width="4" height="4" />);
  return (
    <svg viewBox="-4 -4 92 92" className={className} style={style} aria-hidden="true" focusable="false">
      <rect x="-4" y="-4" width="92" height="92" fill="var(--poster-lembar)" />
      <g fill="var(--poster-lembar-tinta)">{sel}</g>
    </svg>
  );
}

/** Denah warung dari atas: 6 meja + antrean; status diwarnai lewat kelas pada <g data-meja>. */
export function Denah({ className, style }: Svg) {
  const meja = [0, 1, 2, 3, 4, 5];
  return (
    <svg viewBox="0 0 200 130" className={className} style={style} aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="194" height="124" rx="8" fill="var(--poster-lembar)" {...garis} />
      {meja.map((i) => (
        <rect key={i} data-meja={i} className="poster-meja" x={16 + (i % 3) * 46} y={18 + Math.floor(i / 3) * 52} width="36" height="38" rx="5" {...garis} />
      ))}
      <rect x="160" y="18" width="26" height="90" rx="5" className="poster-antrean" {...garis} />
    </svg>
  );
}

/** Bingkai HP berisi anak (kartu HTML). */
export function Ponsel({ children, className, style }: { children?: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`poster-ponsel ${className ?? ""}`} style={style} data-ui>
      <div className="poster-ponsel-layar">{children}</div>
    </div>
  );
}

export function Kamera({ className, style }: Svg) {
  return (
    <svg viewBox="0 0 80 60" className={className} style={style} aria-hidden="true" focusable="false">
      <rect x="4" y="14" width="72" height="42" rx="8" fill="var(--poster-tinta)" {...garis} stroke="var(--poster-tinta-tinta)" />
      <circle cx="40" cy="35" r="13" fill="var(--poster-lembar)" {...garis} stroke="var(--poster-tinta-tinta)" />
      <rect x="26" y="6" width="22" height="10" rx="3" fill="var(--poster-tinta)" {...garis} stroke="var(--poster-tinta-tinta)" />
    </svg>
  );
}
