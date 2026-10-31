"use client";

import { useActionState, useState } from "react";
import { PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { aturDana, catatSesi, simpanRencana, ubahStatusRencana, type HasilMagang } from "@/app/app/magang/actions";
import { Tombol } from "@/components/ui/tombol";
import { MAKS_MINGGU, STATUS_RENCANA } from "@/lib/rekrut/magang";

const isian = "h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base";
const label = "flex flex-col gap-1 text-sm";

function Hasil({ h }: { h: HasilMagang }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="text-sm text-cap">{h.galat}</p> : <p role="status" className="text-sm text-daun">{h.pesan}</p>;
}

/** Tarif per jam dan anggaran bulanan Dana Rekrutmen (khusus pemilik). */
export function FormDana({ tarif, anggaran }: { tarif: number | null; anggaran: number | null }) {
  const [h, aksi, sibuk] = useActionState<HasilMagang, FormData>(aturDana, null);
  const angka = (n: number | null) => (n == null ? "" : new Intl.NumberFormat("id-ID").format(n));
  return (
    <form action={aksi} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" aria-label="Atur Dana Rekrutmen">
      <label className={label}>
        <span className="text-tinta-2">Tarif waktu rekrutmen per jam (Rp)</span>
        <input name="tarif" inputMode="numeric" defaultValue={angka(tarif)} placeholder="30.000" className={isian} />
      </label>
      <label className={label}>
        <span className="text-tinta-2">Anggaran per bulan (Rp)</span>
        <input name="anggaran" inputMode="numeric" defaultValue={angka(anggaran)} placeholder="500.000" className={isian} />
      </label>
      <Tombol type="submit" ragam="kedua" disabled={sibuk}>{sibuk ? "Menyimpan..." : "Simpan dana"}</Tombol>
      <div className="sm:col-span-3"><Hasil h={h} /></div>
    </form>
  );
}

type Opsi = { id: string; nama: string };
type Baris = { kunci: number; minggu: string; keahlian: string; target: string };

const barisBaru = (kunci: number, minggu: number): Baris => ({ kunci, minggu: String(minggu), keahlian: "", target: "" });

/** Rencana magang tertulis: peserta, mentor, topi tujuan, tanggal, uang saku, tujuan, rencana per minggu, uji akhir. */
export function FormRencana({ orang, topi, hariIni }: { orang: Opsi[]; topi: Opsi[]; hariIni: string }) {
  const [baris, setBaris] = useState<Baris[]>([barisBaru(1, 1)]);
  const [kunci, setKunci] = useState(2);
  const [versi, setVersi] = useState(0);
  const [h, aksi, sibuk] = useActionState<HasilMagang, FormData>(async (lalu, fd) => {
    const r = await simpanRencana(lalu, fd);
    if (r && "pesan" in r) {
      setBaris([barisBaru(1, 1)]);
      setVersi((v) => v + 1);
    }
    return r;
  }, null);
  const ubah = (k: number, bidang: keyof Omit<Baris, "kunci">, nilai: string) => setBaris((b) => b.map((x) => (x.kunci === k ? { ...x, [bidang]: nilai } : x)));
  const tambah = () => {
    setBaris((b) => [...b, barisBaru(kunci, (Number(b.at(-1)?.minggu) || b.length) + 1)]);
    setKunci((k) => k + 1);
  };

  if (orang.length < 2) {
    return <p className="mt-4 text-sm text-tinta-2" data-testid="rencana-butuh-orang">Rencana magang butuh dua orang: peserta dan mentor. Tambah orang dulu di halaman Orang.</p>;
  }
  return (
    <form key={versi} action={aksi} className="mt-4 grid gap-3 sm:grid-cols-2" aria-label="Buat rencana magang">
      <label className={label}>
        <span className="text-tinta-2">Peserta magang</span>
        <select name="peserta" required defaultValue="" className={isian}>
          <option value="" disabled>Pilih orang</option>
          {orang.map((o) => <option key={o.id} value={o.id}>{o.nama}</option>)}
        </select>
      </label>
      <label className={label}>
        <span className="text-tinta-2">Mentor</span>
        <select name="mentor" required defaultValue="" className={isian}>
          <option value="" disabled>Pilih orang</option>
          {orang.map((o) => <option key={o.id} value={o.id}>{o.nama}</option>)}
        </select>
      </label>
      <label className={label}>
        <span className="text-tinta-2">Topi tujuan (peran setelah magang)</span>
        <select name="topi" defaultValue="" className={isian}>
          <option value="">Belum ditentukan</option>
          {topi.map((t) => <option key={t.id} value={t.id}>{t.nama}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          <span className="text-tinta-2">Mulai</span>
          <input type="date" name="mulai" required defaultValue={hariIni} className={isian} />
        </label>
        <label className={label}>
          <span className="text-tinta-2">Selesai</span>
          <input type="date" name="selesai" required className={isian} />
        </label>
      </div>
      <fieldset className="grid grid-cols-3 gap-2 sm:col-span-2">
        <legend className="mb-1 text-sm text-tinta-2">Uang saku per bulan (Rp, boleh kosong)</legend>
        <label className={label}><span>Transport</span><input name="saku_transport" inputMode="numeric" placeholder="0" className={`${isian} min-w-0`} /></label>
        <label className={label}><span>Makan</span><input name="saku_makan" inputMode="numeric" placeholder="0" className={`${isian} min-w-0`} /></label>
        <label className={label}><span>Insentif</span><input name="saku_insentif" inputMode="numeric" placeholder="0" className={`${isian} min-w-0`} /></label>
      </fieldset>
      <label className={`${label} sm:col-span-2`}>
        <span className="text-tinta-2">Tujuan magang</span>
        <textarea name="tujuan" required minLength={3} maxLength={500} rows={2} placeholder="Bisa menyiapkan espresso dan susu sendiri di jam ramai" className="rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 py-2 text-base" />
      </label>

      <fieldset className="sm:col-span-2" data-testid="rencana-mingguan">
        <legend className="text-sm text-tinta-2">Rencana per minggu (paling banyak {MAKS_MINGGU} baris)</legend>
        <ol className="mt-2 grid gap-2">
          {baris.map((b, i) => (
            <li key={b.kunci} className="grid grid-cols-[4.5rem_1fr_auto] gap-2 sm:grid-cols-[4.5rem_1fr_1fr_auto]">
              <label className={label}>
                <span className="text-tinta-2">Minggu</span>
                <input name="minggu_no" inputMode="numeric" value={b.minggu} onChange={(e) => ubah(b.kunci, "minggu", e.target.value)} className={`${isian} min-w-0`} aria-label={`Minggu ke, baris ${i + 1}`} />
              </label>
              <label className={label}>
                <span className="text-tinta-2">Keahlian</span>
                <input name="minggu_keahlian" maxLength={120} value={b.keahlian} onChange={(e) => ubah(b.kunci, "keahlian", e.target.value)} placeholder="Kenal mesin espresso" className={`${isian} min-w-0`} aria-label={`Keahlian, baris ${i + 1}`} />
              </label>
              <label className={`${label} col-span-2 row-start-2 sm:col-span-1 sm:col-start-3 sm:row-start-1`}>
                <span className="text-tinta-2">Target</span>
                <input name="minggu_target" maxLength={300} value={b.target} onChange={(e) => ubah(b.kunci, "target", e.target.value)} placeholder="Membersihkan grup head sendiri" className={`${isian} min-w-0`} aria-label={`Target, baris ${i + 1}`} />
              </label>
              <button type="button" onClick={() => setBaris((x) => x.filter((y) => y.kunci !== b.kunci))} disabled={baris.length === 1}
                className="col-start-3 row-start-1 inline-flex h-10 w-10 items-center justify-center self-end rounded-[var(--radius-isian)] text-tinta-2 hover:bg-kertas-2 disabled:opacity-40 sm:col-start-4 sm:row-start-1"
                aria-label={`Hapus baris ${i + 1}`}>
                <TrashIcon size={20} aria-hidden />
              </button>
            </li>
          ))}
        </ol>
        <Tombol ragam="teks" className="mt-2" onClick={tambah} disabled={baris.length >= MAKS_MINGGU}>
          <PlusIcon size={16} aria-hidden /> Tambah minggu
        </Tombol>
      </fieldset>

      <label className={`${label} sm:col-span-2`}>
        <span className="text-tinta-2">Uji akhir (boleh kosong)</span>
        <input name="uji_akhir" maxLength={500} placeholder="Membuat 10 cangkir dalam 30 menit" className={isian} />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Tombol type="submit" ukuran="besar" disabled={sibuk}>{sibuk ? "Menyimpan..." : "Simpan rencana"}</Tombol>
        <Hasil h={h} />
      </div>
    </form>
  );
}

/** Catat satu sesi bimbingan untuk satu rencana. */
export function FormSesi({ rencana, peserta, hariIni }: { rencana: string; peserta: string; hariIni: string }) {
  const [h, aksi, sibuk] = useActionState<HasilMagang, FormData>(catatSesi, null);
  return (
    <form action={aksi} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[9.5rem_6rem_1fr_auto] sm:items-end" aria-label={`Catat sesi bimbingan ${peserta}`}>
      <input type="hidden" name="rencana" value={rencana} />
      <label className={label}>
        <span className="text-tinta-2">Tanggal</span>
        <input type="date" name="tanggal" required defaultValue={hariIni} max={hariIni} className={`${isian} min-w-0`} />
      </label>
      <label className={label}>
        <span className="text-tinta-2">Menit</span>
        <input type="number" name="menit" required min={1} max={600} step={1} inputMode="numeric" className={`${isian} min-w-0`} />
      </label>
      <label className={`${label} col-span-2 sm:col-span-1`}>
        <span className="text-tinta-2">Catatan (boleh kosong)</span>
        <input name="catatan" maxLength={300} placeholder="Latihan espresso" className={`${isian} min-w-0`} />
      </label>
      <Tombol type="submit" ragam="kedua" disabled={sibuk} className="col-span-2 sm:col-span-1">{sibuk ? "Mencatat..." : "Catat sesi"}</Tombol>
      <div className="col-span-2 sm:col-span-4"><Hasil h={h} /></div>
    </form>
  );
}

/** Ubah status rencana; nilai uji akhir diisi saat selesai. */
export function FormStatus({ rencana, peserta, status, nilai }: { rencana: string; peserta: string; status: string; nilai: number | null }) {
  const [h, aksi, sibuk] = useActionState<HasilMagang, FormData>(ubahStatusRencana, null);
  return (
    <form action={aksi} className="mt-3 flex flex-wrap items-end gap-2" aria-label={`Status rencana ${peserta}`}>
      <input type="hidden" name="rencana" value={rencana} />
      <label className={label}>
        <span className="text-tinta-2">Status</span>
        <select name="status" defaultValue={status} className={isian}>
          {Object.entries(STATUS_RENCANA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label className={label}>
        <span className="text-tinta-2">Nilai uji akhir (0 sampai 100)</span>
        <input type="number" name="nilai" min={0} max={100} step={1} defaultValue={nilai ?? ""} className={`${isian} w-28`} />
      </label>
      <Tombol type="submit" ragam="teks" disabled={sibuk}>{sibuk ? "Menyimpan..." : "Simpan status"}</Tombol>
      <div className="w-full"><Hasil h={h} /></div>
    </form>
  );
}
