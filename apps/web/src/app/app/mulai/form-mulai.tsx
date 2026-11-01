"use client";

import { useActionState } from "react";
import { buatPerusahaan } from "@/app/app/actions";
import { Tombol } from "@/components/ui/tombol";

const JENIS: [string, string][] = [
  ["fnb", "Warung, kafe, restoran"],
  ["toko", "Toko, grosir, minimarket"],
  ["kantor", "Kantor, jasa profesional"],
  ["bengkel", "Bengkel, servis"],
  ["klinik", "Klinik, apotek"],
  ["konstruksi", "Kontraktor, proyek"],
  ["logistik", "Gudang, distribusi"],
  ["hotel", "Hotel, vila, penginapan"],
  ["salon", "Salon, spa, barbershop"],
  ["laundry", "Laundry"],
  ["lainnya", "Lainnya"],
];

export function FormMulai() {
  const [hasil, kirim, menunggu] = useActionState(buatPerusahaan, {});
  return (
    <form action={kirim} className="grid gap-5">
      <div>
        <label htmlFor="nama" className="text-sm font-medium">Nama usaha</label>
        <input id="nama" name="nama" required minLength={2} maxLength={120} defaultValue={hasil.isian?.nama} placeholder="Warung Bu Made"
          className="mt-1 h-12 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base text-tinta placeholder:text-tinta-2" />
        <p className="mt-1 text-xs text-tinta-2">Tampil di nota, invoice, dan slip gaji. Bisa diubah nanti.</p>
      </div>
      <fieldset>
        <legend className="text-sm font-medium">Jenis usaha</legend>
        <p className="text-xs text-tinta-2">Nadi menyiapkan topi (peran kerja) dan laporan yang biasa dipakai jenis usaha ini.</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {JENIS.map(([kode, label]) => (
            <label key={kode} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[var(--radius-isian)] border border-garis px-3 has-[:checked]:border-tinta has-[:checked]:bg-kertas-2">
              <input type="radio" name="industri" value={kode} defaultChecked={(hasil.isian?.industri ?? "fnb") === kode} className="accent-[var(--tinta)]" />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {hasil.galat ? <p role="alert" className="rounded-[var(--radius-isian)] border border-cap px-3 py-2 text-sm text-cap">{hasil.galat}</p> : null}
      <Tombol type="submit" ukuran="besar" disabled={menunggu}>{menunggu ? "Menyiapkan..." : "Siapkan usahaku"}</Tombol>
    </form>
  );
}
