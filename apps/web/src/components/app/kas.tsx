"use client";

import { useActionState } from "react";
import { batalCocok, catatUang, cocokkanMutasi, cocokkanSemua, imporMutasi, pindahDana, simpanAturan, tambahRekening, type HasilKas } from "@/app/app/kas/actions";
import { Tombol } from "@/components/ui/tombol";
import type { Kamus } from "@/lib/i18n/kamus";

type Teks = Kamus["kas"];
type Rek = { id: string; nama: string };
type Akun = { kode: string; nama: string };
const isian = "h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";
const kotak = "mt-3 flex flex-wrap items-end gap-3 rounded-[var(--radius-kartu)] border border-garis p-4 text-sm";

function Hasil({ h }: { h: HasilKas }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="w-full text-cap">{h.galat}</p> : <p role="status" className="w-full text-daun">{h.pesan}</p>;
}
const Label = ({ teks, children }: { teks: string; children: React.ReactNode }) => <label className="flex min-w-0 max-w-full flex-col gap-1"><span className="text-tinta-2">{teks}</span>{children}</label>;
const PilihAkun = ({ akun, name = "akun", label }: { akun: Akun[]; name?: string; label: string }) => (
  <Label teks={label}><select name={name} required className={`${isian} max-w-64`}>{akun.map((a) => <option key={a.kode} value={a.kode}>{a.kode} {a.nama}</option>)}</select></Label>
);

export function FormRekening({ teks: t }: { teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilKas, FormData>(tambahRekening, null);
  return (
    <form action={aksi} className={kotak} aria-label={t.tambahRekening} key={h && "pesan" in h ? h.pesan : "f"}>
      <Label teks={t.namaRekening}><input name="nama" required maxLength={60} className={isian} /></Label>
      <Label teks={t.jenis}><select name="jenis" className={isian} defaultValue="bank"><option value="bank">{t.jenisNama.bank}</option><option value="kas">{t.jenisNama.kas}</option><option value="dompet">{t.jenisNama.dompet}</option></select></Label>
      <Label teks={t.nomorAkhir}><input name="nomor_akhir" inputMode="numeric" maxLength={4} pattern="[0-9]{4}" className={`${isian} w-24`} /></Label>
      <Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.tambahRekening}</Tombol><Hasil h={h} />
    </form>
  );
}

export function FormPindah({ rekening, hari, kunci, teks: t }: { rekening: Rek[]; hari: string; kunci: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilKas, FormData>(pindahDana, null);
  return (
    <form action={aksi} className={kotak} aria-label={t.pindah} key={h && "pesan" in h ? h.pesan : "f"}>
      <input type="hidden" name="kunci" value={kunci} />
      <Label teks={t.dari}><select name="dari" className={isian}>{rekening.map((r) => <option key={r.id} value={r.id} data-pengguna>{r.nama}</option>)}</select></Label>
      <Label teks={t.ke}><select name="ke" className={isian} defaultValue={rekening[1]?.id}>{rekening.map((r) => <option key={r.id} value={r.id} data-pengguna>{r.nama}</option>)}</select></Label>
      <Label teks={t.jumlah}><input name="jumlah" required inputMode="numeric" className={`${isian} angka w-32 text-right`} /></Label>
      <Label teks={t.tanggal}><input type="date" name="tanggal" defaultValue={hari} max={hari} className={isian} /></Label>
      <Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.pindah}</Tombol><Hasil h={h} />
    </form>
  );
}

export function FormUang({ rekening, akun, hari, kunci, teks: t }: { rekening: Rek[]; akun: Akun[]; hari: string; kunci: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilKas, FormData>(catatUang, null);
  return (
    <form action={aksi} className={kotak} aria-label={t.uangManual} key={h && "pesan" in h ? h.pesan : "f"}>
      <input type="hidden" name="kunci" value={kunci} />
      <Label teks={t.arah}><select name="arah" className={isian}><option value="masuk">{t.masuk}</option><option value="keluar">{t.keluar}</option></select></Label>
      <Label teks={t.rekening}><select name="rekening" className={isian}>{rekening.map((r) => <option key={r.id} value={r.id} data-pengguna>{r.nama}</option>)}</select></Label>
      <Label teks={t.jumlah}><input name="jumlah" required inputMode="numeric" className={`${isian} angka w-32 text-right`} /></Label>
      <PilihAkun akun={akun} label={t.akunLawan} />
      <Label teks={t.keterangan}><input name="keterangan" required minLength={3} maxLength={200} className={isian} /></Label>
      <Label teks={t.tanggal}><input type="date" name="tanggal" defaultValue={hari} max={hari} className={isian} /></Label>
      <Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.catatUang}</Tombol><Hasil h={h} />
    </form>
  );
}

export function FormImpor({ rekening, teks: t }: { rekening: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilKas, FormData>(imporMutasi, null);
  return (
    <form action={aksi} className={kotak} aria-label={t.impor}>
      <input type="hidden" name="rekening" value={rekening} />
      <Label teks={t.berkasCsv}><input type="file" name="berkas" accept=".csv,text/csv" required className="w-full max-w-full text-base" /></Label>
      <Tombol type="submit" disabled={sibuk}>{t.impor}</Tombol><Hasil h={h} />
    </form>
  );
}

export type Pilihan = { nilai: string; label: string };

/** Satu baris mutasi: pilihan usulan (terpilih), kandidat lain, akun lawan, atau abaikan. */
export function FormCocok({ mutasi, pilihan, bawaan, teks: t }: { mutasi: string; pilihan: Pilihan[]; bawaan: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilKas, FormData>(cocokkanMutasi, null);
  return (
    <form action={aksi} className="flex flex-wrap items-end gap-2 text-sm" aria-label={t.cocokkanAria}>
      <input type="hidden" name="mutasi" value={mutasi} />
      <Label teks={t.pasangan}><select name="pilihan" defaultValue={bawaan} className={`${isian} max-w-80`}>
        {!bawaan && <option value="">{t.pilihPasangan}</option>}
        {pilihan.map((p) => <option key={p.nilai} value={p.nilai}>{p.label}</option>)}</select></Label>
      <Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.cocokkan}</Tombol><Hasil h={h} />
    </form>
  );
}

export function TombolSemua({ butir, teks: t, label }: { butir: string[]; teks: Teks; label: string }) {
  const [h, aksi, sibuk] = useActionState<HasilKas, FormData>(cocokkanSemua, null);
  return (
    <form action={aksi} className="mt-3 flex flex-wrap items-center gap-3 text-sm" aria-label={t.semuaAria}>
      {butir.map((b) => <input key={b} type="hidden" name="butir" value={b} />)}
      <Tombol type="submit" disabled={sibuk || butir.length === 0}>{label}</Tombol><Hasil h={h} />
    </form>
  );
}

export function FormBatal({ mutasi, teks: t }: { mutasi: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilKas, FormData>(batalCocok, null);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-tinta-2 underline underline-offset-4">{t.batalkan}</summary>
      <form action={aksi} className="mt-2 flex flex-wrap items-end gap-2" aria-label={t.batalkan}>
        <input type="hidden" name="mutasi" value={mutasi} />
        <Label teks={t.alasanBatal}><input name="alasan" required minLength={3} maxLength={200} className={isian} /></Label>
        <Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.batalkan}</Tombol><Hasil h={h} />
      </form>
    </details>
  );
}

export function FormAturan({ akun, teks: t }: { akun: Akun[]; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilKas, FormData>(simpanAturan, null);
  return (
    <form action={aksi} className={kotak} aria-label={t.tambahAturan} key={h && "pesan" in h ? h.pesan : "f"}>
      <Label teks={t.kataKunci}><input name="kata" required minLength={2} maxLength={60} className={isian} /></Label>
      <Label teks={t.arah}><select name="arah" className={isian} defaultValue="DB"><option value="DB">{t.keluar}</option><option value="CR">{t.masuk}</option><option value="">{t.keduanya}</option></select></Label>
      <PilihAkun akun={akun} label={t.akunTujuan} />
      <Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.tambahAturan}</Tombol><Hasil h={h} />
    </form>
  );
}

export function TombolNonaktif({ aturan, kata, arah, akun, teks: t }: { aturan: string; kata: string; arah: string | null; akun: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilKas, FormData>(simpanAturan, null);
  return (
    <form action={aksi} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={aturan} /><input type="hidden" name="kata" value={kata} /><input type="hidden" name="arah" value={arah ?? ""} />
      <input type="hidden" name="akun" value={akun} /><input type="hidden" name="aktif" value="tidak" />
      <button type="submit" disabled={sibuk} className="text-sm underline underline-offset-4">{t.nonaktifkan}</button><Hasil h={h} />
    </form>
  );
}
