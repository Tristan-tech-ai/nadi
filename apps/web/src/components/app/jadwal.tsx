"use client";

import { useActionState } from "react";
import { ambilTawaran, aturKebutuhan, batalkanShift, batalTawaran, hentiKebutuhan, jawabLembur, salinMingguLalu, simpanUsulan, tambahShift, tawarkanShift, usulkanJadwal, type HasilAmbil, type HasilJadwal, type HasilUsulan } from "@/app/app/jadwal/actions";
import { formatTanggalKalender } from "@/lib/format";
import { NAMA_HARI } from "@/lib/jadwal/kebutuhan";
import { Tombol } from "@/components/ui/tombol";

const isian = "h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";

function Hasil({ h }: { h: HasilJadwal }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="text-sm text-cap">{h.galat}</p> : <p role="status" className="text-sm text-daun">{h.pesan}</p>;
}

/** Tambah satu shift. Kunci acak per formulir supaya kirim ulang tidak menggandakan. */
export function FormShift({ orang, awal, kunci }: { orang: { id: string; nama: string }[]; awal: string; kunci: string }) {
  const [h, aksi, sibuk] = useActionState<HasilJadwal, FormData>(tambahShift, null);
  const isi = h && "galat" in h ? (h.isian ?? {}) : {};
  return (
    <form key={JSON.stringify(isi)} action={aksi} className="mt-4 grid grid-cols-2 gap-3 rounded-[var(--radius-kartu)] border border-garis p-4 text-sm sm:grid-cols-3" aria-label="Tambah shift">
      <input type="hidden" name="kunci" value={isi.kunci ?? kunci} />
      <label className="col-span-2 flex flex-col gap-1 sm:col-span-1"><span className="text-tinta-2">Orang</span>
        <select name="orang" required defaultValue={isi.orang ?? ""} className={isian}>
          <option value="" disabled>Pilih</option>
          {orang.map((o) => <option key={o.id} value={o.id}>{o.nama}</option>)}
        </select></label>
      <label className="col-span-2 flex flex-col gap-1 sm:col-span-1"><span className="text-tinta-2">Tanggal</span>
        <input type="date" name="tanggal" required defaultValue={isi.tanggal ?? awal} className={isian} /></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">Istirahat (menit)</span>
        <input type="number" name="istirahat" min={0} max={240} step={15} defaultValue={isi.istirahat ?? 30} inputMode="numeric" className={isian} /></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">Mulai</span>
        <input type="time" name="mulai" required defaultValue={isi.mulai ?? "08:00"} className={isian} /></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">Selesai</span>
        <input type="time" name="selesai" required defaultValue={isi.selesai ?? "15:30"} className={isian} /></label>
      <div className="col-span-2 flex flex-wrap items-center gap-3 sm:col-span-3">
        <Tombol type="submit" ragam="kedua" disabled={sibuk}>{sibuk ? "Menyimpan..." : "Simpan shift"}</Tombol>
        <Hasil h={h} />
      </div>
    </form>
  );
}

export function FormSalin({ minggu }: { minggu: string }) {
  const [h, aksi, sibuk] = useActionState<HasilJadwal, FormData>(salinMingguLalu, null);
  return (
    <form action={aksi} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="minggu" value={minggu} />
      <Tombol type="submit" ragam="utama" disabled={sibuk}>{sibuk ? "Menyalin..." : "Salin dari minggu lalu"}</Tombol>
      <Hasil h={h} />
    </form>
  );
}

export function FormBatalShift({ shift, label }: { shift: string; label: string }) {
  const [h, aksi, sibuk] = useActionState<HasilJadwal, FormData>(batalkanShift, null);
  return (
    <form action={aksi} className="flex items-center gap-2">
      <input type="hidden" name="shift" value={shift} />
      <button type="submit" disabled={sibuk} className="text-sm text-tinta-2 underline underline-offset-4" aria-label={`Batalkan ${label}`}>Batalkan</button>
      <Hasil h={h} />
    </form>
  );
}

export function FormLembur({ lembur, label }: { lembur: string; label: string }) {
  const [h, aksi, sibuk] = useActionState<HasilJadwal, FormData>(jawabLembur, null);
  return (
    <form action={aksi} className="mt-2 flex flex-col gap-2" aria-label={label}>
      <input type="hidden" name="lembur" value={lembur} />
      <div className="flex flex-wrap gap-2">
        <Tombol type="submit" name="jawab" value="setuju" ragam="utama" ukuran="besar" disabled={sibuk}>Setuju</Tombol>
        <Tombol type="submit" name="jawab" value="tidak" ragam="kedua" ukuran="besar" disabled={sibuk}>Tidak bisa</Tombol>
      </div>
      <Hasil h={h} />
    </form>
  );
}

/** Staf menawarkan shift-nya ke rekan (F3-06B). */
export function FormTawarkan({ shift, kunci, label }: { shift: string; kunci: string; label: string }) {
  const [h, aksi, sibuk] = useActionState<HasilJadwal, FormData>(tawarkanShift, null);
  return (
    <form action={aksi} className="flex flex-col items-end gap-1">
      <input type="hidden" name="shift" value={shift} />
      <input type="hidden" name="kunci" value={kunci} />
      <button type="submit" disabled={sibuk} className="text-sm underline underline-offset-4" aria-label={`Tawarkan ke rekan ${label}`}>Tawarkan ke rekan</button>
      <Hasil h={h} />
    </form>
  );
}

export function FormBatalTawaran({ tawaran, label }: { tawaran: string; label: string }) {
  const [h, aksi, sibuk] = useActionState<HasilJadwal, FormData>(batalTawaran, null);
  return (
    <form action={aksi} className="flex flex-col items-end gap-1">
      <input type="hidden" name="tawaran" value={tawaran} />
      <button type="submit" disabled={sibuk} className="text-sm text-tinta-2 underline underline-offset-4" aria-label={`Batalkan tawaran ${label}`}>Batalkan tawaran</button>
      <Hasil h={h} />
    </form>
  );
}

/** Ambil shift yang ditawarkan rekan; peringatan batas tampil dulu dan butuh "Tetap ambil". */
export function FormAmbil({ tawaran, label }: { tawaran: string; label: string }) {
  const [h, aksi, sibuk] = useActionState<HasilAmbil, FormData>(ambilTawaran, null);
  const perlu = h && "perlu" in h ? h.perlu : null;
  return (
    <form action={aksi} className="mt-2 flex flex-col gap-2" aria-label={label}>
      <input type="hidden" name="tawaran" value={tawaran} />
      {perlu ? (
        <>
          <ul className="list-disc pl-5 text-sm" data-testid="peringatan-ambil">{perlu.map((p) => <li key={p}>{p}</li>)}</ul>
          <input type="hidden" name="konfirmasi" value="1" />
          <div><Tombol type="submit" ragam="utama" ukuran="besar" disabled={sibuk}>Tetap ambil</Tombol></div>
        </>
      ) : (
        <div><Tombol type="submit" ragam="utama" ukuran="besar" disabled={sibuk}>Saya ambil</Tombol></div>
      )}
      {h && !("perlu" in h) && ("galat" in h ? <p role="alert" className="text-sm text-cap">{h.galat}</p> : <p role="status" className="text-sm text-daun">{h.pesan}</p>)}
    </form>
  );
}

/** Kebutuhan orang per shift (F3-06C): topi, hari, jam, berapa orang. */
export function FormKebutuhan({ topi }: { topi: { id: string; nama: string }[] }) {
  const [h, aksi, sibuk] = useActionState<HasilJadwal, FormData>(aturKebutuhan, null);
  return (
    <form action={aksi} className="mt-3 grid grid-cols-2 gap-3 rounded-[var(--radius-kartu)] border border-garis p-4 text-sm sm:grid-cols-4" aria-label="Kebutuhan orang">
      <label className="col-span-2 flex flex-col gap-1"><span className="text-tinta-2">Topi</span>
        <select name="topi" required defaultValue="" className={isian}>
          <option value="" disabled>Pilih</option>
          {topi.map((t) => <option key={t.id} value={t.id}>{t.nama}</option>)}
        </select></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">Butuh (orang)</span>
        <input type="number" name="butuh" min={1} max={20} defaultValue={1} inputMode="numeric" className={isian} /></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">Istirahat (menit)</span>
        <input type="number" name="istirahat" min={0} max={240} step={15} defaultValue={60} inputMode="numeric" className={isian} /></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">Mulai</span>
        <input type="time" name="mulai" required defaultValue="07:00" className={isian} /></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">Selesai</span>
        <input type="time" name="selesai" required defaultValue="15:00" className={isian} /></label>
      <fieldset className="col-span-2 sm:col-span-4">
        <legend className="text-tinta-2">Hari</legend>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-2">
          {NAMA_HARI.map((n, i) => (
            <label key={n} className="inline-flex items-center gap-1.5"><input type="checkbox" name="hari" value={i} defaultChecked className="h-4 w-4" />{n}</label>
          ))}
        </div>
      </fieldset>
      <div className="col-span-2 flex flex-wrap items-center gap-3 sm:col-span-4">
        <Tombol type="submit" ragam="kedua" disabled={sibuk}>{sibuk ? "Menyimpan..." : "Simpan kebutuhan"}</Tombol>
        <Hasil h={h} />
      </div>
    </form>
  );
}

export function FormHentiKebutuhan({ kebutuhan, label }: { kebutuhan: string; label: string }) {
  const [h, aksi, sibuk] = useActionState<HasilJadwal, FormData>(hentiKebutuhan, null);
  return (
    <form action={aksi} className="flex items-center gap-2">
      <input type="hidden" name="kebutuhan" value={kebutuhan} />
      <button type="submit" disabled={sibuk} className="text-sm text-tinta-2 underline underline-offset-4" aria-label={`Tidak dipakai lagi ${label}`}>Tidak dipakai lagi</button>
      <Hasil h={h} />
    </form>
  );
}

/** Usulkan jadwal minggu ini dari kebutuhan; pemilik memeriksa lalu menyimpan. Penyusun hanya mengusulkan. */
export function PenyusunJadwal({ minggu }: { minggu: string }) {
  const [usul, mintaUsul, sibukUsul] = useActionState<HasilUsulan, FormData>(usulkanJadwal, null);
  const [simpan, aksiSimpan, sibukSimpan] = useActionState<HasilUsulan, FormData>(simpanUsulan, null);
  const u = usul && "usulan" in usul ? usul.usulan : null;
  const s = simpan && "simpan" in simpan ? simpan.simpan : null;
  return (
    <div className="mt-3" data-testid="penyusun">
      <form action={mintaUsul} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="minggu" value={minggu} />
        <Tombol type="submit" ragam="kedua" disabled={sibukUsul}>{sibukUsul ? "Menyusun..." : "Usulkan jadwal"}</Tombol>
        {usul && "galat" in usul && <p role="alert" className="text-sm text-cap">{usul.galat}</p>}
      </form>
      {u && !s && (
        <div className="mt-3 rounded-[var(--radius-kartu)] border border-garis p-4 text-sm" data-testid="usulan-jadwal">
          <p className="font-semibold">Usulan: {u.baris.length} shift. Periksa dulu; belum ada yang tersimpan.</p>
          <ul className="mt-2 divide-y divide-garis">
            {u.baris.map((b) => (
              <li key={b.kunci} className="flex flex-wrap justify-between gap-2 py-1" data-testid="baris-usulan">
                <span>{NAMA_HARI[b.hari]}, {formatTanggalKalender(b.tanggal)}: <span className="font-semibold">{b.nama}</span> ({b.topi_nama.toLowerCase()})</span>
                <span className="angka">{b.mulai.replace(":", ".")}-{b.selesai.replace(":", ".")}</span>
              </li>
            ))}
          </ul>
          {u.kurang.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-cap" data-testid="usulan-kurang">{u.kurang.map((k) => <li key={k}>{k}</li>)}</ul>
          )}
          {u.baris.length > 0 && (
            <form action={aksiSimpan} className="mt-3">
              <input type="hidden" name="baris" value={JSON.stringify(u.baris)} />
              <Tombol type="submit" ragam="kedua" disabled={sibukSimpan}>{sibukSimpan ? "Menyimpan..." : `Simpan ${u.baris.length} shift`}</Tombol>
            </form>
          )}
        </div>
      )}
      {s && (
        <div className="mt-3 text-sm" data-testid="hasil-simpan-usulan">
          <p role="status" className="text-daun">{s.pesan}</p>
          {s.gagal.length > 0 && <ul className="mt-1 list-disc pl-5 text-cap">{s.gagal.map((g) => <li key={g}>{g}</li>)}</ul>}
        </div>
      )}
      {simpan && "galat" in simpan && <p role="alert" className="mt-2 text-sm text-cap">{simpan.galat}</p>}
    </div>
  );
}
