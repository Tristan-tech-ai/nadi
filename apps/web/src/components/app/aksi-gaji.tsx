"use client";

import { useActionState, useState } from "react";
import { aturGajiOrang, aturSaldoPesangon, bagikanSlip, catatLembur, lepasTahan, setujuiGaji, siapkanGaji, type HasilGaji, type HasilTautanSlip } from "@/app/app/gaji/actions";
import { Tombol } from "@/components/ui/tombol";
import { JENIS_LEMBUR } from "@/lib/gaji/lembur";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";

type TeksForm = Kamus["gajiForm"];

function Hasil({ h }: { h: HasilGaji }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="text-sm text-cap">{h.galat}</p> : <p role="status" className="text-sm text-daun">{h.pesan}</p>;
}

export function FormSiapkan({ bulan, ada, teks: t }: { bulan: string; ada: boolean; teks: TeksForm }) {
  const [h, aksi, sibuk] = useActionState<HasilGaji, FormData>(siapkanGaji, null);
  return (
    <form action={aksi} className="flex flex-col gap-2" data-testid="form-siapkan">
      <input type="hidden" name="bulan" value={bulan} />
      <Tombol type="submit" ragam={ada ? "kedua" : "utama"} ukuran="besar" disabled={sibuk}>
        {sibuk ? t.menghitung : ada ? t.hitungUlang : t.siapkan}
      </Tombol>
      <Hasil h={h} />
    </form>
  );
}

export function FormSetujui({ periode, jumlah, teks: t }: { periode: string; jumlah: number; teks: TeksForm }) {
  const [h, aksi, sibuk] = useActionState<HasilGaji, FormData>(setujuiGaji, null);
  return (
    <form action={aksi} className="flex flex-col gap-2">
      <input type="hidden" name="periode" value={periode} />
      <Tombol type="submit" ukuran="besar" disabled={sibuk || jumlah === 0}>{sibuk ? t.menyimpan : t.setujui}</Tombol>
      <p className="text-xs text-tinta-2">{t.setujuiKet}</p>
      <Hasil h={h} />
    </form>
  );
}

export function FormLepas({ slip, nama, teks: t }: { slip: string; nama: string; teks: TeksForm }) {
  const [h, aksi, sibuk] = useActionState<HasilGaji, FormData>(lepasTahan, null);
  return (
    <form action={aksi} className="mt-2 flex flex-wrap items-end gap-2">
      <input type="hidden" name="slip" value={slip} />
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
        <span className="text-tinta-2">{t.alasanLepas}</span>
        <input name="alasan" required maxLength={200} placeholder={t.alasanLepasContoh} className="h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base" />
      </label>
      <Tombol type="submit" ragam="kedua" disabled={sibuk} aria-label={isiTeks(t.lepasAria, { nama })}>{t.lepas}</Tombol>
      <div className="w-full"><Hasil h={h} /></div>
    </form>
  );
}

export function FormBagikan({ slip, nama, teks: t }: { slip: string; nama: string; teks: TeksForm }) {
  const [h, aksi, sibuk] = useActionState<HasilTautanSlip, FormData>(bagikanSlip, null);
  const [tersalin, setTersalin] = useState(false);
  if (h && "tautan" in h) {
    const pesan = isiTeks(t.pesanWa, { nama: h.nama, tautan: h.tautan });
    return (
      <div className="mt-2 rounded-[var(--radius-kartu)] bg-kertas-2 p-3 text-sm" data-testid="tautan-slip">
        <p className="break-all font-mono" data-testid="tautan-slip-isi">{h.tautan}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <a href={`https://wa.me/?text=${encodeURIComponent(pesan)}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center rounded-[var(--radius-isian)] border border-garis-kuat px-3 font-semibold">
            {t.kirimWa}
          </a>
          <Tombol ragam="teks" onClick={async () => { try { await navigator.clipboard.writeText(h.tautan); setTersalin(true); } catch {} }}>
            {tersalin ? t.tersalin : t.salin}
          </Tombol>
        </div>
        <p className="mt-1 text-xs text-tinta-2">{t.berlaku}</p>
      </div>
    );
  }
  return (
    <form action={aksi} className="mt-2">
      <input type="hidden" name="slip" value={slip} />
      <input type="hidden" name="nama" value={nama} />
      <Tombol type="submit" ragam="kedua" disabled={sibuk} aria-label={isiTeks(t.bagikanAria, { nama })}>{sibuk ? t.membuat : t.bagikan}</Tombol>
      {h && "galat" in h && <p role="alert" className="mt-1 text-sm text-cap">{h.galat}</p>}
    </form>
  );
}

export type GajiOrang = { pokok?: number; tunjangan_tetap?: number; ptkp?: string | null; risiko_jkk?: string };
const pilihan = "h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";

/** Isian gaji per orang di halaman Orang (pengelola). */
export function FormGajiOrang({ orang, nama, awal, mulai }: { orang: string; nama: string; awal: GajiOrang | null; mulai?: string | null }) {
  const [h, aksi, sibuk] = useActionState<HasilGaji, FormData>(aturGajiOrang, null);
  return (
    <details className="w-full text-sm" data-testid="gaji-orang">
      <summary className="cursor-pointer text-tinta-2">
        Gaji {awal?.pokok ? `Rp${new Intl.NumberFormat("id-ID").format(awal.pokok)}` : "belum diisi"}{awal?.ptkp ? `, ${awal.ptkp}` : ""}
      </summary>
      <form action={aksi} className="mt-2 grid grid-cols-2 gap-2" aria-label={`Gaji ${nama}`}>
        <input type="hidden" name="orang" value={orang} />
        <label className="flex flex-col gap-1"><span className="text-tinta-2">Gaji pokok (Rp)</span>
          <input name="pokok" inputMode="numeric" required defaultValue={awal?.pokok ?? ""} className={pilihan} /></label>
        <label className="flex flex-col gap-1"><span className="text-tinta-2">Tunjangan tetap (Rp)</span>
          <input name="tunjangan_tetap" inputMode="numeric" defaultValue={awal?.tunjangan_tetap ?? ""} className={pilihan} /></label>
        <label className="flex flex-col gap-1"><span className="text-tinta-2">Status PTKP</span>
          <select name="ptkp" defaultValue={awal?.ptkp ?? ""} className={pilihan}>
            <option value="">Belum tahu</option>
            {["TK/0", "TK/1", "TK/2", "TK/3", "K/0", "K/1", "K/2", "K/3"].map((p) => <option key={p} value={p}>{p}</option>)}
          </select></label>
        <label className="flex flex-col gap-1"><span className="text-tinta-2">Risiko kerja (JKK)</span>
          <select name="risiko_jkk" defaultValue={awal?.risiko_jkk ?? "sangat_rendah"} className={pilihan}>
            <option value="sangat_rendah">Sangat rendah</option><option value="rendah">Rendah</option><option value="sedang">Sedang</option>
            <option value="tinggi">Tinggi</option><option value="sangat_tinggi">Sangat tinggi</option>
          </select></label>
        <label className="flex flex-col gap-1"><span className="text-tinta-2">Mulai kerja</span>
          <input type="date" name="mulai" defaultValue={mulai ?? ""} className={pilihan} /></label>
        <div className="col-span-2 flex items-center gap-3">
          <Tombol type="submit" ragam="kedua" disabled={sibuk} aria-label={`Simpan gaji ${nama}`}>{sibuk ? "Menyimpan..." : "Simpan gaji"}</Tombol>
          <Hasil h={h} />
        </div>
      </form>
    </details>
  );
}

/** Isian lembur per orang per hari di halaman Gaji (pengelola, bulan yang belum disetujui). */
export function FormLembur({ orang, awal, akhir, teks: t, jenisLembur = JENIS_LEMBUR }: { orang: { id: string; nama: string }[]; awal: string; akhir: string; teks: TeksForm; jenisLembur?: Record<string, string> }) {
  const [h, aksi, sibuk] = useActionState<HasilGaji, FormData>(catatLembur, null);
  // Setelah galat, isian dikembalikan agar orang dan tanggal tidak perlu dipilih ulang (key memasang ulang nilai awal).
  const isi = h && "galat" in h ? (h.isian ?? {}) : {};
  return (
    <form key={JSON.stringify(isi)} action={aksi} className="mt-3 grid grid-cols-2 gap-2 text-sm" aria-label={t.catatLemburAria}>
      <label className="col-span-2 flex flex-col gap-1 sm:col-span-1"><span className="text-tinta-2">{t.orang}</span>
        <select name="orang" required defaultValue={isi.orang ?? ""} className={pilihan}>
          <option value="" disabled>{t.pilih}</option>
          {orang.map((o) => <option key={o.id} value={o.id} data-pengguna>{o.nama}</option>)}
        </select></label>
      <label className="col-span-2 flex flex-col gap-1 sm:col-span-1"><span className="text-tinta-2">{t.tanggal}</span>
        <input type="date" name="tanggal" required min={awal} max={akhir} defaultValue={isi.tanggal || awal} className={pilihan} /></label>
      <label className="col-span-2 flex flex-col gap-1 sm:col-span-1"><span className="text-tinta-2">{t.jenisHari}</span>
        <select name="jenis" defaultValue={isi.jenis || "hari_kerja"} className={pilihan}>
          {Object.entries(jenisLembur).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select></label>
      <label className="col-span-2 flex flex-col gap-1 sm:col-span-1"><span className="text-tinta-2">{t.jamLembur}</span>
        <input type="number" name="jam" required min={0} max={12} step={1} defaultValue={isi.jam || 1} inputMode="numeric" className={pilihan} /></label>
      <div className="col-span-2 flex flex-wrap items-center gap-3">
        <Tombol type="submit" ragam="kedua" disabled={sibuk}>{sibuk ? t.menyimpan : t.catatLembur}</Tombol>
        <Hasil h={h} />
      </div>
    </form>
  );
}

/** Saldo cadangan pesangon yang sudah disisihkan (pemilik). */
export function FormSaldoPesangon({ saldo }: { saldo: number }) {
  const [h, aksi, sibuk] = useActionState<HasilGaji, FormData>(aturSaldoPesangon, null);
  const isi = h && "galat" in h ? (h.isian ?? {}) : {};
  return (
    <form key={JSON.stringify(isi)} action={aksi} className="mt-3 flex flex-wrap items-end gap-2 text-sm" aria-label="Saldo cadangan pesangon">
      <label className="flex flex-col gap-1"><span className="text-tinta-2">Sudah disisihkan (Rp)</span>
        <input name="saldo" inputMode="numeric" required defaultValue={isi.saldo ?? String(saldo)} className={pilihan} /></label>
      <Tombol type="submit" ragam="kedua" disabled={sibuk}>{sibuk ? "Menyimpan..." : "Simpan saldo"}</Tombol>
      <Hasil h={h} />
    </form>
  );
}
