"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { simpanManifest, type HasilTambah } from "@/app/app/tambah-fitur/actions";
import { Tombol } from "@/components/ui/tombol";
import { periksaRancangan, susunManifest, TIPE_PEMBANGUN, type Rancangan, type RancanganIsian, type RancanganKoleksi } from "@/lib/mod/pembangun";
import { IKON_MOD, RUANG_MOD, type Akses } from "@/lib/mod/skema";

// X-16 pembangun fitur tambahan lewat formulir: rancangan disusun menjadi manifest di peramban (lib/mod/pembangun.ts), lalu dikirim
// ke jalur draf yang sama dengan Buat sendiri; server memeriksa ulang dengan pengawas dan menyimpannya sebagai draf.
const isian = "h-10 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";
const RUANG_NAMA: Record<string, string> = { "hari-ini": "Hari ini", uang: "Uang", jual: "Jual", barang: "Barang", orang: "Orang", tempat: "Tempat", dokumen: "Dokumen", otomasi: "Otomasi dan data" };
const AKSES_PILIH: { nilai: Akses; label: string }[] = [
  { nilai: "tidak", label: "Tidak melihat" }, { nilai: "lihat", label: "Hanya melihat" }, { nilai: "milik_sendiri", label: "Mengisi miliknya" }, { nilai: "tulis", label: "Mengisi semua" },
];
const isianBaru = (): RancanganIsian => ({ label: "", tipe: "teks", wajib: false, pilihan: "" });
const koleksiBaru = (): RancanganKoleksi => ({ nama: "", isian: [{ ...isianBaru(), wajib: true }], status: "", staf: "tulis", akuntan: "lihat" });

export function PembangunMod({ kodeSudah }: { kodeSudah: string[] }) {
  const [r, setR] = useState<Rancangan>({ nama: "", deskripsi: "", ikon: "daftar-cek", ruang: "otomasi", koleksi: [koleksiBaru()] });
  const [dicoba, setDicoba] = useState(false);
  const [h, kirim, sibuk] = useActionState<HasilTambah, FormData>(simpanManifest, null);
  const id = useId();
  const ubahK = (i: number, k: Partial<RancanganKoleksi>) => setR({ ...r, koleksi: r.koleksi.map((x, j) => (j === i ? { ...x, ...k } : x)) });
  const ubahI = (i: number, n: number, v: Partial<RancanganIsian>) => ubahK(i, { isian: r.koleksi[i].isian.map((x, j) => (j === n ? { ...x, ...v } : x)) });
  const masalah = periksaRancangan(r);
  const manifest = masalah.length ? null : susunManifest(r, kodeSudah);

  if (h && "pesan" in h) {
    return (
      <div role="status" className="rounded-[var(--radius-kartu)] border border-daun p-4 text-sm" data-testid="pembangun-tersimpan">
        <p className="font-semibold">Draf {r.nama} tersimpan dan lolos pemeriksaan.</p>
        <p className="mt-1 text-tinta-2">Fitur belum aktif. Terapkan dari daftar draf di Tambah fitur.</p>
        <Link href="/app/tambah-fitur" className="mt-2 inline-block font-semibold underline underline-offset-4">Buka draf di Tambah fitur</Link>
      </div>
    );
  }
  return (
    <form action={kirim} aria-label="Susun fitur lewat formulir" className="grid gap-6 text-sm"
      onSubmit={(e) => { setDicoba(true); if (masalah.length) e.preventDefault(); }}>
      <input type="hidden" name="manifest" value={manifest ? JSON.stringify(manifest) : ""} />
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 font-semibold">Tentang fitur</legend>
        <div className="flex flex-col gap-1"><label htmlFor={`${id}-n`} className="text-tinta-2">Nama fitur</label>
          <input id={`${id}-n`} value={r.nama} onChange={(e) => setR({ ...r, nama: e.target.value })} maxLength={60} className={isian} placeholder="Misalnya Jadwal piket" /></div>
        <div className="flex flex-col gap-1"><label htmlFor={`${id}-d`} className="text-tinta-2">Gunanya (boleh kosong)</label>
          <input id={`${id}-d`} value={r.deskripsi} onChange={(e) => setR({ ...r, deskripsi: e.target.value })} maxLength={300} className={isian} /></div>
        <div className="flex flex-col gap-1"><label htmlFor={`${id}-i`} className="text-tinta-2">Ikon</label>
          <select id={`${id}-i`} value={r.ikon} onChange={(e) => setR({ ...r, ikon: e.target.value as Rancangan["ikon"] })} className={isian}>
            {IKON_MOD.map((k) => <option key={k} value={k}>{k.replace(/-/g, " ")}</option>)}</select></div>
        <div className="flex flex-col gap-1"><label htmlFor={`${id}-r`} className="text-tinta-2">Masuk ke ruang</label>
          <select id={`${id}-r`} value={r.ruang} onChange={(e) => setR({ ...r, ruang: e.target.value as Rancangan["ruang"] })} className={isian}>
            {RUANG_MOD.map((k) => <option key={k} value={k}>{RUANG_NAMA[k] ?? k}</option>)}</select></div>
      </fieldset>

      {r.koleksi.map((k, i) => (
        <fieldset key={i} className="grid gap-3 rounded-[var(--radius-kartu)] border border-garis p-4" data-testid={`bagian-${i + 1}`}>
          <legend className="px-1 font-semibold">Bagian {i + 1}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1"><label htmlFor={`${id}-k${i}`} className="text-tinta-2">Nama bagian</label>
              <input id={`${id}-k${i}`} value={k.nama} onChange={(e) => ubahK(i, { nama: e.target.value })} maxLength={60} className={isian} placeholder="Misalnya Piket" /></div>
            <div className="flex flex-col gap-1"><label htmlFor={`${id}-s${i}`} className="text-tinta-2">Tahap status (pisah koma, boleh kosong)</label>
              <input id={`${id}-s${i}`} value={k.status} onChange={(e) => ubahK(i, { status: e.target.value })} className={isian} placeholder="Belum, Dikerjakan, Selesai" /></div>
            <div className="flex flex-col gap-1"><label htmlFor={`${id}-as${i}`} className="text-tinta-2">Staf boleh</label>
              <select id={`${id}-as${i}`} value={k.staf} onChange={(e) => ubahK(i, { staf: e.target.value as Akses })} className={isian}>
                {AKSES_PILIH.map((a) => <option key={a.nilai} value={a.nilai}>{a.label}</option>)}</select></div>
            <div className="flex flex-col gap-1"><label htmlFor={`${id}-aa${i}`} className="text-tinta-2">Akuntan boleh</label>
              <select id={`${id}-aa${i}`} value={k.akuntan} onChange={(e) => ubahK(i, { akuntan: e.target.value as Akses })} className={isian}>
                {AKSES_PILIH.map((a) => <option key={a.nilai} value={a.nilai}>{a.label}</option>)}</select></div>
          </div>
          <ol className="grid gap-3">
            {k.isian.map((x, n) => (
              <li key={n} className="grid gap-2 border-t border-garis pt-3 sm:grid-cols-[2fr_1.4fr_auto]" data-testid={`isian-${i + 1}-${n + 1}`}>
                <div className="flex flex-col gap-1"><label htmlFor={`${id}-l${i}-${n}`} className="text-tinta-2">Isian {n + 1}</label>
                  <input id={`${id}-l${i}-${n}`} value={x.label} onChange={(e) => ubahI(i, n, { label: e.target.value })} maxLength={60} className={isian} /></div>
                <div className="flex flex-col gap-1"><label htmlFor={`${id}-t${i}-${n}`} className="text-tinta-2">Jenis isian {n + 1}</label>
                  <select id={`${id}-t${i}-${n}`} value={x.tipe} onChange={(e) => ubahI(i, n, { tipe: e.target.value as RancanganIsian["tipe"] })} className={isian}>
                    {TIPE_PEMBANGUN.map((t) => <option key={t.tipe} value={t.tipe}>{t.label}</option>)}</select></div>
                <div className="flex items-end gap-3 pb-2">
                  <label className="inline-flex items-center gap-2"><input type="checkbox" checked={x.wajib} onChange={(e) => ubahI(i, n, { wajib: e.target.checked })} className="size-4" />Wajib</label>
                  {k.isian.length > 1 && <button type="button" onClick={() => ubahK(i, { isian: k.isian.filter((_, j) => j !== n) })} className="text-cap underline underline-offset-4" aria-label={`Hapus isian ${n + 1} dari bagian ${i + 1}`}>Hapus</button>}
                </div>
                {x.tipe === "pilihan" && (
                  <div className="flex flex-col gap-1 sm:col-span-3"><label htmlFor={`${id}-p${i}-${n}`} className="text-tinta-2">Pilihan untuk isian {n + 1} (pisah koma)</label>
                    <input id={`${id}-p${i}-${n}`} value={x.pilihan} onChange={(e) => ubahI(i, n, { pilihan: e.target.value })} className={isian} placeholder="Pagi, Siang, Malam" /></div>
                )}
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-3">
            {k.isian.length < 40 && <Tombol ragam="kedua" onClick={() => ubahK(i, { isian: [...k.isian, isianBaru()] })}>Tambah isian di bagian {i + 1}</Tombol>}
            {r.koleksi.length > 1 && <Tombol ragam="kedua" onClick={() => setR({ ...r, koleksi: r.koleksi.filter((_, j) => j !== i) })}>Hapus bagian {i + 1}</Tombol>}
          </div>
        </fieldset>
      ))}
      {r.koleksi.length < 10 && <div><Tombol ragam="kedua" onClick={() => setR({ ...r, koleksi: [...r.koleksi, koleksiBaru()] })}>Tambah bagian</Tombol></div>}

      {dicoba && masalah.length > 0 && <div role="alert" data-testid="masalah-rancangan"><ul className="list-disc pl-5 text-cap">{masalah.map((m) => <li key={m}>{m}</li>)}</ul></div>}
      {h && "galat" in h && <div role="alert" className="text-cap"><p>{h.galat}</p>{h.alasan && <ul className="mt-1 list-disc pl-5">{h.alasan.slice(0, 20).map((a, i) => <li key={i}>{a}</li>)}</ul>}</div>}
      <details className="min-w-0">
        <summary className="cursor-pointer font-semibold">Lihat isi fitur (manifest)</summary>
        <pre tabIndex={0} aria-label="Isi fitur dalam JSON" className="mt-2 max-h-80 overflow-auto rounded-[var(--radius-isian)] border border-garis bg-kertas-2 p-2 font-mono text-xs" data-testid="pratinjau-manifest">{manifest ? JSON.stringify(manifest, null, 2) : "Lengkapi rancangan dulu."}</pre>
      </details>
      <div><Tombol type="submit" disabled={sibuk}>{sibuk ? "Memeriksa..." : "Periksa dan simpan draf"}</Tombol></div>
    </form>
  );
}
