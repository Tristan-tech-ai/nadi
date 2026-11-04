"use client";

import { useState, type ChangeEvent } from "react";
import { Rupiah } from "@/components/ui/rupiah";
import { angkaDesimal, angkaKurs, formatKurs, formatUsd } from "@/lib/ekspor/hitung";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";
import { hitungImpor, KELOMPOK, type AturanImpor, type Kelompok } from "@/lib/impor/biaya";

type Teks = Kamus["impor"];
const isian = "h-10 w-full min-w-0 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";
const persenTeks = (n: number, bahasa: Bahasa) => new Intl.NumberFormat(bahasa === "id" ? "id-ID" : "en-US", { maximumFractionDigits: 2 }).format(n);

function Baris({ label, nilai, bahasa, tebal = false, uji }: { label: string; nilai: number; bahasa: Bahasa; tebal?: boolean; uji?: string }) {
  return (
    <tr className={`border-b border-garis ${tebal ? "font-semibold" : ""}`} data-testid={uji}>
      <th scope="row" className="py-1.5 pr-3 text-left font-normal">{tebal ? <strong>{label}</strong> : label}</th>
      <td className="py-1.5 text-right"><Rupiah nilai={nilai} bahasa={bahasa} /></td>
    </tr>
  );
}

/** B-EKSIM2: kalkulator perkiraan di peramban; angka tidak disimpan dan tidak dikirim ke mana pun. */
export function KalkulatorImpor({ aturan, teks: t, bahasa }: { aturan: AturanImpor; teks: Teks; bahasa: Bahasa }) {
  const [v, setV] = useState({ fob: "", ongkir: "", asuransi: "", kurs: "", bm: "", lain: "" });
  const [kelompok, setKelompok] = useState<Kelompok>("umum");
  const [api, setApi] = useState(true);
  const [mewah, setMewah] = useState(false);
  const ubah = (k: keyof typeof v) => (e: ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  const usd = (s: string) => (s.trim() === "" ? 0 : Math.round(angkaDesimal(s) * 100));
  const kurs = angkaKurs(v.kurs);
  const bmPersen = v.bm.trim() === "" ? 0 : angkaDesimal(v.bm);
  const lain = v.lain.trim() === "" ? 0 : /^[\d.\s]+$/.test(v.lain) ? Number(v.lain.replace(/[.\s]/g, "")) : Number.NaN;
  const h = v.fob.trim() === "" || v.kurs.trim() === "" ? null
    : hitungImpor({ fobSen: usd(v.fob), ongkirSen: usd(v.ongkir), asuransiSen: usd(v.asuransi), kurs, bmPersen, kelompok, api, mewah, biayaLain: lain }, aturan);
  const NAMA: Record<Kelompok, string> = { umum: t.kUmum, tertentu: t.kTertentu, tertentu_lain: t.kTertentuLain, kedelai_gandum_terigu: t.kKedelai, emas_batangan: t.kEmas };
  const Kotak = ({ label, k, mode = "decimal", ket }: { label: string; k: keyof typeof v; mode?: "decimal" | "numeric"; ket?: string }) => (
    <label className="flex min-w-0 flex-col gap-1"><span className="text-tinta-2">{label}</span>
      <input value={v[k]} onChange={ubah(k)} inputMode={mode} className={`${isian} angka text-right`} />
      {ket ? <span className="text-xs text-tinta-2">{ket}</span> : null}</label>
  );
  return (
    <div className="mt-6 grid gap-6">
      <form className="grid grid-cols-1 gap-3 rounded-[var(--radius-kartu)] border border-garis p-4 text-sm sm:grid-cols-2" aria-label={t.judul} onSubmit={(e) => e.preventDefault()} data-testid="form-impor">
        {/* Kotak dipanggil sebagai fungsi agar input tidak dipasang ulang setiap ketikan (fokus tetap). */}
        {Kotak({ label: t.fob, k: "fob" })}
        {Kotak({ label: t.ongkir, k: "ongkir" })}
        {Kotak({ label: t.asuransi, k: "asuransi" })}
        {Kotak({ label: t.kurs, k: "kurs", ket: t.kursKet })}
        {Kotak({ label: t.bm, k: "bm", ket: t.bmKet })}
        {Kotak({ label: t.biayaLain, k: "lain", mode: "numeric" })}
        <label className="flex min-w-0 flex-col gap-1 sm:col-span-2"><span className="text-tinta-2">{t.kelompok}</span>
          <select value={kelompok} onChange={(e) => setKelompok(e.target.value as Kelompok)} className={isian}>
            {KELOMPOK.map((k) => <option key={k} value={k}>{NAMA[k]}</option>)}
          </select></label>
        <label className="flex items-start gap-2 sm:col-span-2"><input type="checkbox" checked={api} onChange={(e) => setApi(e.target.checked)} className="mt-1 h-5 w-5" /><span>{t.api}</span></label>
        <label className="flex items-start gap-2 sm:col-span-2"><input type="checkbox" checked={mewah} onChange={(e) => setMewah(e.target.checked)} className="mt-1 h-5 w-5" /><span>{t.mewah}</span></label>
      </form>
      <section aria-labelledby="judul-hasil-impor" aria-live="polite" data-testid="hasil-impor">
        <h2 id="judul-hasil-impor" className="text-lg font-semibold">{t.hasilJudul}</h2>
        <p className="mt-1 rounded-[var(--radius-isian)] border border-garis-kuat p-3 text-sm" data-testid="bukan-billing">{t.bukanBilling}</p>
        {!h ? <p className="mt-3 text-sm text-tinta-2">{t.isiDulu}</p> : (
          <table className="mt-3 w-full text-sm">
            <caption className="sr-only">{t.hasilJudul}</caption>
            <thead><tr className="border-b border-garis-kuat text-left text-tinta-2"><th scope="col" className="py-1 font-semibold">{t.kolPos}</th><th scope="col" className="py-1 text-right font-semibold">{t.kolJumlah}</th></tr></thead>
            <tbody>
              <Baris bahasa={bahasa} label={isiTeks(t.rCif, { usd: formatUsd(h.cifSen), kurs: formatKurs(kurs, bahasa) })} nilai={h.cifRp} uji="impor-cif" />
              <Baris bahasa={bahasa} label={isiTeks(t.rBm, { persen: persenTeks(bmPersen, bahasa) })} nilai={h.bm} />
              <Baris bahasa={bahasa} label={t.rNilai} nilai={h.nilaiImpor} uji="impor-nilai" />
              <Baris bahasa={bahasa} label={mewah ? t.rPpnMewah : t.rPpn} nilai={h.ppn} uji="impor-ppn" />
              <Baris bahasa={bahasa} label={isiTeks(t.rPph, { persen: persenTeks(h.tarifPph22, bahasa) })} nilai={h.pph22} uji="impor-pph" />
              <Baris bahasa={bahasa} label={t.rPajak} nilai={h.pajak} tebal />
              <Baris bahasa={bahasa} label={t.rLain} nilai={h.uangKeluar - h.cifRp - h.pajak} />
              <Baris bahasa={bahasa} label={t.rKeluar} nilai={h.uangKeluar} tebal uji="impor-keluar" />
              <Baris bahasa={bahasa} label={t.rMendarat} nilai={h.biayaMendarat} tebal uji="impor-mendarat" />
            </tbody>
          </table>
        )}
        {h ? <p className="mt-2 text-xs text-tinta-2">{t.mendaratKet}</p> : null}
      </section>
    </div>
  );
}
