"use client";

import { useActionState, useId, useMemo, useState, type ReactNode } from "react";
import {
  aturBerulang, catatAntarusaha, jalankanBerulang, lunasiEkspor, revaluasi, simpanAnggaran, simpanAturanTag, simpanBerulang, simpanDimensi, simpanKurs,
  terapkanAturan, type HasilLanjut,
} from "@/app/app/buku/lanjut/actions";
import { Tombol } from "@/components/ui/tombol";
import { angkaValuta, keRupiah, type Kurs } from "@/lib/buku/lanjut";
import { formatRupiah } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";

type T = Kamus["bukuLanjut"];
type Akun = { kode: string; nama: string };
type Dimensi = { id: string; jenis: "cabang" | "proyek"; nama: string };
const isian = "h-10 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";

function Hasil({ h }: { h: HasilLanjut }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="w-full text-sm text-cap">{h.galat}</p> : <p role="status" className="w-full text-sm text-daun">{h.pesan}</p>;
}

function Kolom({ label, children, lebar }: { label: string; children: (id: string) => ReactNode; lebar?: boolean }) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-1 ${lebar ? "col-span-2" : ""}`}>
      <label htmlFor={id} className="text-tinta-2">{label}</label>
      {children(id)}
    </div>
  );
}

function Formulir({ aksi, label, children, tombol, ragam = "kedua" }: { aksi: (a: HasilLanjut, f: FormData) => Promise<HasilLanjut>; label: string; children?: ReactNode; tombol: string; ragam?: "utama" | "kedua" }) {
  const [h, kirim, sibuk] = useActionState<HasilLanjut, FormData>(aksi, null);
  return (
    <form action={kirim} className="mt-3 grid grid-cols-2 gap-3 text-sm" aria-label={label}>
      {children}
      <div className="col-span-2 flex flex-col items-start gap-2"><Tombol type="submit" ragam={ragam} disabled={sibuk}>{tombol}</Tombol><Hasil h={h} /></div>
    </form>
  );
}

const PilihAkun = ({ akun, name, t, id }: { akun: Akun[]; name: string; t: T; id: string }) => (
  <select id={id} name={name} required defaultValue="" className={isian}>
    <option value="" disabled>{t.pilihAkun}</option>
    {akun.map((a) => <option key={a.kode} value={a.kode} data-pengguna>{a.kode} {a.nama}</option>)}
  </select>
);

export function FormAnggaran({ akun, bulan, teks: t }: { akun: Akun[]; bulan: string; teks: T }) {
  return (
    <Formulir aksi={simpanAnggaran} label={t.anggaranJudul} tombol={t.simpanAnggaran}>
      <Kolom label={t.akun} lebar>{(id) => <PilihAkun akun={akun} name="akun" t={t} id={id} />}</Kolom>
      <Kolom label={t.bulanDari}>{(id) => <input id={id} type="month" name="dari" required defaultValue={bulan} className={isian} />}</Kolom>
      <Kolom label={t.bulanSampai}>{(id) => <input id={id} type="month" name="sampai" className={isian} />}</Kolom>
      <Kolom label={t.nominal}>{(id) => <input id={id} name="nominal" inputMode="numeric" required placeholder="1.500.000" className={`${isian} angka`} />}</Kolom>
    </Formulir>
  );
}

export function FormDimensi({ teks: t }: { teks: T }) {
  return (
    <Formulir aksi={simpanDimensi} label={t.dimensiJudul} tombol={t.tambahDimensi}>
      <Kolom label={t.jenis}>{(id) => <select id={id} name="jenis" defaultValue="cabang" className={isian}><option value="cabang">{t.jenisNama.cabang}</option><option value="proyek">{t.jenisNama.proyek}</option></select>}</Kolom>
      <Kolom label={t.namaDimensi}>{(id) => <input id={id} name="nama" required minLength={2} maxLength={60} placeholder={t.contohDimensi} className={isian} />}</Kolom>
    </Formulir>
  );
}

const PilihDimensi = ({ dimensi, t, id, wajib }: { dimensi: Dimensi[]; t: T; id: string; wajib?: boolean }) => (
  <select id={id} name="dimensi" required={wajib} defaultValue="" className={isian}>
    <option value="" disabled={wajib}>{wajib ? t.filterDimensi : t.tanpaDimensi}</option>
    {dimensi.map((d) => <option key={d.id} value={d.id} data-pengguna>{t.jenisNama[d.jenis]}: {d.nama}</option>)}
  </select>
);

export function FormAturan({ dimensi, dari, sampai, teks: t }: { dimensi: Dimensi[]; dari: string; sampai: string; teks: T }) {
  return (
    <>
      <Formulir aksi={simpanAturanTag} label={t.aturanJudul} tombol={t.simpanAturan}>
        <Kolom label={t.filterDimensi}>{(id) => <PilihDimensi dimensi={dimensi} t={t} id={id} wajib />}</Kolom>
        <Kolom label={t.kata}>{(id) => <input id={id} name="kata" required minLength={2} maxLength={60} placeholder={t.contohKata} className={isian} />}</Kolom>
      </Formulir>
      <Formulir aksi={terapkanAturan} label={t.terapkan} tombol={t.terapkan}>
        <input type="hidden" name="dari" value={dari} /><input type="hidden" name="sampai" value={sampai} />
      </Formulir>
    </>
  );
}

export function FormBerulang({ akun, dimensi, hari, teks: t }: { akun: Akun[]; dimensi: Dimensi[]; hari: string; teks: T }) {
  return (
    <Formulir aksi={simpanBerulang} label={t.berulangJudul} tombol={t.simpanBerulang}>
      <Kolom label={t.namaBerulang} lebar>{(id) => <input id={id} name="nama" required minLength={3} maxLength={80} placeholder={t.contohBerulang} className={isian} />}</Kolom>
      <Kolom label={t.tiap}>{(id) => <select id={id} name="tiap" defaultValue="bulan" className={isian}><option value="bulan">{t.tiapNama.bulan}</option><option value="minggu">{t.tiapNama.minggu}</option></select>}</Kolom>
      <Kolom label={t.jumlah}>{(id) => <input id={id} name="jumlah" inputMode="numeric" required placeholder="1.500.000" className={`${isian} angka`} />}</Kolom>
      <Kolom label={t.mulai}>{(id) => <input id={id} type="date" name="mulai" required defaultValue={hari} className={isian} />}</Kolom>
      <Kolom label={t.selesai}>{(id) => <input id={id} type="date" name="selesai" className={isian} />}</Kolom>
      <Kolom label={t.akunDebit} lebar>{(id) => <PilihAkun akun={akun} name="debit" t={t} id={id} />}</Kolom>
      <Kolom label={t.akunKredit} lebar>{(id) => <PilihAkun akun={akun} name="kredit" t={t} id={id} />}</Kolom>
      {dimensi.length > 0 && <Kolom label={t.dimensiOpsional} lebar>{(id) => <PilihDimensi dimensi={dimensi} t={t} id={id} />}</Kolom>}
    </Formulir>
  );
}

export function TombolJalankan({ teks: t }: { teks: T }) {
  return <Formulir aksi={jalankanBerulang} label={t.jalankan} tombol={t.jalankan} />;
}

export function TombolAktif({ id, aktif, label, teks }: { id: string; aktif: boolean; label: string; teks: string }) {
  const [h, kirim, sibuk] = useActionState<HasilLanjut, FormData>(aturBerulang, null);
  return (
    <form action={kirim} className="flex flex-col items-start gap-1" aria-label={label}>
      <input type="hidden" name="id" value={id} /><input type="hidden" name="aktif" value={aktif ? "ya" : "tidak"} />
      <Tombol type="submit" ragam="kedua" disabled={sibuk} aria-label={label}>{teks}</Tombol>
      <Hasil h={h} />
    </form>
  );
}

/** Kalkulator kurs di perangkat: kurs berlaku hari ini dikirim server, hitungan tidak memanggil apa pun. */
export function KalkulatorKurs({ kurs, bahasa, teks: t }: { kurs: Kurs[]; bahasa: Bahasa; teks: T }) {
  const [valuta, setValuta] = useState(kurs[0]?.valuta ?? "");
  const [jumlah, setJumlah] = useState("1");
  const k = kurs.find((x) => x.valuta === valuta);
  const rp = useMemo(() => {
    const n = angkaValuta(jumlah);
    return k && n !== null ? keRupiah(n, k) : null;
  }, [jumlah, k]);
  const idV = useId();
  const idJ = useId();
  if (!kurs.length) return <p className="mt-2 text-sm text-tinta-2">{t.kursTidakAda}</p>;
  return (
    <div className="mt-3 grid grid-cols-2 gap-3 text-sm" data-testid="kalkulator-kurs">
      <div className="flex flex-col gap-1"><label htmlFor={idV} className="text-tinta-2">{t.valuta}</label>
        <select id={idV} value={valuta} onChange={(e) => setValuta(e.target.value)} className={isian}>{kurs.map((x) => <option key={x.valuta} value={x.valuta}>{x.valuta}</option>)}</select></div>
      <div className="flex flex-col gap-1"><label htmlFor={idJ} className="text-tinta-2">{t.jumlahValuta}</label>
        <input id={idJ} value={jumlah} inputMode="decimal" onChange={(e) => setJumlah(e.target.value)} className={`${isian} angka`} /></div>
      <p className="col-span-2 text-base"><span className="text-tinta-2">{t.hasil}: </span><output className="angka font-semibold" data-testid="hasil-kurs">{rp === null ? "-" : formatRupiah(rp, { bahasa })}</output></p>
      {k && <p className="col-span-2 text-xs text-tinta-2">{isiTeks(t.sumberKurs, { kurs: k.kurs.toLocaleString(bahasa === "en" ? "en-US" : "id-ID"), per: k.per, v: k.valuta, sumber: k.sumber, tanggal: k.berlaku_dari })}</p>}
    </div>
  );
}

export function FormKurs({ hari, teks: t }: { hari: string; teks: T }) {
  return (
    <Formulir aksi={simpanKurs} label={t.kursUsaha} tombol={t.simpanKurs}>
      <Kolom label={t.valuta}>{(id) => <input id={id} name="valuta" required maxLength={3} placeholder="USD" className={`${isian} uppercase`} />}</Kolom>
      <Kolom label={t.tanggalKurs}>{(id) => <input id={id} type="date" name="tanggal" required max={hari} defaultValue={hari} className={isian} />}</Kolom>
      <Kolom label={t.kurs}>{(id) => <input id={id} name="kurs" inputMode="decimal" required placeholder="18.141" className={`${isian} angka`} />}</Kolom>
      <Kolom label={t.sumber}>{(id) => <input id={id} name="sumber" required minLength={3} maxLength={160} placeholder={t.contohSumber} className={isian} />}</Kolom>
    </Formulir>
  );
}

export function FormRevaluasi({ hari, kursUsd, teks: t }: { hari: string; kursUsd: string; teks: T }) {
  return (
    <Formulir aksi={revaluasi} label={t.revaluasiJudul} tombol={t.revaluasi}>
      <Kolom label={t.tanggalRevaluasi}>{(id) => <input id={id} type="date" name="tanggal" required max={hari} defaultValue={hari} className={isian} />}</Kolom>
      <Kolom label={t.kursUsd}>{(id) => <input id={id} name="kurs" inputMode="decimal" required defaultValue={kursUsd} className={`${isian} angka`} />}</Kolom>
      <Kolom label={t.sumber} lebar>{(id) => <input id={id} name="sumber" required minLength={3} maxLength={160} placeholder={t.contohSumber} className={isian} />}</Kolom>
    </Formulir>
  );
}

export function FormLunasEkspor({ id: inv, nomor, hari, kursUsd, teks: t }: { id: string; nomor: string; hari: string; kursUsd: string; teks: T }) {
  return (
    <Formulir aksi={lunasiEkspor} label={`${t.lunasi} ${nomor}`} tombol={t.lunasi}>
      <input type="hidden" name="id" value={inv} />
      <Kolom label={t.tanggalBayar}>{(id) => <input id={id} type="date" name="tanggal" required max={hari} defaultValue={hari} className={isian} />}</Kolom>
      <Kolom label={t.kursBayar}>{(id) => <input id={id} name="kurs" inputMode="decimal" required defaultValue={kursUsd} className={`${isian} angka`} />}</Kolom>
      <Kolom label={t.sumber}>{(id) => <input id={id} name="sumber" required minLength={3} maxLength={160} placeholder={t.contohSumber} className={isian} />}</Kolom>
      <Kolom label={t.masukKe}>{(id) => <select id={id} name="akun" defaultValue="1-110" className={isian}><option value="1-110">{t.bank}</option><option value="1-100">{t.kas}</option></select>}</Kolom>
    </Formulir>
  );
}

export function FormAntarusaha({ mitra, hari, kunci, teks: t }: { mitra: { id: string; nama: string }[]; hari: string; kunci: string; teks: T }) {
  return (
    <Formulir aksi={catatAntarusaha} label={t.antarJudul} tombol={t.catatAntar}>
      <input type="hidden" name="kunci" value={kunci} />
      <Kolom label={t.mitra} lebar>{(id) => <select id={id} name="mitra" required defaultValue="" className={isian}><option value="" disabled>{t.mitra}</option>{mitra.map((m) => <option key={m.id} value={m.id} data-pengguna>{m.nama}</option>)}</select>}</Kolom>
      <Kolom label={t.jenisAntar} lebar>{(id) => (
        <select id={id} name="jenis" defaultValue="jual" className={isian}>
          {(["jual", "pinjam", "bayar"] as const).map((j) => <option key={j} value={j}>{t.jenisAntarNama[j]}</option>)}
        </select>)}</Kolom>
      <Kolom label={t.jumlah}>{(id) => <input id={id} name="nominal" inputMode="numeric" required placeholder="2.000.000" className={`${isian} angka`} />}</Kolom>
      <Kolom label={t.tanggal}>{(id) => <input id={id} type="date" name="tanggal" required max={hari} defaultValue={hari} className={isian} />}</Kolom>
      <Kolom label={t.keterangan} lebar>{(id) => <input id={id} name="keterangan" required minLength={3} maxLength={150} className={isian} />}</Kolom>
    </Formulir>
  );
}
