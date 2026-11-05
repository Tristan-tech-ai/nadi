"use client";

import { useEffect, useId, useState } from "react";
import { pesanJanji, slotJanji } from "@/app/janji/[kunci]/actions";
import { Tombol } from "@/components/ui/tombol";
import { formatRupiah } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";

type T = Kamus["janjiPublik"];
type Layanan = { id: string; nama: string; durasi: number; harga: number };
const isian = "h-11 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base";

/** Pemesanan jadwal: pilih layanan dan tanggal, Nadi menampilkan jam kosong dari database, lalu isi nama. */
export function PesanJanji({ kunci, layanan, hariIni, bahasa, teks: t }: { kunci: string; layanan: Layanan[]; hariIni: string; bahasa: Bahasa; teks: T }) {
  const [lay, setLay] = useState(layanan[0]?.id ?? "");
  const [tgl, setTgl] = useState(hariIni);
  const [slot, setSlot] = useState<string[] | null>(null);
  const [jam, setJam] = useState("");
  const [galat, setGalat] = useState("");
  const [hasil, setHasil] = useState<{ kode: string; layanan: string; tanggal: string; jam: string } | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const id = { lay: useId(), tgl: useId(), nama: useId(), hp: useId(), cat: useId() };

  useEffect(() => {
    let batal = false;
    if (!lay || !tgl) return;
    void slotJanji(kunci, lay, tgl).then((r) => { if (!batal) { const ada = Array.isArray(r) ? r : []; setSlot(ada); setJam((j) => (ada.includes(j) ? j : "")); if (!Array.isArray(r)) setGalat(r.galat); } });
    return () => { batal = true; };
  }, [kunci, lay, tgl, hasil]);

  const kirim = async (f: FormData) => {
    setSibuk(true); setGalat("");
    const r = await pesanJanji(kunci, f);
    setSibuk(false);
    if ("galat" in r) return setGalat(r.galat);
    setHasil(r);
  };

  if (hasil) return <p className="mt-6 rounded-[var(--radius-kartu)] bg-kertas-2 p-4" role="status" data-testid="janji-berhasil">{isiTeks(t.berhasil, { kode: hasil.kode, layanan: hasil.layanan, tanggal: new Intl.DateTimeFormat(bahasa === "en" ? "en-GB" : "id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${hasil.tanggal}T00:00:00Z`)), jam: hasil.jam.replace(":", ".") })}</p>;
  return (
    <form action={kirim} className="mt-6 grid gap-4" aria-label={t.pesan}>
      <div className="flex flex-col gap-1"><label htmlFor={id.lay} className="text-sm text-tinta-2">{t.layanan}</label>
        <select id={id.lay} name="layanan" value={lay} onChange={(e) => setLay(e.target.value)} required className={isian}>
          {layanan.map((l) => <option key={l.id} value={l.id}>{l.nama}, {isiTeks(t.menit, { n: l.durasi })}{l.harga ? `, ${formatRupiah(l.harga, { bahasa })}` : ""}</option>)}
        </select></div>
      <div className="flex flex-col gap-1"><label htmlFor={id.tgl} className="text-sm text-tinta-2">{t.tanggal}</label>
        <input id={id.tgl} type="date" name="tanggal" value={tgl} min={hariIni} onChange={(e) => setTgl(e.target.value)} required className={isian} /></div>
      <fieldset>
        <legend className="text-sm text-tinta-2">{t.jam}</legend>
        {slot && slot.length === 0 ? <p className="mt-1 text-sm text-tinta-2">{t.tanpaJam}</p> : (
          <div className="mt-2 flex flex-wrap gap-2" data-testid="slot-janji">
            {(slot ?? []).map((s) => (
              <label key={s} className={`cursor-pointer rounded-[var(--radius-isian)] border px-3 py-2 text-sm angka has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-tinta ${jam === s ? "border-tinta bg-tinta text-kertas" : "border-garis-kuat"}`}>
                <input type="radio" name="jam" value={s} checked={jam === s} onChange={() => setJam(s)} className="sr-only" required />{s.replace(":", ".")}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <div className="flex flex-col gap-1"><label htmlFor={id.nama} className="text-sm text-tinta-2">{t.nama}</label><input id={id.nama} name="nama" required minLength={2} maxLength={80} autoComplete="name" className={isian} /></div>
      <div className="flex flex-col gap-1"><label htmlFor={id.hp} className="text-sm text-tinta-2">{t.hp}</label><input id={id.hp} name="hp" inputMode="tel" autoComplete="tel" className={isian} /></div>
      <div className="flex flex-col gap-1"><label htmlFor={id.cat} className="text-sm text-tinta-2">{t.catatan}</label><input id={id.cat} name="catatan" maxLength={300} className={isian} /></div>
      <div className="flex flex-col items-start gap-2"><Tombol type="submit" disabled={sibuk || !jam}>{t.pesan}</Tombol>{galat && <p role="alert" className="text-sm text-cap">{galat}</p>}</div>
    </form>
  );
}
