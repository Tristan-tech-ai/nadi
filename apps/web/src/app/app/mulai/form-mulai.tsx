"use client";

import { useActionState, useState } from "react";
import { buatPerusahaan } from "@/app/app/actions";
import { Tombol } from "@/components/ui/tombol";
import type { Kamus } from "@/lib/i18n/kamus";

const JENIS = ["fnb", "toko", "kantor", "bengkel", "klinik", "konstruksi", "logistik", "hotel", "salon", "laundry", "produksi", "pertanian", "pendidikan", "lainnya"] as const;

const SKALA = ["1", "2-5", "6-15", "16-50", "50+"] as const;
const ZONA_ID = ["Asia/Jakarta", "Asia/Pontianak", "Asia/Makassar", "Asia/Jayapura"] as const;
const isian = "mt-1 h-12 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base text-tinta";

export function FormMulai({ teks: t, negara }: { teks: Kamus["mulai"]; negara: { kode: string; nama: string }[] }) {
  const [hasil, kirim, menunggu] = useActionState(buatPerusahaan, {});
  const [pilihNegara, setPilihNegara] = useState(hasil.isian?.negara ?? "ID");
  const [jenis, setJenis] = useState(hasil.isian?.industri ?? "fnb");
  return (
    <form action={kirim} className="grid gap-5">
      <div>
        <label htmlFor="nama" className="text-sm font-medium">{t.nama}</label>
        <input id="nama" name="nama" required minLength={2} maxLength={120} defaultValue={hasil.isian?.nama} placeholder={t.namaContoh}
          className="mt-1 h-12 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base text-tinta placeholder:text-tinta-2" />
        <p className="mt-1 text-xs text-tinta-2">{t.namaBantu}</p>
      </div>
      <fieldset>
        <legend className="text-sm font-medium">{t.jenis}</legend>
        <p className="text-xs text-tinta-2">{t.jenisBantu}</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {JENIS.map((kode) => (
            <label key={kode} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[var(--radius-isian)] border border-garis px-3 has-[:checked]:border-tinta has-[:checked]:bg-kertas-2">
              <input type="radio" name="industri" value={kode} checked={jenis === kode} onChange={() => setJenis(kode)} className="accent-[var(--tinta)]" />
              <span className="text-sm">{t[kode]}</span>
            </label>
          ))}
        </div>
        {jenis === "lainnya" && (
          <div className="mt-3">
            <label htmlFor="cerita" className="text-sm font-medium">{t.cerita}</label>
            <textarea id="cerita" name="cerita" required minLength={10} maxLength={1000} rows={3} defaultValue={hasil.isian?.cerita} placeholder={t.ceritaContoh}
              className="mt-1 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 py-2 text-base text-tinta placeholder:text-tinta-2" />
            <p className="mt-1 text-xs text-tinta-2">{t.ceritaBantu}</p>
          </div>
        )}
      </fieldset>
      <fieldset>
        <legend className="text-sm font-medium">{t.skala}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SKALA.map((k) => (
            <label key={k} className="flex min-h-12 cursor-pointer items-center gap-2 rounded-[var(--radius-isian)] border border-garis px-3 has-[:checked]:border-tinta has-[:checked]:bg-kertas-2">
              <input type="radio" name="skala" value={k} defaultChecked={(hasil.isian?.skala ?? "2-5") === k} className="accent-[var(--tinta)]" />
              <span className="text-sm">{t.skalaNama[k]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="cabang" className="text-sm font-medium">{t.cabang}</label>
          <input id="cabang" name="cabang" type="number" min={1} max={1000} defaultValue={hasil.isian?.cabang ?? "1"} className={isian} />
        </div>
        <div>
          <label htmlFor="kota" className="text-sm font-medium">{t.kota}</label>
          <input id="kota" name="kota" maxLength={80} defaultValue={hasil.isian?.kota} placeholder={t.kotaContoh} className={isian} />
        </div>
        <div>
          <label htmlFor="negara" className="text-sm font-medium">{t.negara}</label>
          <select id="negara" name="negara" value={pilihNegara} onChange={(e) => setPilihNegara(e.target.value)} className={isian}>
            {negara.map((n) => <option key={n.kode} value={n.kode}>{n.nama}</option>)}
          </select>
        </div>
        {pilihNegara === "ID" ? (
          <div>
            <label htmlFor="zona" className="text-sm font-medium">{t.zona}</label>
            <select id="zona" name="zona" defaultValue={hasil.isian?.zona ?? "Asia/Jakarta"} className={isian}>
              {ZONA_ID.map((z) => <option key={z} value={z}>{t.zonaNama[z]}</option>)}
            </select>
          </div>
        ) : <p className="self-end text-sm text-tinta-2" data-testid="negara-lain">{t.negaraLain}</p>}
      </div>
      {hasil.galat ? <p role="alert" className="rounded-[var(--radius-isian)] border border-cap px-3 py-2 text-sm text-cap">{hasil.galat}</p> : null}
      <Tombol type="submit" ukuran="besar" disabled={menunggu}>{menunggu ? t.menyiapkan : t.siapkan}</Tombol>
    </form>
  );
}
