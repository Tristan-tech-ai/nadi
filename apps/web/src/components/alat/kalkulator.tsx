"use client";

import { useMemo, useState, type ReactNode } from "react";
import { hitungPesangon, teksMasaKerja, type AturanKompensasi, type AturanPesangon } from "@/lib/gaji/pesangon";
import { susunSlip, type PetaAturan, type RisikoJkk } from "@/lib/gaji/susun";
import { hitungThr } from "@/lib/gaji/thr";
import { formatRupiah, formatTanggalKalender } from "@/lib/format";

// L-05 alat tanpa login: rumus yang SAMA dengan aplikasi (susunSlip, hitungThr, hitungPesangon) dengan aturan bertanggal yang
// sama, dihitung di peramban. Tidak ada yang dikirim atau disimpan.
const isian = "mt-1 h-12 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base tabular-nums";
const angka = (s: string) => Math.max(0, Math.round(Number(s.replace(/\D/g, "")) || 0));
const rp = (n: number) => formatRupiah(n);

function Isian({ id, label, ket, children }: { id: string; label: string; ket?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      {children}
      {ket ? <p className="mt-1 text-xs text-tinta-2">{ket}</p> : null}
    </div>
  );
}

function Rupiah({ id, label, nilai, ubah, ket }: { id: string; label: string; nilai: string; ubah: (v: string) => void; ket?: string }) {
  return (
    <Isian id={id} label={label} ket={ket}>
      <input id={id} inputMode="numeric" value={nilai ? formatRupiah(angka(nilai)) : ""} placeholder="Rp0" onChange={(e) => ubah(e.target.value)} className={isian} />
    </Isian>
  );
}

function Peringatan({ isi }: { isi: string[] }) {
  if (!isi.length) return null;
  return <ul className="mt-4 grid gap-1 rounded-[var(--radius-kartu)] border border-garis p-3 text-sm" data-testid="peringatan-alat">{isi.map((p) => <li key={p}>{p}</li>)}</ul>;
}

const STATUS = ["TK/0", "TK/1", "TK/2", "TK/3", "K/0", "K/1", "K/2", "K/3"];
const RISIKO: { v: RisikoJkk; l: string }[] = [
  { v: "sangat_rendah", l: "Sangat rendah (kantor, toko)" }, { v: "rendah", l: "Rendah" }, { v: "sedang", l: "Sedang" }, { v: "tinggi", l: "Tinggi" }, { v: "sangat_tinggi", l: "Sangat tinggi" },
];

type Komp = { kode: string; label: string; nilai: number };
function DaftarKomponen({ judul, isi, jumlah }: { judul: string; isi: Komp[]; jumlah: number }) {
  return (
    <div>
      <h3 className="font-semibold">{judul}</h3>
      <table className="mt-2 w-full text-[15px]"><tbody>
        {isi.filter((k) => k.nilai).map((k) => <tr key={k.kode} className="border-b border-garis"><td className="py-1.5">{k.label}</td><td className="py-1.5 text-right tabular-nums">{rp(k.nilai)}</td></tr>)}
        <tr><td className="py-1.5 font-semibold">Jumlah</td><td className="py-1.5 text-right font-semibold tabular-nums">{rp(jumlah)}</td></tr>
      </tbody></table>
    </div>
  );
}

export function KalkulatorGaji({ aturan, bulanIni }: { aturan: PetaAturan; bulanIni: number }) {
  const [pokok, setPokok] = useState("4500000");
  const [tunjangan, setTunjangan] = useState("");
  const [ptkp, setPtkp] = useState("TK/0");
  const [risiko, setRisiko] = useState<RisikoJkk>("sangat_rendah");
  const [lembur, setLembur] = useState("0");
  // Desember memakai perhitungan setahun yang butuh riwayat 11 bulan; alat ini menghitung bulan biasa.
  const bulan = bulanIni === 12 ? 11 : bulanIni;
  const hasil = useMemo(() => {
    const jam = Math.min(Math.max(0, Number(lembur) || 0), 4);
    const l = jam > 0 ? [{ tanggal: `2026-${String(bulan).padStart(2, "0")}-10`, jenis: "hari_kerja" as const, jam }] : [];
    const s = susunSlip({ pokok: angka(pokok), tunjangan_tetap: angka(tunjangan), ptkp, risiko_jkk: risiko }, aturan, bulan, undefined, l);
    const masuk = s.komponen.filter((k) => k.jenis === "pendapatan");
    const potong = s.komponen.filter((k) => k.jenis === "potongan");
    const usaha = s.komponen.filter((k) => k.jenis === "pemberi_kerja");
    const total = (x: typeof masuk) => x.reduce((a, k) => a + k.nilai, 0);
    return { masuk, potong, usaha, bruto: total(masuk), potongan: total(potong), biayaUsaha: total(masuk) + total(usaha), peringatan: s.peringatan };
  }, [pokok, tunjangan, ptkp, risiko, lembur, aturan, bulan]);
  return (
    <div className="grid gap-8 md:grid-cols-2" data-testid="kalkulator-gaji">
      <form className="grid content-start gap-4" onSubmit={(e) => e.preventDefault()} aria-label="Isian gaji">
        <Rupiah id="pokok" label="Gaji pokok sebulan" nilai={pokok} ubah={setPokok} />
        <Rupiah id="tunjangan" label="Tunjangan tetap sebulan" nilai={tunjangan} ubah={setTunjangan} ket="Tunjangan yang dibayar sama setiap bulan, tidak tergantung kehadiran." />
        <Isian id="ptkp" label="Status pajak (PTKP)" ket="TK = belum kawin, K = kawin; angka = tanggungan.">
          <select id="ptkp" value={ptkp} onChange={(e) => setPtkp(e.target.value)} className={isian}>{STATUS.map((s) => <option key={s}>{s}</option>)}</select>
        </Isian>
        <Isian id="risiko" label="Risiko kerja (BPJS JKK)">
          <select id="risiko" value={risiko} onChange={(e) => setRisiko(e.target.value as RisikoJkk)} className={isian}>{RISIKO.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}</select>
        </Isian>
        <Isian id="lembur" label="Lembur di hari kerja (jam)" ket="Satu hari lembur, paling lama 4 jam. Upah lembur dihitung dari upah sebulan / 173.">
          <input id="lembur" type="number" min={0} max={4} value={lembur} onChange={(e) => setLembur(e.target.value)} className={isian} />
        </Isian>
      </form>
      <div className="grid content-start gap-6" aria-live="polite">
        <p className="rounded-[var(--radius-kartu)] bg-kertas-2 p-4">
          <span className="block text-sm text-tinta-2">Gaji bersih yang diterima</span>
          <span className="font-judul text-3xl font-extrabold tabular-nums" data-testid="gaji-bersih">{rp(hasil.bruto - hasil.potongan)}</span>
        </p>
        <DaftarKomponen judul="Pendapatan" isi={hasil.masuk} jumlah={hasil.bruto} />
        <DaftarKomponen judul="Potongan" isi={hasil.potong} jumlah={hasil.potongan} />
        <DaftarKomponen judul="Dibayar usaha di luar gaji" isi={hasil.usaha} jumlah={hasil.biayaUsaha - hasil.bruto} />
        <p className="text-[15px]">Biaya usaha untuk orang ini: <b className="tabular-nums">{rp(hasil.biayaUsaha)}</b> sebulan.</p>
        <Peringatan isi={hasil.peringatan} />
      </div>
    </div>
  );
}

export function KalkulatorThr({ hariIni }: { hariIni: string }) {
  const [mulai, setMulai] = useState("2025-08-01");
  const [hariRaya, setHariRaya] = useState(hariIni);
  const [pokok, setPokok] = useState("3500000");
  const [tunjangan, setTunjangan] = useState("");
  const sah = /^\d{4}-\d{2}-\d{2}$/.test(mulai) && /^\d{4}-\d{2}-\d{2}$/.test(hariRaya);
  const h = sah ? hitungThr({ mulai, hariRaya, pokok: angka(pokok), tunjanganTetap: angka(tunjangan) }) : null;
  return (
    <div className="grid gap-8 md:grid-cols-2" data-testid="kalkulator-thr">
      <form className="grid content-start gap-4" onSubmit={(e) => e.preventDefault()} aria-label="Isian THR">
        <Isian id="mulai" label="Mulai bekerja"><input id="mulai" type="date" value={mulai} onChange={(e) => setMulai(e.target.value)} className={isian} /></Isian>
        <Isian id="hari-raya" label="Tanggal Hari Raya"><input id="hari-raya" type="date" value={hariRaya} onChange={(e) => setHariRaya(e.target.value)} className={isian} /></Isian>
        <Rupiah id="pokok-thr" label="Gaji pokok sebulan" nilai={pokok} ubah={setPokok} />
        <Rupiah id="tunjangan-thr" label="Tunjangan tetap sebulan" nilai={tunjangan} ubah={setTunjangan} />
      </form>
      <div className="grid content-start gap-4" aria-live="polite">
        {h ? <>
          <p className="rounded-[var(--radius-kartu)] bg-kertas-2 p-4">
            <span className="block text-sm text-tinta-2">THR</span>
            <span className="font-judul text-3xl font-extrabold tabular-nums" data-testid="hasil-thr">{rp(h.thr)}</span>
          </p>
          <p>Masa kerja sampai Hari Raya: {teksMasaKerja(h.masa)}. {h.masa < 1 ? "Belum berhak THR (kurang dari 1 bulan)." : h.masa >= 12 ? "12 bulan atau lebih: 1 bulan upah." : `Kurang dari 12 bulan: ${h.masa}/12 x upah sebulan.`}</p>
          <p>Upah sebulan (pokok + tunjangan tetap): <b className="tabular-nums">{rp(h.upah)}</b>. Dibayar paling lambat <b>{formatTanggalKalender(h.batasBayar)}</b>.</p>
        </> : <p>Isi tanggal mulai dan tanggal Hari Raya.</p>}
      </div>
    </div>
  );
}

export function KalkulatorPesangon({ aturan, kompensasi, hariIni }: { aturan: AturanPesangon | null; kompensasi: AturanKompensasi | null; hariIni: string }) {
  const [mulai, setMulai] = useState("2020-03-01");
  const [berhenti, setBerhenti] = useState(hariIni);
  const [pokok, setPokok] = useState("4000000");
  const [tunjangan, setTunjangan] = useState("");
  const [kontrak, setKontrak] = useState(false);
  if (!aturan) return <p>Tabel pesangon belum diperiksa ke sumber resmi, jadi kalkulator ini belum dibuka.</p>;
  const b = hitungPesangon({ id: "x", nama: "x", mulai, kontrak_selesai: kontrak ? berhenti : null, pokok: angka(pokok), tunjangan_tetap: angka(tunjangan) }, aturan, berhenti, kompensasi);
  return (
    <div className="grid gap-8 md:grid-cols-2" data-testid="kalkulator-pesangon">
      <form className="grid content-start gap-4" onSubmit={(e) => e.preventDefault()} aria-label="Isian pesangon">
        <Isian id="mulai-p" label="Mulai bekerja"><input id="mulai-p" type="date" value={mulai} onChange={(e) => setMulai(e.target.value)} className={isian} /></Isian>
        <Isian id="berhenti" label="Tanggal berhenti"><input id="berhenti" type="date" value={berhenti} onChange={(e) => setBerhenti(e.target.value)} className={isian} /></Isian>
        <Rupiah id="pokok-p" label="Gaji pokok sebulan" nilai={pokok} ubah={setPokok} />
        <Rupiah id="tunjangan-p" label="Tunjangan tetap sebulan" nilai={tunjangan} ubah={setTunjangan} />
        <label className="flex items-center gap-2 text-[15px]"><input type="checkbox" checked={kontrak} onChange={(e) => setKontrak(e.target.checked)} className="size-5" /> Karyawan kontrak (PKWT)</label>
      </form>
      <div className="grid content-start gap-4" aria-live="polite">
        {b.status === "dihitung" ? <>
          <p className="rounded-[var(--radius-kartu)] bg-kertas-2 p-4">
            <span className="block text-sm text-tinta-2">Pesangon + penghargaan masa kerja (skenario dasar)</span>
            <span className="font-judul text-3xl font-extrabold tabular-nums" data-testid="hasil-pesangon">{rp(b.dasar)}</span>
          </p>
          <p>Masa kerja {teksMasaKerja(b.masaBulan ?? 0)}. Uang pesangon {b.bulanPesangon} bulan upah, uang penghargaan masa kerja {b.bulanUpmk} bulan upah, upah sebulan {rp(b.upah)}.</p>
          <p>Bila berhenti karena usaha merugi: {rp(b.rugi)}. Bila pensiun: {rp(b.pensiun)}. Jumlah sungguhan tergantung alasan berhenti.</p>
        </> : b.status === "kompensasi" ? <>
          <p className="rounded-[var(--radius-kartu)] bg-kertas-2 p-4">
            <span className="block text-sm text-tinta-2">Uang kompensasi kontrak</span>
            <span className="font-judul text-3xl font-extrabold tabular-nums" data-testid="hasil-pesangon">{rp(b.dasar)}</span>
          </p>
          <p>Masa kerja {teksMasaKerja(b.masaBulan ?? 0)} / 12 x upah sebulan {rp(b.upah)}. Untuk usaha mikro dan kecil besarnya berdasarkan kesepakatan, jadi angka ini acuan.</p>
        </> : <p>{b.status === "kontrak" ? "Aturan kompensasi kontrak belum diperiksa ke sumber resmi." : b.status === "tanpa_gaji" ? "Isi gaji pokok." : "Periksa tanggal mulai dan tanggal berhenti."}</p>}
      </div>
    </div>
  );
}
