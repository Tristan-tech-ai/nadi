"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { arsipkanCatatan, pindahStatus, simpanCatatan, type HasilMod } from "@/app/app/mod/actions";
import { Tombol } from "@/components/ui/tombol";
import type { Bidang } from "@/lib/mod/skema";

// X-05: formulir dan tombol penafsir mod. Semua label dan nilai dari manifest atau catatan dirender sebagai teks React biasa
// (tidak ada dangerouslySetInnerHTML), jadi isi manifest tidak bisa menyisipkan markup atau skrip.
export type Opsi = { v: string; l: string }[];
export type IsianAwal = Record<string, string | string[] | boolean>;
type Dasar = { modId: string; koleksi: string; slug: string };

const isian = "h-10 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";
const BISA_DIISI = (b: Bidang) => b.tipe !== "rumus" && b.tipe !== "berkas";

function Hasil({ h, tautan }: { h: HasilMod; tautan?: string }) {
  if (!h) return null;
  if ("galat" in h) return <p role="alert" className="w-full text-sm text-cap">{h.galat}</p>;
  return (
    <p role="status" className="w-full text-sm text-daun">
      {h.pesan} {tautan && h.id && <Link href={`${tautan}&id=${h.id}`} className="underline underline-offset-4">Buka catatan</Link>}
    </p>
  );
}

function Isian({ b, awal, opsi, id }: { b: Bidang; awal?: string | string[] | boolean; opsi?: Opsi; id: string }) {
  const nama = b.kode;
  const teks = typeof awal === "string" ? awal : "";
  const daftar = Array.isArray(awal) ? awal : typeof awal === "string" && awal ? [awal] : [];
  const label = <span className="text-tinta-2">{b.label}{b.wajib && <span aria-hidden> *</span>}</span>;
  if (b.tipe === "pilihan_banyak" || (b.tipe === "orang" && b.banyak)) {
    const pilihan = b.tipe === "orang" ? (opsi ?? []) : (b.pilihan ?? []).map((p) => ({ v: p.kode, l: p.label }));
    return (
      <fieldset className="flex min-w-0 flex-col gap-1">
        <legend className="mb-1 text-tinta-2">{b.label}{b.wajib && <span aria-hidden> *</span>}</legend>
        {pilihan.length === 0 ? <p className="text-tinta-2">Belum ada pilihan. {b.tipe === "orang" ? "Tambah orang dulu di halaman Orang." : ""}</p>
          : <div className="flex max-h-40 flex-wrap gap-x-4 gap-y-1 overflow-y-auto">{pilihan.map((p) => (
            <label key={p.v} className="inline-flex min-h-8 items-center gap-2"><input type="checkbox" name={nama} value={p.v} defaultChecked={daftar.includes(p.v)} className="size-4" /><span data-pengguna>{p.l}</span></label>
          ))}</div>}
      </fieldset>
    );
  }
  if (b.tipe === "centang") {
    return <label className="inline-flex min-h-10 items-center gap-2"><input id={id} type="checkbox" name={nama} value="ya" defaultChecked={awal === true} className="size-4" />{label}</label>;
  }
  let kontrol: React.ReactNode;
  switch (b.tipe) {
    case "teks_panjang":
      kontrol = <textarea id={id} name={nama} defaultValue={teks} required={b.wajib} maxLength={5000} rows={3} className="w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas p-2 text-base" />;
      break;
    case "pilihan": case "orang": case "pelanggan": case "produk": case "proyek": case "rujukan": {
      const pilihan = b.tipe === "pilihan" ? (b.pilihan ?? []).map((p) => ({ v: p.kode, l: p.label })) : (opsi ?? []);
      kontrol = (
        <select id={id} name={nama} defaultValue={teks} required={b.wajib} className={isian}>
          <option value="">{b.wajib ? "Pilih" : "Kosong"}</option>
          {pilihan.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
        </select>
      );
      // Q-48: daftar inti kosong (mis. belum ada pelanggan) diberi jalan keluar, bukan isian wajib yang buntu.
      const kosong = pilihan.length === 0 ? KOSONG_INTI[b.tipe as keyof typeof KOSONG_INTI] : undefined;
      if (kosong) kontrol = <>{kontrol}<p className="text-xs text-tinta-2" data-testid="mod-pilihan-kosong">{kosong.teks} <a href={kosong.href} className="font-semibold text-laut underline underline-offset-4">{kosong.tautan}</a></p></>;
      break;
    }
    default: {
      const tipe = { angka: "text", rupiah: "text", tanggal: "date", tanggal_jam: "datetime-local", tautan: "url", telepon: "tel" }[b.tipe as string] ?? "text";
      const mode = b.tipe === "angka" ? "decimal" : b.tipe === "rupiah" ? "numeric" : undefined;
      kontrol = <input id={id} name={nama} type={tipe} inputMode={mode} defaultValue={teks} required={b.wajib} maxLength={b.tipe === "tautan" ? 2000 : 500}
        placeholder={b.tipe === "tautan" ? "https://" : undefined} className={`${isian}${b.tipe === "angka" || b.tipe === "rupiah" ? " angka" : ""}`} />;
    }
  }
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id}>{label}</label>
      {kontrol}
      {b.petunjuk && <p className="text-xs text-tinta-2" data-pengguna>{b.petunjuk}</p>}
    </div>
  );
}

const KOSONG_INTI = {
  orang: { teks: "Belum ada orang di usaha ini.", href: "/app/orang", tautan: "Tambah orang" },
  pelanggan: { teks: "Belum ada pelanggan tercatat. Nama di invoice belum otomatis menjadi pelanggan.", href: "/app/pelanggan", tautan: "Tambah pelanggan" },
  produk: { teks: "Belum ada produk.", href: "/app/barang", tautan: "Tambah produk" },
  proyek: { teks: "Belum ada proyek.", href: "/app/proyek", tautan: "Buat proyek" },
} as const;

/** Formulir buat atau ubah satu catatan. `bidang` sudah dari manifest; server membaca ulang manifest saat menyimpan. */
export function FormCatatan({ dasar, bidang, awal = {}, opsi, id, label, tautan }: {
  dasar: Dasar; bidang: Bidang[]; awal?: IsianAwal; opsi: Record<string, Opsi>; id?: string; label: string; tautan?: string;
}) {
  const [h, aksi, sibuk] = useActionState<HasilMod, FormData>(simpanCatatan, null);
  const awalan = useId();
  const isi = bidang.filter(BISA_DIISI);
  return (
    <form action={aksi} aria-label={label} className="grid gap-3 text-sm sm:grid-cols-2" key={!id && h && "pesan" in h ? h.id : "f"}>
      <input type="hidden" name="mod" value={dasar.modId} />
      <input type="hidden" name="koleksi" value={dasar.koleksi} />
      <input type="hidden" name="bidang" value={isi.map((b) => b.kode).join(",")} />
      {id && <input type="hidden" name="id" value={id} />}
      {isi.map((b) => (
        <div key={b.kode} className={b.tipe === "teks_panjang" || b.tipe === "pilihan_banyak" || (b.tipe === "orang" && b.banyak) ? "sm:col-span-2" : ""}>
          <Isian b={b} awal={awal[b.kode]} opsi={opsi[b.kode]} id={`${awalan}-${b.kode}`} />
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Tombol type="submit" disabled={sibuk}>{sibuk ? "Menyimpan..." : label}</Tombol>
        <Hasil h={h} tautan={id ? undefined : tautan} />
      </div>
    </form>
  );
}

export type TransisiTampil = { ke: string; label: string; wajib: Bidang[] };

function SatuTransisi({ dasar, id, t, awal, opsi }: { dasar: Dasar; id: string; t: TransisiTampil; awal: IsianAwal; opsi: Record<string, Opsi> }) {
  const [h, aksi, sibuk] = useActionState<HasilMod, FormData>(pindahStatus, null);
  const awalan = useId();
  const isi = t.wajib.filter(BISA_DIISI);
  const badan = (
    <>
      <input type="hidden" name="mod" value={dasar.modId} />
      <input type="hidden" name="koleksi" value={dasar.koleksi} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="ke" value={t.ke} />
      {isi.length > 0 && <input type="hidden" name="bidang" value={isi.map((b) => b.kode).join(",")} />}
      {isi.map((b) => <Isian key={b.kode} b={{ ...b, wajib: true }} awal={awal[b.kode]} opsi={opsi[b.kode]} id={`${awalan}-${b.kode}`} />)}
      <Tombol type="submit" ragam="kedua" disabled={sibuk} data-ke={t.ke}>{sibuk ? "Memproses..." : t.label}</Tombol>
      <Hasil h={h} />
    </>
  );
  if (!isi.length) return <form action={aksi} className="flex flex-wrap items-center gap-2" aria-label={t.label}>{badan}</form>;
  return (
    <details className="w-full rounded-[var(--radius-kartu)] border border-garis p-3">
      <summary className="cursor-pointer font-semibold" data-ke={t.ke}>{t.label}</summary>
      <form action={aksi} className="mt-3 grid gap-3" aria-label={t.label}>{badan}</form>
    </details>
  );
}

/** Tombol perpindahan status yang boleh untuk peran ini; transisi yang mewajibkan isian membuka isian itu dulu. */
export function TombolStatus({ dasar, id, transisi, awal = {}, opsi = {} }: { dasar: Dasar; id: string; transisi: TransisiTampil[]; awal?: IsianAwal; opsi?: Record<string, Opsi> }) {
  if (!transisi.length) return null;
  return <div className="flex flex-wrap items-start gap-2" data-testid="transisi">{transisi.map((t) => <SatuTransisi key={t.ke} dasar={dasar} id={id} t={t} awal={awal} opsi={opsi} />)}</div>;
}

export function TombolArsip({ dasar, id }: { dasar: Dasar; id: string }) {
  const [h, aksi, sibuk] = useActionState<HasilMod, FormData>(arsipkanCatatan, null);
  return (
    <form action={aksi} className="flex flex-wrap items-center gap-2" aria-label="Arsipkan catatan">
      <input type="hidden" name="mod" value={dasar.modId} />
      <input type="hidden" name="koleksi" value={dasar.koleksi} />
      <input type="hidden" name="id" value={id} />
      <Tombol type="submit" ragam="bahaya" disabled={sibuk || (!!h && "pesan" in h)}>Arsipkan</Tombol>
      <Hasil h={h} />
    </form>
  );
}
