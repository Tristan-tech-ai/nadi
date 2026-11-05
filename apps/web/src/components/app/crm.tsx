"use client";

import { useActionState, useId, useState, type ReactNode } from "react";
import { catatAktivitas, penawaranDeal, pindahDeal, selesaiTugas, simpanDeal, simpanPelanggan, simpanTarget, type HasilCrm } from "@/app/app/pelanggan/actions";
import { Tombol } from "@/components/ui/tombol";
import { SEMUA_TAHAP } from "@/lib/crm";
import type { Kamus } from "@/lib/i18n/kamus";

type T = Kamus["crm"];
type Tahap = keyof T["tahap"];
const isian = "h-10 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";

function Hasil({ h }: { h: HasilCrm }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="w-full text-sm text-cap">{h.galat}</p> : <p role="status" className="w-full text-sm text-daun">{h.pesan}</p>;
}

function Kolom({ label, children, lebar }: { label: string; children: (id: string) => ReactNode; lebar?: boolean }) {
  const id = useId();
  return <div className={`flex flex-col gap-1 ${lebar ? "col-span-2" : ""}`}><label htmlFor={id} className="text-tinta-2">{label}</label>{children(id)}</div>;
}

function Formulir({ aksi, label, tombol, children, ragam = "kedua", sibukLuar }: { aksi: (a: HasilCrm, f: FormData) => Promise<HasilCrm>; label: string; tombol: string; children?: ReactNode; ragam?: "utama" | "kedua"; sibukLuar?: boolean }) {
  const [h, kirim, sibuk] = useActionState<HasilCrm, FormData>(aksi, null);
  return (
    <form action={kirim} className="mt-3 grid grid-cols-2 gap-3 text-sm" aria-label={label}>
      {children}
      <div className="col-span-2 flex flex-col items-start gap-2"><Tombol type="submit" ragam={ragam} disabled={sibuk || sibukLuar}>{tombol}</Tombol><Hasil h={h} /></div>
    </form>
  );
}

export function FormPelanggan({ perusahaan, teks: t }: { perusahaan: { id: string; nama: string }[]; teks: T }) {
  return (
    <Formulir aksi={simpanPelanggan} label={t.pelangganJudul} tombol={t.simpanPelanggan}>
      <Kolom label={t.nama} lebar>{(id) => <input id={id} name="nama" required minLength={2} maxLength={100} placeholder={t.contohNama} className={isian} />}</Kolom>
      <Kolom label={t.jenisPelanggan}>{(id) => <select id={id} name="jenis" defaultValue="perusahaan" className={isian}><option value="perusahaan">{t.jenisPelangganNama.perusahaan}</option><option value="orang">{t.jenisPelangganNama.orang}</option></select>}</Kolom>
      <Kolom label={t.induk}>{(id) => <select id={id} name="induk" defaultValue="" className={isian}><option value="">{t.tanpaInduk}</option>{perusahaan.map((p) => <option key={p.id} value={p.id} data-pengguna>{p.nama}</option>)}</select>}</Kolom>
      <Kolom label={t.hp}>{(id) => <input id={id} name="hp" inputMode="tel" placeholder="0812-3456-7890" className={isian} />}</Kolom>
      <Kolom label={t.kota}>{(id) => <input id={id} name="kota" maxLength={60} className={isian} />}</Kolom>
      <Kolom label={t.email}>{(id) => <input id={id} name="email" type="email" className={isian} />}</Kolom>
      <Kolom label={t.segmen}>{(id) => <input id={id} name="segmen" maxLength={40} placeholder={t.contohSegmen} className={isian} />}</Kolom>
    </Formulir>
  );
}

export function FormDeal({ pelanggan, orang, teks: t }: { pelanggan: { id: string; nama: string }[]; orang: { id: string; nama: string }[]; teks: T }) {
  return (
    <Formulir aksi={simpanDeal} label={t.dealJudul} tombol={t.simpanDeal}>
      <Kolom label={t.pelanggan} lebar>{(id) => <select id={id} name="pelanggan" required defaultValue="" className={isian}><option value="" disabled>{t.pilihPelanggan}</option>{pelanggan.map((p) => <option key={p.id} value={p.id} data-pengguna>{p.nama}</option>)}</select>}</Kolom>
      <Kolom label={t.judulDeal} lebar>{(id) => <input id={id} name="judul" required minLength={3} maxLength={120} placeholder={t.contohDeal} className={isian} />}</Kolom>
      <Kolom label={t.nilai}>{(id) => <input id={id} name="nilai" inputMode="numeric" required placeholder="15.000.000" className={`${isian} angka`} />}</Kolom>
      <Kolom label={t.perkiraan}>{(id) => <input id={id} type="date" name="tutup" className={isian} />}</Kolom>
      <Kolom label={t.sales} lebar>{(id) => <select id={id} name="sales" defaultValue="" className={isian}><option value="">{t.tanpaSales}</option>{orang.map((o) => <option key={o.id} value={o.id} data-pengguna>{o.nama}</option>)}</select>}</Kolom>
    </Formulir>
  );
}

export function FormPindah({ deal, tahap, judul, teks: t }: { deal: string; tahap: Tahap; judul: string; teks: T }) {
  const [ke, setKe] = useState<Tahap>(tahap);
  return (
    <Formulir aksi={pindahDeal} label={`${t.pindah}: ${judul}`} tombol={t.pindah}>
      <input type="hidden" name="deal" value={deal} />
      <Kolom label={t.ke} lebar={ke !== "kalah"}>{(id) => <select id={id} name="tahap" value={ke} onChange={(e) => setKe(e.target.value as Tahap)} className={isian}>{SEMUA_TAHAP.map((x) => <option key={x} value={x}>{t.tahap[x]}</option>)}</select>}</Kolom>
      {ke === "kalah" && <Kolom label={t.alasan}>{(id) => <input id={id} name="alasan" required minLength={3} maxLength={300} placeholder={t.contohAlasan} className={isian} />}</Kolom>}
    </Formulir>
  );
}

export function FormPenawaran({ deal, judul, hari, kunci, teks: t }: { deal: string; judul: string; hari: string; kunci: string; teks: T }) {
  return (
    <Formulir aksi={penawaranDeal} label={`${t.buatPenawaran}: ${judul}`} tombol={t.buatPenawaran} ragam="utama">
      <input type="hidden" name="deal" value={deal} /><input type="hidden" name="kunci" value={kunci} />
      <Kolom label={t.uraian} lebar>{(id) => <input id={id} name="uraian" required maxLength={120} defaultValue={judul} className={isian} />}</Kolom>
      <Kolom label={t.jumlah}>{(id) => <input id={id} name="jumlah" inputMode="decimal" required defaultValue="1" className={`${isian} angka`} />}</Kolom>
      <Kolom label={t.harga}>{(id) => <input id={id} name="harga" inputMode="numeric" required className={`${isian} angka`} />}</Kolom>
      <Kolom label={t.berlaku} lebar>{(id) => <input id={id} type="date" name="berlaku" min={hari} className={isian} />}</Kolom>
    </Formulir>
  );
}

/** Aktivitas deal. Kunjungan: lokasi diambil sekali dari perangkat hanya bila kotak izin dicentang (UU 27/2022 Pasal 20). */
export function FormAktivitas({ deal, judul, hari, teks: t }: { deal: string; judul: string; hari: string; teks: T }) {
  const [jenis, setJenis] = useState<"catatan" | "tugas" | "kunjungan">("catatan");
  const [info, setInfo] = useState("");
  const [ambil, setAmbil] = useState(false);
  const aksi = async (sebelum: HasilCrm, f: FormData): Promise<HasilCrm> => {
    if (f.get("jenis") === "kunjungan" && f.get("izin_lokasi") === "ya" && "geolocation" in navigator) {
      setAmbil(true);
      setInfo(t.mengambilLokasi);
      const p = await new Promise<GeolocationPosition | null>((ok) => navigator.geolocation.getCurrentPosition(ok, () => ok(null), { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }));
      setAmbil(false);
      setInfo(p ? "" : t.lokasiGagal);
      if (p) {
        f.set("lat", String(p.coords.latitude));
        f.set("lng", String(p.coords.longitude));
        f.set("akurasi", String(Math.round(p.coords.accuracy)));
      } else f.delete("izin_lokasi");
    }
    return catatAktivitas(sebelum, f);
  };
  return (
    <Formulir aksi={aksi} label={`${t.aktivitas}: ${judul}`} tombol={t.simpanAktivitas} sibukLuar={ambil}>
      <input type="hidden" name="deal" value={deal} />
      <Kolom label={t.jenis}>{(id) => <select id={id} name="jenis" value={jenis} onChange={(e) => setJenis(e.target.value as typeof jenis)} className={isian}>{(["catatan", "tugas", "kunjungan"] as const).map((j) => <option key={j} value={j}>{t.jenisNama[j]}</option>)}</select>}</Kolom>
      {jenis === "tugas" ? <Kolom label={t.jatuhTempo}>{(id) => <input id={id} type="date" name="jatuh" required min={hari} className={isian} />}</Kolom> : <div />}
      <Kolom label={t.isi} lebar>{(id) => <input id={id} name="isi" required minLength={2} maxLength={500} placeholder={t.contohIsi} className={isian} />}</Kolom>
      {jenis === "kunjungan" && (
        <div className="col-span-2">
          <label className="flex items-start gap-2"><input type="checkbox" name="izin_lokasi" value="ya" className="mt-0.5 h-5 w-5" /><span>{t.lokasi}</span></label>
          <p className="mt-1 text-xs text-tinta-2">{t.lokasiKet}</p>
          {info && <p className="mt-1 text-xs text-tinta-2" role="status">{info}</p>}
        </div>
      )}
    </Formulir>
  );
}

export function TombolSelesai({ id, label, teks }: { id: string; label: string; teks: string }) {
  const [h, kirim, sibuk] = useActionState<HasilCrm, FormData>(selesaiTugas, null);
  return (
    <form action={kirim} className="inline-flex flex-col items-start" aria-label={label}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={sibuk} aria-label={label} className="text-sm font-semibold text-laut underline underline-offset-2">{teks}</button>
      <Hasil h={h} />
    </form>
  );
}

export function FormTarget({ orang, bulan, teks: t }: { orang: { id: string; nama: string }[]; bulan: string; teks: T }) {
  return (
    <Formulir aksi={simpanTarget} label={t.targetJudul} tombol={t.simpanTarget}>
      <input type="hidden" name="bulan" value={bulan} />
      <Kolom label={t.sales}>{(id) => <select id={id} name="orang" required defaultValue="" className={isian}><option value="" disabled>{t.pilihOrang}</option>{orang.map((o) => <option key={o.id} value={o.id} data-pengguna>{o.nama}</option>)}</select>}</Kolom>
      <Kolom label={t.targetNominal}>{(id) => <input id={id} name="nominal" inputMode="numeric" required placeholder="20.000.000" className={`${isian} angka`} />}</Kolom>
    </Formulir>
  );
}
