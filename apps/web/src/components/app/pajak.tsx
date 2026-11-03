"use client";

import { useActionState, useState } from "react";
import { aturProfilPajak, type HasilPajak } from "@/app/app/pajak/actions";
import { Rupiah } from "@/components/ui/rupiah";
import { Tombol } from "@/components/ui/tombol";
import type { Kamus } from "@/lib/i18n/kamus";
import { sisip } from "@/lib/i18n/sisip";
import type { LapisanP17, Ptkp } from "@/lib/gaji/pph21";
import { simulasi, type AturanFinal, type Bentuk } from "@/lib/pajak/kompas";

type Teks = Kamus["pajak"];

const isian = "h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";
const angka = (s: string) => Number(s.replace(/[^\d]/g, "")) || 0;

function Hasil({ h }: { h: HasilPajak }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="text-sm text-cap">{h.galat}</p> : <p role="status" className="text-sm text-daun">{h.pesan}</p>;
}

type Profil = { bentuk?: Bentuk; bruto_lalu?: number; usaha_lain_lalu?: number; usaha_lain_ini?: number; pasangan_lalu?: number; pasangan_ini?: number };

/** Bentuk usaha dan bruto pembanding untuk batas gabungan (Pasal 57, 58). */
export function FormProfilPajak({ awal, teks: t }: { awal: Profil; teks: Teks }) {
  const namaBentuk: Record<Bentuk, string> = { op: t.bOp, pt_perorangan: t.bPt, koperasi: t.bKoperasi, badan_lain: t.bLain };
  const [h, aksi, sibuk] = useActionState<HasilPajak, FormData>(aturProfilPajak, null);
  // Terkendali: React mengosongkan formulir tak terkendali setelah aksi, padahal nilai yang tersimpan harus tetap terlihat.
  const [nilai, setNilai] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(awal).map(([k, v]) => [k, k === "bentuk" ? String(v) : v ? String(v) : ""])));
  const ubah = (k: string, v: string) => setNilai((s) => ({ ...s, [k]: v }));
  const rp = (nama: keyof Profil, label: string, bantu: string) => (
    <label className="flex flex-col gap-1"><span className="text-tinta-2">{label}</span>
      <input name={nama} inputMode="numeric" value={nilai[nama] ?? ""} onChange={(e) => ubah(nama, e.target.value)} placeholder="0" className={`${isian} angka`} aria-describedby={`bantu-${nama}`} />
      <span id={`bantu-${nama}`} className="text-xs text-tinta-2">{bantu}</span></label>
  );
  return (
    <form action={aksi} className="mt-3 grid grid-cols-1 gap-3 rounded-[var(--radius-kartu)] border border-garis p-4 text-sm sm:grid-cols-2" aria-label={t.profilAria}>
      <label className="flex flex-col gap-1 sm:col-span-2"><span className="text-tinta-2">{t.bentuk}</span>
        <select name="bentuk" required value={nilai.bentuk ?? ""} onChange={(e) => ubah("bentuk", e.target.value)} className={isian}>
          <option value="" disabled>{t.pilih}</option>
          {(Object.keys(namaBentuk) as Bentuk[]).map((b) => <option key={b} value={b}>{namaBentuk[b]}</option>)}
        </select></label>
      {rp("bruto_lalu", t.brutoLalu, t.brutoLaluBantu)}
      {rp("usaha_lain_lalu", t.lainLalu, t.lainLaluBantu)}
      {rp("usaha_lain_ini", t.lainIni, t.lainIniBantu)}
      {rp("pasangan_ini", t.pasanganIni, t.pasanganIniBantu)}
      {rp("pasangan_lalu", t.pasanganLalu, t.pasanganLaluBantu)}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Tombol type="submit" ragam="kedua" disabled={sibuk}>{sibuk ? t.menyimpan : t.simpanProfil}</Tombol>
        <Hasil h={h} />
      </div>
    </form>
  );
}

/** Simulator bentuk usaha: perbandingan sah, dihitung di perangkat dari aturan bertanggal. */
export function SimulatorPajak({ aturan, lapisan, ptkp, teks: t, isiLang }: { aturan: AturanFinal; lapisan: LapisanP17; ptkp: Ptkp; teks: Teks; isiLang?: string }) {
  const [bruto, setBruto] = useState("1.000.000.000");
  const [laba, setLaba] = useState("150.000.000");
  const [status, setStatus] = useState("K/1");
  const s = simulasi({ bruto: angka(bruto), laba: angka(laba), statusPtkp: status }, aturan, lapisan, ptkp);
  return (
    <div className="mt-3 text-sm" data-testid="simulator-pajak">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.simBruto}</span>
          <input value={bruto} onChange={(e) => setBruto(e.target.value)} inputMode="numeric" className={`${isian} angka`} /></label>
        <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.simLaba}</span>
          <input value={laba} onChange={(e) => setLaba(e.target.value)} inputMode="numeric" className={`${isian} angka`} /></label>
        <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.simPtkp}</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={isian}>
            {["TK/0", "TK/1", "TK/2", "TK/3", "K/0", "K/1", "K/2", "K/3"].map((x) => <option key={x}>{x}</option>)}
          </select></label>
      </div>
      <ul className="mt-3 divide-y divide-garis border-y border-garis" aria-live="polite">
        {s.baris.map((b) => (
          <li key={b.bentuk} className="py-2" data-testid="baris-simulasi">
            <p className="flex flex-wrap justify-between gap-2"><span className="font-semibold" lang={isiLang}>{b.bentuk}</span><Rupiah nilai={b.pajak} className="font-semibold" /></p>
            <p className="text-tinta-2" lang={isiLang}>{b.catatan}</p>
            <p className="text-xs text-tinta-2">{sisip(t.dasar, { dasar: <span lang={isiLang}>{b.dasar}</span> })}</p>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-tinta-2" lang={isiLang}>{s.tidakDihitung}</p>
      <p className="mt-2 rounded-[var(--radius-isian)] border border-garis-kuat p-3" data-testid="peringatan-pajak" lang={isiLang}>{s.peringatan}</p>
    </div>
  );
}
