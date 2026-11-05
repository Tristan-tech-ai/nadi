"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { bacaObrolan, kirimPesan, mulaiObrolan, nilaiObrolan, type Obrolan } from "@/app/bantuan/[kunci]/actions";
import { Tombol } from "@/components/ui/tombol";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";

type T = Kamus["bantuanPublik"];
const isian = "w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 py-2 text-base";
const kunciSimpan = (k: string) => `nadi-obrolan-${k}`;
const baca = (k: string) => { try { return localStorage.getItem(kunciSimpan(k)); } catch { return null; } };
const simpan = (k: string, v: string | null) => { try { if (v) localStorage.setItem(kunciSimpan(k), v); else localStorage.removeItem(kunciSimpan(k)); } catch { /* penyimpanan diblokir: obrolan tetap jalan selama tab terbuka */ } };

/** Obrolan web pengunjung: token di perangkat ini saja; pesan baru dibaca ulang tiap 4 detik selama halaman terbuka. */
export function ObrolanWeb({ kunci, usaha, teks: t }: { kunci: string; usaha: string; teks: T }) {
  const [token, setToken] = useState<string | null>(null);
  const [o, setO] = useState<Obrolan | null>(null);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [isi, setIsi] = useState("");
  const akhir = useRef<HTMLLIElement>(null);
  const id = { nama: useId(), kontak: useId(), pesan: useId(), tulis: useId() };

  const muat = useCallback(async (tk: string) => {
    const r = await bacaObrolan(tk);
    if ("galat" in r) { simpan(kunci, null); setToken(null); setO(null); return; }
    setO(r);
  }, [kunci]);

  useEffect(() => {
    const tk = baca(kunci);
    if (tk) queueMicrotask(() => setToken(tk));
  }, [kunci]);
  useEffect(() => {
    if (!token) return;
    queueMicrotask(() => void muat(token));
    const iv = setInterval(() => { if (document.visibilityState === "visible") void muat(token); }, 4000);
    return () => clearInterval(iv);
  }, [token, muat]);
  useEffect(() => { akhir.current?.scrollIntoView({ block: "nearest" }); }, [o?.pesan.length]);

  const mulai = async (f: FormData) => {
    setSibuk(true); setGalat("");
    const r = await mulaiObrolan(kunci, String(f.get("nama") ?? ""), String(f.get("kontak") ?? ""), String(f.get("pesan") ?? ""));
    setSibuk(false);
    if ("galat" in r) return setGalat(r.galat);
    simpan(kunci, r.token);
    setToken(r.token);
  };
  const kirim = async () => {
    if (!token || !isi.trim()) return;
    setSibuk(true); setGalat("");
    const r = await kirimPesan(token, isi);
    setSibuk(false);
    if ("galat" in r) return setGalat(r.galat);
    setIsi("");
    await muat(token);
  };
  const nilai = async (n: number) => {
    if (!token) return;
    const r = await nilaiObrolan(token, n);
    if ("galat" in r) return setGalat(r.galat);
    await muat(token);
  };
  const label = (dari: string, agen: string | null) => dari === "pengunjung" ? t.kamu : dari === "agen" ? (agen ?? isiTeks(t.tim, { usaha })) : dari === "bot" ? t.otomatis : t.nadi;

  if (!token || !o) {
    return (
      <form action={mulai} className="mt-6 grid gap-4" aria-label={isiTeks(t.judul, { usaha })}>
        <div className="flex flex-col gap-1"><label htmlFor={id.nama} className="text-sm text-tinta-2">{t.nama}</label><input id={id.nama} name="nama" required minLength={2} maxLength={80} autoComplete="name" className={isian} /></div>
        <div className="flex flex-col gap-1"><label htmlFor={id.kontak} className="text-sm text-tinta-2">{t.kontak}</label><input id={id.kontak} name="kontak" maxLength={120} className={isian} /></div>
        <div className="flex flex-col gap-1"><label htmlFor={id.pesan} className="text-sm text-tinta-2">{t.pesan}</label><textarea id={id.pesan} name="pesan" required maxLength={1000} rows={3} className={isian} /></div>
        <div className="flex flex-col items-start gap-2"><Tombol type="submit" disabled={sibuk}>{t.mulai}</Tombol>{galat && <p role="alert" className="text-sm text-cap">{galat}</p>}</div>
      </form>
    );
  }
  return (
    <div className="mt-6" data-testid="obrolan" data-status={o.status}>
      <ul className="space-y-3" aria-live="polite">
        {o.pesan.map((p, i) => (
          <li key={i} ref={i === o.pesan.length - 1 ? akhir : undefined} className={`max-w-[85%] rounded-[var(--radius-kartu)] px-3 py-2 text-sm ${p.dari === "pengunjung" ? "ml-auto bg-tinta text-kertas" : "bg-kertas-2"}`} data-dari={p.dari}>
            <p className={`text-xs ${p.dari === "pengunjung" ? "text-kertas" : "text-tinta-2"}`}>{label(p.dari, p.agen)}</p>
            <p className="whitespace-pre-line">{p.isi}</p>
          </li>
        ))}
      </ul>
      {o.status === "selesai" ? (
        <div className="mt-6" data-testid="nilai-obrolan">
          {o.csat ? <p className="text-sm text-daun" role="status">{t.terimaKasih}</p> : (
            <>
              <p className="text-sm font-semibold">{t.selesai}</p>
              <div className="mt-2 flex gap-2">{[1, 2, 3, 4, 5].map((n) => <Tombol key={n} type="button" ragam="kedua" aria-label={isiTeks(t.nilai, { n })} onClick={() => nilai(n)}>{n}</Tombol>)}</div>
            </>
          )}
          <Tombol type="button" ragam="kedua" className="mt-4" onClick={() => { simpan(kunci, null); setToken(null); setO(null); }}>{t.baru}</Tombol>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); void kirim(); }} className="mt-4 flex gap-2">
          <label htmlFor={id.tulis} className="sr-only">{t.tulis}</label>
          <input id={id.tulis} value={isi} onChange={(e) => setIsi(e.target.value)} maxLength={1000} placeholder={t.tulis} className={isian} />
          <Tombol type="submit" disabled={sibuk || !isi.trim()}>{t.kirim}</Tombol>
        </form>
      )}
      {galat && <p role="alert" className="mt-2 text-sm text-cap">{galat}</p>}
    </div>
  );
}
