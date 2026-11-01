"use client";

import { useActionState } from "react";
import { batalkan, pahami, simpanDraf, terbitkan, type DrafSurat, type HasilPaham, type HasilSurat } from "@/app/app/surat-keluar/actions";
import { Tombol } from "@/components/ui/tombol";
import { JENIS_SURAT, type JenisSurat } from "@/lib/surat/kalimat";

const isian = "h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";

function Hasil({ h }: { h: HasilSurat | HasilPaham }) {
  if (!h || !("galat" in h || "pesan" in h)) return null;
  return "galat" in h ? <p role="alert" className="text-sm text-cap">{h.galat}</p> : <p role="status" className="text-sm text-daun">{h.pesan}</p>;
}

function FormDraf({ draf, orang }: { draf: DrafSurat; orang: { id: string; nama: string }[] }) {
  const [h, aksi, sibuk] = useActionState<HasilSurat, FormData>(simpanDraf, null);
  const ragu = draf.kandidat.length > 1 && !draf.orang;
  return (
    <form action={aksi} className="mt-4 grid grid-cols-1 gap-3 rounded-[var(--radius-kartu)] border border-garis p-4 text-sm sm:grid-cols-2" aria-label="Isian surat">
      {draf.kurang.length > 0 && (
        <p className="sm:col-span-2" data-testid="isian-kurang">
          Nadi belum menemukan {draf.kurang.length === 1 ? "satu isian" : `${draf.kurang.length} isian`} di kalimatmu. Lengkapi yang kosong di bawah.
          {ragu && ` Ada ${draf.kandidat.length} orang bernama mirip: ${draf.kandidat.map((k) => k.nama).join(", ")}.`}
        </p>
      )}
      <label className="flex flex-col gap-1"><span className="text-tinta-2">Jenis surat</span>
        <select name="jenis" required defaultValue={draf.jenis} className={isian}>
          <option value="" disabled>Pilih</option>
          {(Object.keys(JENIS_SURAT) as JenisSurat[]).map((j) => <option key={j} value={j}>{JENIS_SURAT[j].judul}</option>)}
        </select></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">Untuk siapa</span>
        <select name="orang" required defaultValue={draf.orang} className={isian}>
          <option value="" disabled>Pilih orang</option>
          {orang.map((o) => <option key={o.id} value={o.id}>{o.nama}</option>)}
        </select></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">Tujuan (mutasi atau tugas)</span>
        <input name="tujuan" defaultValue={draf.tujuan} maxLength={120} placeholder="cabang Denpasar" className={isian} /></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">Keperluan (surat tugas)</span>
        <input name="keperluan" defaultValue={draf.keperluan} maxLength={200} placeholder="ikut pameran" className={isian} /></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">Mulai</span>
        <input type="date" name="mulai" defaultValue={draf.mulai} className={isian} /></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">Lama tugas (hari)</span>
        <input type="number" name="lamaHari" min={1} max={365} defaultValue={draf.lamaHari} inputMode="numeric" className={isian} /></label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Tombol type="submit" ragam="kedua" disabled={sibuk}>{sibuk ? "Menyimpan..." : "Simpan draf"}</Tombol>
        <Hasil h={h} />
      </div>
    </form>
  );
}

/** Kalimat bebas lalu isian surat yang bisa diperiksa sebelum disimpan sebagai draf. */
export function BuatSurat({ orang }: { orang: { id: string; nama: string }[] }) {
  const [h, aksi, sibuk] = useActionState<HasilPaham, FormData>(pahami, null);
  return (
    <div>
      <form action={aksi} className="flex flex-col gap-2" aria-label="Minta surat">
        <label htmlFor="kalimat-surat" className="text-sm text-tinta-2">Tulis permintaan suratnya dalam satu kalimat</label>
        <textarea id="kalimat-surat" name="kalimat" required rows={2} maxLength={300}
          placeholder="SK mutasi Budi ke cabang Denpasar mulai 1 Desember"
          className="rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas p-2 text-base" />
        <div className="flex flex-wrap items-center gap-3">
          <Tombol type="submit" ragam="utama" disabled={sibuk}>{sibuk ? "Membaca..." : "Susun surat"}</Tombol>
          {h && "galat" in h && <Hasil h={h} />}
        </div>
      </form>
      {h && "draf" in h && <FormDraf key={h.kunci} draf={h.draf} orang={orang} />}
    </div>
  );
}

export function FormTerbitkan({ surat, judul }: { surat: string; judul: string }) {
  const [h, aksi, sibuk] = useActionState<HasilSurat, FormData>(terbitkan, null);
  return (
    <form action={aksi} className="flex flex-wrap items-center gap-3 text-sm">
      <input type="hidden" name="surat" value={surat} />
      <Tombol type="submit" ragam="kedua" disabled={sibuk} aria-label={`Terbitkan dan beri nomor: ${judul}`}>{sibuk ? "Menerbitkan..." : "Terbitkan dan beri nomor"}</Tombol>
      <Hasil h={h} />
    </form>
  );
}

export function FormBatalSurat({ surat, judul }: { surat: string; judul: string }) {
  const [h, aksi, sibuk] = useActionState<HasilSurat, FormData>(batalkan, null);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-tinta-2">Batalkan surat</summary>
      <form action={aksi} className="mt-2 flex flex-wrap items-end gap-2" aria-label={`Batalkan ${judul}`}>
        <input type="hidden" name="surat" value={surat} />
        <label className="flex min-w-0 flex-1 flex-col gap-1"><span className="text-tinta-2">Alasan</span>
          <input name="alasan" required minLength={3} maxLength={300} className={isian} /></label>
        <Tombol type="submit" ragam="kedua" disabled={sibuk}>Batalkan</Tombol>
        <Hasil h={h} />
      </form>
    </details>
  );
}

export function TombolCetak() {
  return <Tombol type="button" ragam="utama" onClick={() => window.print()} className="print:hidden">Cetak atau simpan PDF</Tombol>;
}
