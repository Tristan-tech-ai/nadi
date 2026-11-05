"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Tombol } from "@/components/ui/tombol";
import { formatRupiah } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";
import { bacaAntrean, cari, kurangi, simpanAntrean, tambah, totalKeranjang, type Antre, type Baris, type Produk } from "@/lib/kasir";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type T = Kamus["kasir"];
const isian = "h-11 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base";
const simpanLokal = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* diblokir */ } };
const bacaLokal = <X,>(k: string): X | null => { try { return JSON.parse(localStorage.getItem(k) ?? "null") as X; } catch { return null; } };
const penyimpanan = () => { try { return localStorage; } catch { return null; } };

/**
 * Kasir: daftar produk dan shift disimpan di perangkat; setiap penjualan masuk antrean lokal dulu (kunci uuid) lalu dikirim.
 * Tanpa internet, antrean tetap tersimpan dan dikirim otomatis saat peramban kembali daring.
 */
export function KasirApp({ pid, bahasa, teks: t }: { pid: string; bahasa: Bahasa; teks: T }) {
  const kp = `nadi-kasir-produk-${pid}`;
  const ksh = `nadi-kasir-shift-${pid}`;
  const [produk, setProduk] = useState<Produk[]>([]);
  const [shift, setShift] = useState<string | null>(null);
  const [kk, setKk] = useState<Baris[]>([]);
  const [q, setQ] = useState("");
  const [bayar, setBayar] = useState<Antre["bayar"]>("tunai");
  const [diterima, setDiterima] = useState("");
  const [antre, setAntre] = useState<Antre[]>([]);
  const [info, setInfo] = useState("");
  const [struk, setStruk] = useState<{ kode: string; total: number } | null>(null);
  const [harian, setHarian] = useState<{ transaksi: number; total: number } | null>(null);
  const [pindai, setPindai] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const [daring, setDaring] = useState(true);
  const kirimJalan = useRef(false);
  const id = { cari: useId(), terima: useId(), kas: useId(), tutup: useId() };
  const rp = (n: number) => formatRupiah(n, { bahasa });

  const kirimAntrean = useCallback(async () => {
    if (kirimJalan.current || !navigator.onLine) return;
    kirimJalan.current = true;
    try {
      let a = bacaAntrean(penyimpanan());
      for (const x of a) {
        const { data, error } = await createBrowserSupabase().rpc("pos_record_sale", {
          p_shift: x.shift, p_kunci: x.kunci, p_waktu: x.waktu, p_baris: x.baris, p_bayar: x.bayar, p_diterima: x.diterima, p_total_perangkat: x.total,
        });
        if (error) {
          if (/fetch|network|Failed/i.test(error.message)) break;
          a = a.map((y) => (y.kunci === x.kunci ? { ...y, galat: error.message } : y));
          continue;
        }
        a = a.filter((y) => y.kunci !== x.kunci);
        const d = data as { kode: string; total: number };
        setStruk({ kode: d.kode, total: d.total });
      }
      simpanAntrean(penyimpanan(), a);
      setAntre(a);
      const { data: h } = await createBrowserSupabase().rpc("pos_daily", { p_tanggal: new Intl.DateTimeFormat("en-CA").format(new Date()) });
      if (h) setHarian(h as { transaksi: number; total: number });
    } finally {
      kirimJalan.current = false;
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      setProduk(bacaLokal<Produk[]>(kp) ?? []);
      setShift(bacaLokal<string>(ksh));
      setAntre(bacaAntrean(penyimpanan()));
      setDaring(navigator.onLine);
    });
    void createBrowserSupabase().rpc("pos_products").then(({ data }) => { if (Array.isArray(data)) { setProduk(data as Produk[]); simpanLokal(kp, data); } });
    const naik = () => { setDaring(true); void kirimAntrean(); };
    const turun = () => setDaring(false);
    window.addEventListener("online", naik);
    window.addEventListener("offline", turun);
    const iv = setInterval(() => void kirimAntrean(), 15000);
    void kirimAntrean();
    return () => { window.removeEventListener("online", naik); window.removeEventListener("offline", turun); clearInterval(iv); };
  }, [kp, ksh, kirimAntrean]);

  useEffect(() => {
    if (!pindai) return;
    type Detektor = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
    const D = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detektor }).BarcodeDetector;
    if (!D || !navigator.mediaDevices) { queueMicrotask(() => { setInfo(t.pindaiTak); setPindai(false); }); return; }
    let aliran: MediaStream | null = null;
    let hidup = true;
    const det = new D({ formats: ["ean_13", "ean_8", "upc_a", "code_128", "qr_code"] });
    void navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(async (s) => {
      aliran = s;
      if (!video.current) return;
      video.current.srcObject = s;
      await video.current.play();
      while (hidup) {
        const k = await det.detect(video.current).catch(() => []);
        const h = k.length ? cari(produk, k[0].rawValue) : [];
        if (h.length === 1) { setKk((x) => tambah(x, h[0])); setPindai(false); break; }
        await new Promise((r) => setTimeout(r, 250));
      }
    }).catch(() => { setInfo(t.pindaiTak); setPindai(false); });
    return () => { hidup = false; aliran?.getTracks().forEach((x) => x.stop()); };
  }, [pindai, produk, t.pindaiTak]);

  const daftar = useMemo(() => cari(produk, q).slice(0, 60), [produk, q]);
  const total = totalKeranjang(kk);

  const buka = async (f: FormData) => {
    const { data, error } = await createBrowserSupabase().rpc("pos_open_shift", { p_kas_awal: Number(String(f.get("kas") ?? "0").replace(/\D/g, "")) || 0 });
    if (error) return setInfo(error.message);
    setShift(data as string);
    simpanLokal(ksh, data);
  };
  const jual = async () => {
    if (!shift || !kk.length) return;
    const terima = bayar === "tunai" ? Number(diterima.replace(/\D/g, "")) || 0 : null;
    if (bayar === "tunai" && (terima ?? 0) < total) return setInfo(isiTeks(t.kurang, { rp: rp(total) }));
    const x: Antre = { kunci: crypto.randomUUID(), shift, waktu: new Date().toISOString(), baris: kk.map((b) => ({ produk: b.produk, jumlah: b.jumlah })), bayar, diterima: terima, total };
    const a = [...bacaAntrean(penyimpanan()), x];
    simpanAntrean(penyimpanan(), a);
    setAntre(a);
    setKk([]);
    setDiterima("");
    setInfo(`${navigator.onLine ? "" : `${t.luring} `}${terima !== null ? isiTeks(t.kembalian, { rp: rp(terima - total) }) : ""}`.trim());
    await kirimAntrean();
  };
  const tutup = async (f: FormData) => {
    if (!shift) return;
    const { data, error } = await createBrowserSupabase().rpc("pos_close_shift", { p_shift: shift, p_kas_hitung: Number(String(f.get("kas") ?? "").replace(/\D/g, "")) });
    if (error) return setInfo(error.message);
    const r = data as { kas_harus: number; selisih: number };
    setInfo(isiTeks(t.selisih, { harus: rp(r.kas_harus), selisih: rp(r.selisih) }));
    setShift(null);
    simpanLokal(ksh, null);
  };

  if (!shift) return (
    <form action={buka} className="mt-6 grid max-w-sm gap-3" aria-label={t.bukaShift}>
      <label htmlFor={id.kas} className="text-sm text-tinta-2">{t.kasAwal}</label>
      <input id={id.kas} name="kas" inputMode="numeric" defaultValue="0" className={`${isian} angka`} />
      <div><Tombol type="submit">{t.bukaShift}</Tombol></div>
      {info && <p role="status" className="text-sm">{info}</p>}
    </form>
  );

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_22rem]" data-testid="kasir">
      <section aria-label={t.judul}>
        {!daring && <p className="mb-3 rounded-[var(--radius-kartu)] bg-kertas-2 p-3 text-sm" role="status" data-testid="kasir-luring">{t.luring}</p>}
        {antre.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm" data-testid="kasir-antre" data-jumlah={antre.length}>
            <span>{isiTeks(t.antre, { n: antre.length })}</span>
            <Tombol type="button" ragam="kedua" onClick={() => void kirimAntrean()}>{t.sinkron}</Tombol>
            {antre.filter((a) => a.galat).map((a) => <span key={a.kunci} role="alert" className="text-cap">{isiTeks(t.gagalKirim, { pesan: a.galat ?? "" })}</span>)}
          </div>
        )}
        <div className="flex gap-2">
        <label htmlFor={id.cari} className="sr-only">{t.cari}</label>
        <input id={id.cari} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.cari} className={isian} autoComplete="off"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const h = cari(produk, q); if (h.length === 1) { setKk((k) => tambah(k, h[0])); setQ(""); } } }} />
          <Tombol type="button" ragam="kedua" onClick={() => setPindai((x) => !x)} aria-pressed={pindai}>{t.pindai}</Tombol>
        </div>
        {pindai && <video ref={video} muted playsInline className="mt-3 aspect-video w-full max-w-sm rounded-[var(--radius-kartu)] bg-kertas-2" aria-label={t.pindai} />}
        {produk.length === 0 ? <p className="mt-3 text-sm text-tinta-2">{t.tanpaBarang}</p> : (
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="kasir-produk">
            {daftar.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => setKk((k) => tambah(k, p))}
                  className="flex h-full w-full flex-col items-start rounded-[var(--radius-kartu)] border border-garis p-3 text-left text-sm hover:bg-kertas-2">
                  <span className="font-semibold"><span className="sr-only">{isiTeks(t.tambah, { nama: "" }).trim()} </span>{p.nama}</span>
                  <span className="angka">{rp(p.harga)}</span>
                  {p.stok !== null && <span className="text-xs text-tinta-2">{isiTeks(t.stok, { n: p.stok })}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-label={t.keranjang} className="rounded-[var(--radius-kartu)] border border-garis p-4">
        <h2 className="font-semibold">{t.keranjang}</h2>
        {kk.length === 0 ? <p className="mt-2 text-sm text-tinta-2">{t.kosong}</p> : (
          <ul className="mt-2 divide-y divide-garis text-sm" data-testid="keranjang">
            {kk.map((b) => (
              <li key={b.produk} className="flex items-center justify-between gap-2 py-2">
                <span>{b.nama} <span className="angka text-tinta-2">x{b.jumlah}</span></span>
                <span className="flex items-center gap-2"><span className="angka">{rp(b.harga * b.jumlah)}</span>
                  <button type="button" onClick={() => setKk((k) => kurangi(k, b.produk))} aria-label={isiTeks(t.kurangi, { nama: b.nama })} className="h-8 w-8 rounded-full border border-garis-kuat">-</button></span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 flex justify-between text-lg font-semibold"><span>{t.total}</span><span className="angka" data-testid="kasir-total">{rp(total)}</span></p>
        <fieldset className="mt-3"><legend className="text-sm text-tinta-2">{t.bayar}</legend>
          <div className="mt-1 flex gap-3 text-sm">{(["tunai", "qris", "transfer"] as const).map((c) => (
            <label key={c} className="flex items-center gap-1"><input type="radio" name="bayar" value={c} checked={bayar === c} onChange={() => setBayar(c)} className="h-5 w-5" />{t.caraNama[c]}</label>
          ))}</div>
        </fieldset>
        {bayar === "tunai" && <div className="mt-3 flex flex-col gap-1"><label htmlFor={id.terima} className="text-sm text-tinta-2">{t.diterima}</label>
          <input id={id.terima} value={diterima} onChange={(e) => setDiterima(e.target.value)} inputMode="numeric" className={`${isian} angka`} /></div>}
        <Tombol type="button" className="mt-4 w-full" disabled={!kk.length} onClick={() => void jual()}>{t.bayarTombol}</Tombol>
        {info && <p role="status" className="mt-2 text-sm" data-testid="kasir-info">{info}</p>}
        {struk && (
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <a href={`/struk/${struk.kode}`} className="text-laut underline underline-offset-2" data-testid="kasir-struk">{isiTeks(t.tersimpan, { kode: struk.kode })}</a>
            <a href={`https://wa.me/?text=${encodeURIComponent(isiTeks(t.strukTeks, { kode: struk.kode, rp: rp(struk.total), url: `${location.origin}/struk/${struk.kode}` }))}`} target="_blank" rel="noopener noreferrer" className="text-laut underline underline-offset-2">{t.strukWa}</a>
          </p>
        )}
        {harian && <p className="mt-4 text-sm text-tinta-2" data-testid="kasir-harian">{t.hariIni}: {isiTeks(t.transaksi, { n: harian.transaksi })}, <span className="angka">{rp(harian.total)}</span></p>}
        <form action={tutup} className="mt-6 grid gap-2 border-t border-garis pt-4" aria-label={t.tutupShift}>
          <label htmlFor={id.tutup} className="text-sm text-tinta-2">{t.kasHitung}</label>
          <input id={id.tutup} name="kas" inputMode="numeric" required className={`${isian} angka`} />
          <div><Tombol type="submit" ragam="kedua">{t.tutupTombol}</Tombol></div>
        </form>
      </section>
    </div>
  );
}
