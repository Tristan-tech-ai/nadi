"use client";

import { useMemo, useState, type ReactNode } from "react";
import { hitungPesangon, type AturanKompensasi, type AturanPesangon } from "@/lib/gaji/pesangon";
import { susunSlip, type PetaAturan, type RisikoJkk } from "@/lib/gaji/susun";
import { hitungThr } from "@/lib/gaji/thr";
import { formatRupiah, formatTanggalKalender } from "@/lib/format";
import { labelKomponen, masaKerjaTeks, teksAlat, teksPeringatan } from "@/lib/alat/teks";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { CSS_CETAK } from "@/components/alat/cetak";

// L-05 alat tanpa login: rumus yang SAMA dengan aplikasi (susunSlip, hitungThr, hitungPesangon) dengan aturan bertanggal yang
// sama, dihitung di peramban. Tidak ada yang dikirim atau disimpan. L-08: teks antarmuka mengikuti bahasa, angka tidak berubah.
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
const RISIKO: RisikoJkk[] = ["sangat_rendah", "rendah", "sedang", "tinggi", "sangat_tinggi"];

type Komp = { kode: string; label: string; nilai: number };
function DaftarKomponen({ judul, isi, jumlah, teksJumlah }: { judul: string; isi: Komp[]; jumlah: number; teksJumlah: string }) {
  return (
    <div>
      <h3 className="font-semibold">{judul}</h3>
      <table className="mt-2 w-full text-[15px]"><tbody>
        {isi.filter((k) => k.nilai).map((k) => <tr key={k.kode} className="border-b border-garis"><td className="py-1.5">{k.label}</td><td className="py-1.5 text-right tabular-nums">{rp(k.nilai)}</td></tr>)}
        <tr><td className="py-1.5 font-semibold">{teksJumlah}</td><td className="py-1.5 text-right font-semibold tabular-nums">{rp(jumlah)}</td></tr>
      </tbody></table>
    </div>
  );
}

export function KalkulatorGaji({ aturan, bulanIni, slip = false, bahasa = "id" }: { aturan: PetaAturan; bulanIni: number; slip?: boolean; bahasa?: Bahasa }) {
  const t = teksAlat(bahasa);
  const [namaOrang, setNamaOrang] = useState("Rina Lestari");
  const [namaUsaha, setNamaUsaha] = useState("Toko Sari Jaya");
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
    const label = (x: typeof s.komponen) => x.map((k) => ({ ...k, label: labelKomponen(k.kode, k.label, bahasa) }));
    const masuk = label(s.komponen.filter((k) => k.jenis === "pendapatan"));
    const potong = label(s.komponen.filter((k) => k.jenis === "potongan"));
    const usaha = label(s.komponen.filter((k) => k.jenis === "pemberi_kerja"));
    const total = (x: typeof masuk) => x.reduce((a, k) => a + k.nilai, 0);
    return { masuk, potong, usaha, bruto: total(masuk), potongan: total(potong), biayaUsaha: total(masuk) + total(usaha), peringatan: s.peringatan.map((p) => teksPeringatan(p, bahasa)) };
  }, [pokok, tunjangan, ptkp, risiko, lembur, aturan, bulan, bahasa]);
  return (
    <div className="grid gap-8 md:grid-cols-2" data-testid="kalkulator-gaji">
      {slip ? <style>{CSS_CETAK}</style> : null}
      <form className="grid content-start gap-4" onSubmit={(e) => e.preventDefault()} aria-label={t.isianGaji}>
        {slip ? <>
          <Isian id="nama-usaha" label={t.namaUsaha}><input id="nama-usaha" value={namaUsaha} onChange={(e) => setNamaUsaha(e.target.value)} className={isian} /></Isian>
          <Isian id="nama-orang" label={t.namaKaryawan}><input id="nama-orang" value={namaOrang} onChange={(e) => setNamaOrang(e.target.value)} className={isian} /></Isian>
        </> : null}
        <Rupiah id="pokok" label={t.pokok} nilai={pokok} ubah={setPokok} />
        <Rupiah id="tunjangan" label={t.tunjangan} nilai={tunjangan} ubah={setTunjangan} ket={t.tunjanganKet} />
        <Isian id="ptkp" label={t.ptkp} ket={t.ptkpKet}>
          <select id="ptkp" value={ptkp} onChange={(e) => setPtkp(e.target.value)} className={isian}>{STATUS.map((s) => <option key={s}>{s}</option>)}</select>
        </Isian>
        <Isian id="risiko" label={t.risiko}>
          <select id="risiko" value={risiko} onChange={(e) => setRisiko(e.target.value as RisikoJkk)} className={isian}>{RISIKO.map((r, i) => <option key={r} value={r}>{t.risikoPilihan[i]}</option>)}</select>
        </Isian>
        <Isian id="lembur" label={t.lembur} ket={t.lemburKet}>
          <input id="lembur" type="number" min={0} max={4} value={lembur} onChange={(e) => setLembur(e.target.value)} className={isian} />
        </Isian>
      </form>
      <div className="grid content-start gap-6" aria-live="polite" id={slip ? "lembar-cetak" : undefined} data-testid={slip ? "slip-cetak" : undefined}>
        {slip ? <header><p className="text-lg font-bold">{t.slip}</p><p className="text-sm">{namaUsaha}, {t.bulanKe}{bulan}</p><p className="font-semibold">{namaOrang}</p></header> : null}
        <p className="rounded-[var(--radius-kartu)] bg-kertas-2 p-4">
          <span className="block text-sm text-tinta-2">{t.gajiBersih}</span>
          <span className="font-judul text-3xl font-extrabold tabular-nums" data-testid="gaji-bersih">{rp(hasil.bruto - hasil.potongan)}</span>
        </p>
        <DaftarKomponen judul={t.pendapatan} isi={hasil.masuk} jumlah={hasil.bruto} teksJumlah={t.jumlah} />
        <DaftarKomponen judul={t.potongan} isi={hasil.potong} jumlah={hasil.potongan} teksJumlah={t.jumlah} />
        <DaftarKomponen judul={t.dibayarUsaha} isi={hasil.usaha} jumlah={hasil.biayaUsaha - hasil.bruto} teksJumlah={t.jumlah} />
        <p className="text-[15px]">{t.biayaUsaha} <b className="tabular-nums">{rp(hasil.biayaUsaha)}</b> {t.sebulan}</p>
        <Peringatan isi={hasil.peringatan} />
        {slip ? <button type="button" onClick={() => window.print()} className="h-12 justify-self-start rounded-[var(--radius-isian)] bg-tinta px-5 font-semibold text-kertas print:hidden">{t.cetak}</button> : null}
      </div>
    </div>
  );
}

export function KalkulatorThr({ hariIni, bahasa = "id" }: { hariIni: string; bahasa?: Bahasa }) {
  const t = teksAlat(bahasa);
  const [mulai, setMulai] = useState("2025-08-01");
  const [hariRaya, setHariRaya] = useState(hariIni);
  const [pokok, setPokok] = useState("3500000");
  const [tunjangan, setTunjangan] = useState("");
  const sah = /^\d{4}-\d{2}-\d{2}$/.test(mulai) && /^\d{4}-\d{2}-\d{2}$/.test(hariRaya);
  const h = sah ? hitungThr({ mulai, hariRaya, pokok: angka(pokok), tunjanganTetap: angka(tunjangan) }) : null;
  return (
    <div className="grid gap-8 md:grid-cols-2" data-testid="kalkulator-thr">
      <form className="grid content-start gap-4" onSubmit={(e) => e.preventDefault()} aria-label={t.isianThr}>
        <Isian id="mulai" label={t.mulai}><input id="mulai" type="date" value={mulai} onChange={(e) => setMulai(e.target.value)} className={isian} /></Isian>
        <Isian id="hari-raya" label={t.hariRaya}><input id="hari-raya" type="date" value={hariRaya} onChange={(e) => setHariRaya(e.target.value)} className={isian} /></Isian>
        <Rupiah id="pokok-thr" label={t.pokok} nilai={pokok} ubah={setPokok} />
        <Rupiah id="tunjangan-thr" label={t.tunjangan} nilai={tunjangan} ubah={setTunjangan} />
      </form>
      <div className="grid content-start gap-4" aria-live="polite">
        {h ? <>
          <p className="rounded-[var(--radius-kartu)] bg-kertas-2 p-4">
            <span className="block text-sm text-tinta-2">THR</span>
            <span className="font-judul text-3xl font-extrabold tabular-nums" data-testid="hasil-thr">{rp(h.thr)}</span>
          </p>
          <p>{t.masaThr} {masaKerjaTeks(h.masa, bahasa)}. {h.masa < 1 ? t.belumBerhak : h.masa >= 12 ? t.penuh : t.sebagian(h.masa)}</p>
          <p>{t.upahSebulan} <b className="tabular-nums">{rp(h.upah)}</b>. {t.batasBayar} <b>{formatTanggalKalender(h.batasBayar)}</b>.</p>
        </> : <p>{t.isiTanggal}</p>}
      </div>
    </div>
  );
}

export function KalkulatorPesangon({ aturan, kompensasi, hariIni, bahasa = "id" }: { aturan: AturanPesangon | null; kompensasi: AturanKompensasi | null; hariIni: string; bahasa?: Bahasa }) {
  const t = teksAlat(bahasa);
  const [mulai, setMulai] = useState("2020-03-01");
  const [berhenti, setBerhenti] = useState(hariIni);
  const [pokok, setPokok] = useState("4000000");
  const [tunjangan, setTunjangan] = useState("");
  const [kontrak, setKontrak] = useState(false);
  if (!aturan) return <p>{t.belumDibuka}</p>;
  const b = hitungPesangon({ id: "x", nama: "x", mulai, kontrak_selesai: kontrak ? berhenti : null, pokok: angka(pokok), tunjangan_tetap: angka(tunjangan) }, aturan, berhenti, kompensasi);
  return (
    <div className="grid gap-8 md:grid-cols-2" data-testid="kalkulator-pesangon">
      <form className="grid content-start gap-4" onSubmit={(e) => e.preventDefault()} aria-label={t.isianPesangon}>
        <Isian id="mulai-p" label={t.mulai}><input id="mulai-p" type="date" value={mulai} onChange={(e) => setMulai(e.target.value)} className={isian} /></Isian>
        <Isian id="berhenti" label={t.berhenti}><input id="berhenti" type="date" value={berhenti} onChange={(e) => setBerhenti(e.target.value)} className={isian} /></Isian>
        <Rupiah id="pokok-p" label={t.pokok} nilai={pokok} ubah={setPokok} />
        <Rupiah id="tunjangan-p" label={t.tunjangan} nilai={tunjangan} ubah={setTunjangan} />
        <label className="flex items-center gap-2 text-[15px]"><input type="checkbox" checked={kontrak} onChange={(e) => setKontrak(e.target.checked)} className="size-5" /> {t.kontrak}</label>
      </form>
      <div className="grid content-start gap-4" aria-live="polite">
        {b.status === "dihitung" ? <>
          <p className="rounded-[var(--radius-kartu)] bg-kertas-2 p-4">
            <span className="block text-sm text-tinta-2">{t.hasilPesangon}</span>
            <span className="font-judul text-3xl font-extrabold tabular-nums" data-testid="hasil-pesangon">{rp(b.dasar)}</span>
          </p>
          <p>{t.rincianPesangon(masaKerjaTeks(b.masaBulan ?? 0, bahasa), b.bulanPesangon, b.bulanUpmk, rp(b.upah))}</p>
          <p>{t.skenario(rp(b.rugi), rp(b.pensiun))}</p>
        </> : b.status === "kompensasi" ? <>
          <p className="rounded-[var(--radius-kartu)] bg-kertas-2 p-4">
            <span className="block text-sm text-tinta-2">{t.hasilKompensasi}</span>
            <span className="font-judul text-3xl font-extrabold tabular-nums" data-testid="hasil-pesangon">{rp(b.dasar)}</span>
          </p>
          <p>{t.rincianKompensasi(masaKerjaTeks(b.masaBulan ?? 0, bahasa), rp(b.upah))}</p>
        </> : <p>{b.status === "kontrak" ? t.kontrakBelum : b.status === "tanpa_gaji" ? t.isiPokok : t.periksaTanggal}</p>}
      </div>
    </div>
  );
}
