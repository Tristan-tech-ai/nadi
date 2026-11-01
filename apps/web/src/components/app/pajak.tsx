"use client";

import { useActionState, useState } from "react";
import { aturProfilPajak, type HasilPajak } from "@/app/app/pajak/actions";
import { Rupiah } from "@/components/ui/rupiah";
import { Tombol } from "@/components/ui/tombol";
import type { LapisanP17, Ptkp } from "@/lib/gaji/pph21";
import { NAMA_BENTUK, simulasi, type AturanFinal, type Bentuk } from "@/lib/pajak/kompas";

const isian = "h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";
const angka = (s: string) => Number(s.replace(/[^\d]/g, "")) || 0;

function Hasil({ h }: { h: HasilPajak }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="text-sm text-cap">{h.galat}</p> : <p role="status" className="text-sm text-daun">{h.pesan}</p>;
}

type Profil = { bentuk?: Bentuk; bruto_lalu?: number; usaha_lain_lalu?: number; usaha_lain_ini?: number; pasangan_lalu?: number; pasangan_ini?: number };

/** Bentuk usaha dan bruto pembanding untuk batas gabungan (Pasal 57, 58). */
export function FormProfilPajak({ awal }: { awal: Profil }) {
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
    <form action={aksi} className="mt-3 grid grid-cols-1 gap-3 rounded-[var(--radius-kartu)] border border-garis p-4 text-sm sm:grid-cols-2" aria-label="Profil pajak">
      <label className="flex flex-col gap-1 sm:col-span-2"><span className="text-tinta-2">Bentuk usaha ini</span>
        <select name="bentuk" required value={nilai.bentuk ?? ""} onChange={(e) => ubah("bentuk", e.target.value)} className={isian}>
          <option value="" disabled>Pilih</option>
          {(Object.keys(NAMA_BENTUK) as Bentuk[]).map((b) => <option key={b} value={b}>{NAMA_BENTUK[b]}</option>)}
        </select></label>
      {rp("bruto_lalu", "Bruto usaha ini tahun lalu", "Isi bila tahun lalu belum dicatat di Nadi.")}
      {rp("usaha_lain_lalu", "Bruto usaha lain milikmu tahun lalu", "Termasuk PT perorangan lain yang kamu dirikan.")}
      {rp("usaha_lain_ini", "Bruto usaha lain milikmu tahun ini", "Jumlah sampai hari ini.")}
      {rp("pasangan_ini", "Bruto usaha pasangan tahun ini", "Hanya bila pisah harta atau istri memilih menjalankan kewajiban pajak sendiri.")}
      {rp("pasangan_lalu", "Bruto usaha pasangan tahun lalu", "Sama seperti di atas.")}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Tombol type="submit" ragam="kedua" disabled={sibuk}>{sibuk ? "Menyimpan..." : "Simpan profil pajak"}</Tombol>
        <Hasil h={h} />
      </div>
    </form>
  );
}

/** Simulator bentuk usaha: perbandingan sah, dihitung di perangkat dari aturan bertanggal. */
export function SimulatorPajak({ aturan, lapisan, ptkp }: { aturan: AturanFinal; lapisan: LapisanP17; ptkp: Ptkp }) {
  const [bruto, setBruto] = useState("1.000.000.000");
  const [laba, setLaba] = useState("150.000.000");
  const [status, setStatus] = useState("K/1");
  const s = simulasi({ bruto: angka(bruto), laba: angka(laba), statusPtkp: status }, aturan, lapisan, ptkp);
  return (
    <div className="mt-3 text-sm" data-testid="simulator-pajak">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1"><span className="text-tinta-2">Perkiraan bruto setahun</span>
          <input value={bruto} onChange={(e) => setBruto(e.target.value)} inputMode="numeric" className={`${isian} angka`} /></label>
        <label className="flex flex-col gap-1"><span className="text-tinta-2">Perkiraan laba setahun</span>
          <input value={laba} onChange={(e) => setLaba(e.target.value)} inputMode="numeric" className={`${isian} angka`} /></label>
        <label className="flex flex-col gap-1"><span className="text-tinta-2">Status PTKP</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={isian}>
            {["TK/0", "TK/1", "TK/2", "TK/3", "K/0", "K/1", "K/2", "K/3"].map((x) => <option key={x}>{x}</option>)}
          </select></label>
      </div>
      <ul className="mt-3 divide-y divide-garis border-y border-garis" aria-live="polite">
        {s.baris.map((b) => (
          <li key={b.bentuk} className="py-2" data-testid="baris-simulasi">
            <p className="flex flex-wrap justify-between gap-2"><span className="font-semibold">{b.bentuk}</span><Rupiah nilai={b.pajak} className="font-semibold" /></p>
            <p className="text-tinta-2">{b.catatan}</p>
            <p className="text-xs text-tinta-2">Dasar: {b.dasar}.</p>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-tinta-2">{s.tidakDihitung}</p>
      <p className="mt-2 rounded-[var(--radius-isian)] border border-garis-kuat p-3" data-testid="peringatan-pajak">{s.peringatan}</p>
    </div>
  );
}
