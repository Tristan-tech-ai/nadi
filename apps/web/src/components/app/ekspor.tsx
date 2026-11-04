"use client";

import { useActionState, useState, type ReactNode } from "react";
import { batalkanInvoiceEkspor, buatInvoiceEkspor, type HasilEkspor } from "@/app/app/ekspor/actions";
import { Rupiah } from "@/components/ui/rupiah";
import { Tombol } from "@/components/ui/tombol";
import { angkaDesimal, angkaKurs, formatBerat, formatUsd, INCOTERMS, rupiahDariSen, totalEkspor } from "@/lib/ekspor/hitung";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";

type TF = Kamus["eksporForm"];
type Baris = { uraian: string; hs: string; jumlah: string; satuan: string; harga: string; bersih: string; kotor: string; koli: string };
const KOLOM: (keyof Baris)[] = ["uraian", "hs", "jumlah", "satuan", "harga", "bersih", "kotor", "koli"];
const kosong = (): Baris => ({ uraian: "", hs: "", jumlah: "1", satuan: "kg", harga: "", bersih: "", kotor: "", koli: "1" });

const isian = "h-10 w-full min-w-0 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";

function Hasil({ h }: { h: HasilEkspor }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="text-sm text-cap">{h.galat}</p> : <p role="status" className="text-sm text-daun" data-testid="ekspor-terbit">{h.pesan}</p>;
}

function Kotak({ label, children, lebar = false }: { label: string; children: ReactNode; lebar?: boolean }) {
  return <label className={`flex min-w-0 flex-col gap-1 ${lebar ? "sm:col-span-2" : ""}`}><span className="text-tinta-2">{label}</span>{children}</label>;
}

function Isi({ awal, kunci, hariIni, jatuhTempo, sibuk, t, bahasa }: { awal: Record<string, string>; kunci: string; hariIni: string; jatuhTempo: string; sibuk: boolean; t: TF; bahasa: Bahasa }) {
  const n = Number(awal.n ?? 0);
  const [baris, setBaris] = useState<Baris[]>(n > 0
    ? Array.from({ length: n }, (_, i) => Object.fromEntries(KOLOM.map((c) => [c, awal[`${c}.${i}`] ?? ""])) as Baris)
    : [kosong()]);
  const [kurs, setKurs] = useState(awal.kurs ?? "");
  const ubah = (i: number, k: keyof Baris, v: string) => setBaris((s) => s.map((b, j) => (j === i ? { ...b, [k]: v } : b)));
  const total = totalEkspor(baris.map((b) => ({ jumlah: angkaDesimal(b.jumlah), harga: angkaDesimal(b.harga), bersih: angkaDesimal(b.bersih), kotor: angkaDesimal(b.kotor), koli: Number(b.koli) })));
  const k = angkaKurs(kurs);
  const nilai = (c: string, d = "") => awal[c] ?? d;
  return (
    <>
      <input type="hidden" name="kunci" value={awal.kunci ?? kunci} />
      <Kotak label={t.penjual} lebar><input name="alamat_penjual" required minLength={5} maxLength={300} defaultValue={nilai("alamat_penjual")} placeholder={t.penjualContoh} className={isian} /></Kotak>
      <Kotak label={t.pembeli}><input name="pembeli" required maxLength={120} defaultValue={nilai("pembeli")} placeholder="Harbour Roasters Pty Ltd" className={isian} /></Kotak>
      <Kotak label={t.negara}><input name="negara" required maxLength={60} defaultValue={nilai("negara")} placeholder="Australia" className={isian} /></Kotak>
      <Kotak label={t.alamatPembeli} lebar><input name="alamat_pembeli" required minLength={5} maxLength={300} defaultValue={nilai("alamat_pembeli")} placeholder="18 Wharf Street, Fremantle WA 6160" className={isian} /></Kotak>
      <Kotak label={t.incoterm}>
        <select name="incoterm" defaultValue={nilai("incoterm", "FOB")} className={isian}>{INCOTERMS.map((x) => <option key={x} value={x}>{x}</option>)}</select>
      </Kotak>
      <Kotak label={t.tempat}><input name="tempat_incoterm" required maxLength={80} defaultValue={nilai("tempat_incoterm")} placeholder="Benoa" className={isian} /></Kotak>
      <Kotak label={t.muat}><input name="pelabuhan_muat" maxLength={80} defaultValue={nilai("pelabuhan_muat")} placeholder="Benoa" className={isian} /></Kotak>
      <Kotak label={t.tujuan}><input name="pelabuhan_tujuan" maxLength={80} defaultValue={nilai("pelabuhan_tujuan")} placeholder="Fremantle" className={isian} /></Kotak>
      <Kotak label={t.kurs}><input name="kurs" required inputMode="decimal" value={kurs} onChange={(e) => setKurs(e.target.value)} placeholder="16.287,50" className={`${isian} angka text-right`} /></Kotak>
      <Kotak label={t.kursTanggal}><input type="date" name="kurs_tanggal" required max={hariIni} defaultValue={nilai("kurs_tanggal", hariIni)} className={isian} /></Kotak>
      <Kotak label={t.kursSumber} lebar><input name="kurs_sumber" required minLength={3} maxLength={120} defaultValue={nilai("kurs_sumber")} placeholder={t.kursSumberContoh} className={isian} /></Kotak>
      <p className="text-xs text-tinta-2 sm:col-span-2">{t.kursKet}</p>
      <fieldset className="sm:col-span-2">
        <legend className="text-tinta-2">{t.barang}</legend>
        <ul className="mt-1 grid gap-3">
          {baris.map((b, i) => (
            <li key={i} className="grid grid-cols-2 gap-2 border-b border-garis pb-3 sm:grid-cols-4" data-testid="baris-ekspor">
              <label className="col-span-2 flex min-w-0 flex-col gap-1"><span className="text-xs text-tinta-2">{t.uraian}</span>
                <input name="uraian" value={b.uraian} onChange={(e) => ubah(i, "uraian", e.target.value)} maxLength={120} placeholder="Arabica green beans grade 1" className={isian} /></label>
              {(["hs", "satuan"] as const).map((c) => (
                <label key={c} className="flex min-w-0 flex-col gap-1"><span className="text-xs text-tinta-2">{t[c]}</span>
                  <input name={c} value={b[c]} onChange={(e) => ubah(i, c, e.target.value)} maxLength={c === "hs" ? 10 : 12} placeholder={c === "hs" ? "0901.11.10" : "kg"} className={`${isian} ${c === "hs" ? "font-mono" : ""}`} /></label>
              ))}
              {(["jumlah", "harga", "bersih", "kotor", "koli"] as const).map((c) => (
                <label key={c} className="flex min-w-0 flex-col gap-1"><span className="text-xs text-tinta-2">{t[c]}</span>
                  <input name={c} value={b[c]} onChange={(e) => ubah(i, c, e.target.value)} inputMode={c === "koli" ? "numeric" : "decimal"} className={`${isian} angka text-right`} /></label>
              ))}
              <button type="button" onClick={() => setBaris((s) => s.filter((_, j) => j !== i))} disabled={baris.length === 1}
                className="h-10 self-end px-1 text-left text-sm text-tinta-2 underline underline-offset-4 disabled:invisible" aria-label={isiTeks(t.hapusAria, { n: i + 1 })}>{t.hapus}</button>
            </li>
          ))}
        </ul>
        {baris.length < 30 && <button type="button" onClick={() => setBaris((s) => [...s, kosong()])} className="mt-2 text-sm underline underline-offset-4">{t.tambah}</button>}
      </fieldset>
      <Kotak label={t.jatuhTempo}><input type="date" name="jatuh_tempo" required min={hariIni} defaultValue={nilai("jatuh_tempo", jatuhTempo)} className={isian} /></Kotak>
      <Kotak label={t.catatan}><input name="catatan" maxLength={300} defaultValue={nilai("catatan")} placeholder="Payment by T/T" className={isian} /></Kotak>
      <div className="sm:col-span-2" data-testid="total-ekspor">
        <p className="text-base font-semibold"><span>{t.total}</span> <span className="angka" lang="en">{formatUsd(total.sen)}</span>
          {Number.isFinite(k) && k > 0 ? <span className="font-normal text-tinta-2"> ({t.setara} <Rupiah nilai={rupiahDariSen(total.sen, k)} bahasa={bahasa} />)</span> : null}</p>
        <p className="text-sm text-tinta-2">{isiTeks(t.packing, { koli: total.koli, bersih: formatBerat(total.bersih, bahasa), kotor: formatBerat(total.kotor, bahasa) })}</p>
      </div>
      <div className="sm:col-span-2"><Tombol type="submit" ragam="utama" disabled={sibuk}>{sibuk ? t.menerbitkan : t.terbitkan}</Tombol></div>
    </>
  );
}

export function FormEkspor({ kunci, hariIni, jatuhTempo, teks: t, bahasa = "id" }: { kunci: string; hariIni: string; jatuhTempo: string; teks: TF; bahasa?: Bahasa }) {
  const [h, aksi, sibuk] = useActionState<HasilEkspor, FormData>(buatInvoiceEkspor, null);
  const awal = h && "galat" in h ? (h.isian ?? {}) : {};
  return (
    <form action={aksi} className="mt-3 grid grid-cols-1 gap-3 rounded-[var(--radius-kartu)] border border-garis p-4 text-sm sm:grid-cols-2" aria-label={t.aria} data-testid="form-ekspor">
      <Isi key={JSON.stringify(h)} awal={awal} kunci={kunci} hariIni={hariIni} jatuhTempo={jatuhTempo} sibuk={sibuk} t={t} bahasa={bahasa} />
      <div className="sm:col-span-2"><Hasil h={h} /></div>
    </form>
  );
}

export function FormBatalEkspor({ invoice, label, teks: t }: { invoice: string; label: string; teks: TF }) {
  const [h, aksi, sibuk] = useActionState<HasilEkspor, FormData>(batalkanInvoiceEkspor, null);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-tinta-2 underline underline-offset-4">{t.batalJudul}</summary>
      <form action={aksi} className="mt-2 flex flex-wrap items-end gap-2" aria-label={isiTeks(t.batalAria, { label })}>
        <input type="hidden" name="invoice" value={invoice} />
        <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.alasan}</span>
          <input name="alasan" required minLength={3} maxLength={300} placeholder={t.alasanContoh} className={isian} /></label>
        <Tombol type="submit" ragam="bahaya" disabled={sibuk}>{t.batalkan}</Tombol>
        <Hasil h={h} />
      </form>
    </details>
  );
}
