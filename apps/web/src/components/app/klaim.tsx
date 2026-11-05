"use client";

import { useActionState, useId, useState } from "react";
import { ajukanDinas, ajukanKlaim, aturUangHarian, bacaStrukAksi, bayarKlaim, bayarUangMuka, selesaikanDinas, simpanKategori, type HasilKlaim } from "@/app/app/klaim/actions";
import { isiTeks } from "@/lib/i18n/isi-teks";
import { AMBANG_OCR, bacaTeksFoto } from "@/lib/ocr";
import { Tombol } from "@/components/ui/tombol";
import type { Kamus } from "@/lib/i18n/kamus";
import { bacaStruk, cocokKategori } from "@/lib/klaim/struk";
import { lemparBerkas, mimeBerkas } from "@/lib/lempar";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type T = Kamus["klaim"];
const isian = "h-10 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";
function Hasil({ h }: { h: HasilKlaim }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="text-cap">{h.galat}</p> : <p role="status" className="text-daun">{h.pesan}</p>;
}
function Kolom({ label, children, lebar = false }: { label: string; children: (id: string) => React.ReactNode; lebar?: boolean }) {
  const id = useId();
  return <div className={`flex flex-col gap-1 ${lebar ? "col-span-2" : ""}`}><label htmlFor={id} className="text-tinta-2">{label}</label>{children(id)}</div>;
}

/** Klaim staf. Struk diunggah dulu dari peramban (seperti bukti izin), lalu id-nya dikirim. Teks e-struk boleh ditempel untuk mengisi otomatis. */
export function FormKlaim({ kategori, perjalanan, hari, kunci, teks: t }: { kategori: { id: string; nama: string; butuh_struk: boolean }[]; perjalanan: { id: string; tujuan: string }[]; hari: string; kunci: string; teks: T }) {
  const [h, aksi, sibuk] = useActionState<HasilKlaim, FormData>(async (sebelum, form) => {
    const struk = form.get("struk");
    form.delete("struk");
    // Foto yang sudah diunggah saat dibaca model dipakai lagi (input tersembunyi "berkas"), tidak diunggah dua kali.
    if (!form.get("berkas") && struk instanceof File && struk.size > 0) {
      const mime = mimeBerkas(struk.name, struk.type);
      if (!mime) return { galat: t.strukJenis };
      const r = await lemparBerkas(createBrowserSupabase(), { isi: await struk.arrayBuffer(), nama: struk.name, mime }, { baca: false });
      if (r.status === "galat") return { galat: r.pesan };
      if (r.berkasId) form.set("berkas", r.berkasId);
    }
    return ajukanKlaim(sebelum, form);
  }, null);
  const [kat, setKat] = useState("");
  const [tanggal, setTanggal] = useState(hari);
  const [jumlah, setJumlah] = useState("");
  const [info, setInfo] = useState("");
  const [ket, setKet] = useState("");
  const [berkasId, setBerkasId] = useState<string | null>(null);
  const [membaca, setMembaca] = useState(false);
  /** Foto struk: OCR di HP ini dulu (0 token); bila keyakinan < 85 atau total tidak terbaca, Nadi membaca dengan model. */
  const bacaFoto = async (f: File | undefined) => {
    setBerkasId(null);
    if (!f || !f.type.startsWith("image/")) return;
    setMembaca(true);
    setInfo(t.membacaFoto);
    try {
      const o = await bacaTeksFoto(f);
      const r = o ? bacaStruk(o.teks) : null;
      if (o && r?.total && o.keyakinan >= AMBANG_OCR) {
        isi(r.total, r.tanggal, r.pemasok, cocokKategori(r.kategori, kategori));
        return setInfo(t.terbacaFoto);
      }
      const mime = mimeBerkas(f.name, f.type);
      if (!mime) return setInfo(t.strukJenis);
      const up = await lemparBerkas(createBrowserSupabase(), { isi: await f.arrayBuffer(), nama: f.name, mime }, { baca: false });
      if (up.status === "galat" || !up.berkasId) return setInfo("pesan" in up ? up.pesan : t.fotoTakTerbaca);
      setBerkasId(up.berkasId);
      const m = await bacaStrukAksi(up.berkasId);
      if ("galat" in m) return setInfo(m.galat);
      isi(m.total, m.tanggal, m.pemasok, r ? cocokKategori(r.kategori, kategori) : null);
      setInfo(isiTeks(t.terbacaAi, { n: Math.round(m.keyakinan * 100) }));
    } finally {
      setMembaca(false);
    }
  };
  const isi = (total: number | null, tgl: string | null, pemasok: string | null, k: string | null) => {
    if (total) setJumlah(String(total));
    if (tgl && tgl <= hari) setTanggal(tgl);
    if (pemasok && !ket) setKet(pemasok);
    if (k) setKat(k);
  };
  const isiDariTeks = (teks: string) => {
    const r = bacaStruk(teks);
    if (r.total) setJumlah(String(r.total));
    if (r.tanggal) setTanggal(r.tanggal);
    const k = cocokKategori(r.kategori, kategori);
    if (k) setKat(k);
    setInfo(r.total || r.tanggal ? t.terbaca : t.tidakTerbaca);
  };
  return (
    <form action={aksi} className="mt-3 grid grid-cols-2 gap-3 text-sm" aria-label={t.klaimAria}>
      <input type="hidden" name="kunci" value={kunci} />
      {berkasId && <input type="hidden" name="berkas" value={berkasId} />}
      <Kolom label={t.tempel} lebar>{(id) => <textarea id={id} rows={3} maxLength={4000} placeholder={t.tempelContoh} onChange={(e) => e.target.value.length > 20 && isiDariTeks(e.target.value)} className="rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 py-2 text-base" />}</Kolom>
      {info && <p className="col-span-2 text-xs text-tinta-2" role="status">{info}</p>}
      <Kolom label={t.kategori}>{(id) => (
        <select id={id} name="kategori" required value={kat} onChange={(e) => setKat(e.target.value)} className={isian}>
          <option value="" disabled>{t.pilihKategori}</option>
          {kategori.map((k) => <option key={k.id} value={k.id}>{k.nama}{k.butuh_struk ? ` (${t.wajibStruk})` : ""}</option>)}
        </select>)}</Kolom>
      <Kolom label={t.tanggal}>{(id) => <input id={id} type="date" name="tanggal" required max={hari} value={tanggal} onChange={(e) => setTanggal(e.target.value)} className={isian} />}</Kolom>
      <Kolom label={t.jumlah}>{(id) => <input id={id} name="jumlah" inputMode="numeric" required value={jumlah} onChange={(e) => setJumlah(e.target.value)} className={isian} />}</Kolom>
      <Kolom label={t.struk}>{(id) => <input id={id} type="file" name="struk" accept="image/*,application/pdf" className="text-sm" disabled={membaca} onChange={(e) => bacaFoto(e.target.files?.[0])} data-testid="foto-struk" />}</Kolom>
      <Kolom label={t.keterangan} lebar>{(id) => <input id={id} name="keterangan" required minLength={3} maxLength={300} placeholder={t.keteranganContoh} value={ket} onChange={(e) => setKet(e.target.value)} className={isian} />}</Kolom>
      {perjalanan.length > 0 && (
        <Kolom label={t.perjalanan} lebar>{(id) => (
          <select id={id} name="perjalanan" defaultValue="" className={isian}><option value="">{t.bukanDinas}</option>{perjalanan.map((p) => <option key={p.id} value={p.id}>{p.tujuan}</option>)}</select>)}</Kolom>
      )}
      <div className="col-span-2 flex flex-col items-start gap-2"><Tombol type="submit" disabled={sibuk || membaca}>{sibuk ? t.mengirim : t.ajukan}</Tombol><Hasil h={h} /></div>
    </form>
  );
}

/** Tarif uang harian per kota tujuan perjalanan dinas; '*' = kota lain; nominal kosong = matikan tarif kota itu. */
export function FormUangHarian({ teks: t }: { teks: T }) {
  const [h, aksi, sibuk] = useActionState<HasilKlaim, FormData>(aturUangHarian, null);
  return (
    <form action={aksi} className="mt-3 grid grid-cols-2 gap-3 text-sm" aria-label={t.uangHarianAria}>
      <Kolom label={t.uangHarianKota}>{(id) => <input id={id} name="kota" required maxLength={60} placeholder={t.uangHarianKotaContoh} className={isian} />}</Kolom>
      <Kolom label={t.uangHarianNominal}>{(id) => <input id={id} name="nominal" inputMode="numeric" placeholder="350.000" className={isian} />}</Kolom>
      <div className="col-span-2 flex flex-col items-start gap-2"><Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.uangHarianSimpan}</Tombol><Hasil h={h} /></div>
    </form>
  );
}

export function FormDinas({ hari, kunci, teks: t }: { hari: string; kunci: string; teks: T }) {
  const [h, aksi, sibuk] = useActionState<HasilKlaim, FormData>(ajukanDinas, null);
  return (
    <form action={aksi} className="mt-3 grid grid-cols-2 gap-3 text-sm" aria-label={t.dinasAria}>
      <input type="hidden" name="kunci" value={kunci} />
      <Kolom label={t.tujuan}>{(id) => <input id={id} name="tujuan" required minLength={2} maxLength={120} className={isian} />}</Kolom>
      <Kolom label={t.uangMuka}>{(id) => <input id={id} name="uang_muka" inputMode="numeric" defaultValue="0" className={isian} />}</Kolom>
      <Kolom label={t.mulai}>{(id) => <input id={id} type="date" name="mulai" required defaultValue={hari} className={isian} />}</Kolom>
      <Kolom label={t.selesai}>{(id) => <input id={id} type="date" name="selesai" required defaultValue={hari} className={isian} />}</Kolom>
      <Kolom label={t.keperluan} lebar>{(id) => <input id={id} name="keperluan" required minLength={3} maxLength={300} className={isian} />}</Kolom>
      <div className="col-span-2 flex flex-col items-start gap-2"><Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.ajukanDinas}</Tombol><Hasil h={h} /></div>
    </form>
  );
}

export function FormKategori({ teks: t }: { teks: T }) {
  const [h, aksi, sibuk] = useActionState<HasilKlaim, FormData>(simpanKategori, null);
  return (
    <form action={aksi} className="mt-3 grid grid-cols-2 gap-3 text-sm" aria-label={t.kategoriAria}>
      <Kolom label={t.namaKategori}>{(id) => <input id={id} name="nama" required minLength={2} maxLength={60} placeholder={t.namaContoh} className={isian} />}</Kolom>
      <Kolom label={t.batas}>{(id) => <input id={id} name="batas" inputMode="numeric" placeholder={t.batasContoh} className={isian} />}</Kolom>
      <Kolom label={t.akun}>{(id) => <input id={id} name="akun" pattern="6-[0-9]{3}" placeholder="6-900" className={isian} />}</Kolom>
      <label className="flex items-center gap-2 self-end pb-2"><input type="checkbox" name="butuh_struk" defaultChecked className="size-5" /><span>{t.butuhStruk}</span></label>
      <div className="col-span-2 flex flex-col items-start gap-2"><Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.simpanKategori}</Tombol><Hasil h={h} /></div>
    </form>
  );
}

function Aksi({ aksi: fn, nama, nilai, cara, label, teks }: { aksi: typeof bayarKlaim; nama: string; nilai: string; cara?: string; label: string; teks: string }) {
  const [h, aksi, sibuk] = useActionState<HasilKlaim, FormData>(fn, null);
  return (
    <form action={aksi} className="inline">
      <input type="hidden" name={nama} value={nilai} />{cara && <input type="hidden" name="cara" value={cara} />}
      <Tombol type="submit" ragam="kedua" disabled={sibuk} aria-label={label}>{teks}</Tombol>
      <Hasil h={h} />
    </form>
  );
}
export const TombolBayar = ({ klaim, cara, label, teks }: { klaim: string; cara: "kas" | "bank"; label: string; teks: string }) => <Aksi aksi={bayarKlaim} nama="klaim" nilai={klaim} cara={cara} label={label} teks={teks} />;
export const TombolUangMuka = ({ dinas, label, teks }: { dinas: string; label: string; teks: string }) => <Aksi aksi={bayarUangMuka} nama="dinas" nilai={dinas} cara="bank" label={label} teks={teks} />;
export const TombolSelesai = ({ dinas, label, teks }: { dinas: string; label: string; teks: string }) => <Aksi aksi={selesaikanDinas} nama="dinas" nilai={dinas} label={label} teks={teks} />;
