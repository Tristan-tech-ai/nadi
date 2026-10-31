"use client";

import { useActionState, useState } from "react";
import { ajukanIzin, type HasilAjukan } from "@/app/app/izin/actions";
import { Cap } from "@/components/ui/cap";
import { Tombol } from "@/components/ui/tombol";
import { capStatus, hariIni, JENIS_IZIN, jumlahHari, rentangTanggal } from "@/lib/izin";
import { lemparBerkas, mimeBerkas } from "@/lib/lempar";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const isian = "h-12 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base";

/** Formulir izin untuk staf: satu layar, tombol besar. Bukti (foto surat) diunggah dulu dari browser, lalu id-nya dikirim. */
export function FormIzin() {
  const [hasil, aksi, sibuk] = useActionState<HasilAjukan, FormData>(async (sebelum, form) => {
    const bukti = form.get("bukti");
    form.delete("bukti");
    if (bukti instanceof File && bukti.size > 0) {
      const mime = mimeBerkas(bukti.name, bukti.type);
      if (!mime) return { galat: "Bukti harus foto atau PDF." };
      const h = await lemparBerkas(createBrowserSupabase(), { isi: await bukti.arrayBuffer(), nama: bukti.name, mime }, { baca: false });
      if (h.status === "galat") return { galat: h.pesan };
      if (h.berkasId) form.set("berkas", h.berkasId);
    }
    return ajukanIzin(sebelum, form);
  }, null);
  const [mulai, setMulai] = useState(() => hariIni());
  const [selesai, setSelesai] = useState(() => hariIni());
  const hari = jumlahHari(mulai, selesai);

  return (
    <form action={aksi} className="mt-6 flex flex-col gap-5" data-testid="form-izin">
      <fieldset>
        <legend className="text-sm text-tinta-2">Jenis</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {JENIS_IZIN.map((j, i) => (
            <label
              key={j.kode}
              className="flex min-h-12 cursor-pointer items-center justify-center rounded-[var(--radius-isian)] border border-garis-kuat text-base font-semibold transition-[background-color,color] duration-150 has-[:checked]:border-tinta has-[:checked]:bg-tinta has-[:checked]:text-kertas has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-kunyit"
            >
              <input type="radio" name="jenis" value={j.kode} defaultChecked={i === 0} className="sr-only" />
              {j.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-tinta-2">Mulai</span>
          <input
            type="date"
            name="mulai"
            required
            value={mulai}
            onChange={(e) => {
              setMulai(e.target.value);
              if (e.target.value > selesai) setSelesai(e.target.value);
            }}
            className={isian}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-tinta-2">Sampai</span>
          <input type="date" name="selesai" required value={selesai} min={mulai} onChange={(e) => setSelesai(e.target.value)} className={isian} />
        </label>
      </div>
      <p className="-mt-2 text-sm text-tinta-2" aria-live="polite" data-testid="lama-izin">
        {hari > 0 ? `${hari} hari: ${rentangTanggal(mulai, selesai)}` : "Tanggal selesai harus sama atau setelah tanggal mulai."}
      </p>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-tinta-2">Alasan (boleh kosong)</span>
        <textarea name="alasan" maxLength={500} rows={2} placeholder="Misalnya: demam sejak semalam" className="rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 py-2 text-base" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-tinta-2">Bukti, misalnya foto surat dokter (bila ada)</span>
        <input
          type="file"
          name="bukti"
          accept="image/*,application/pdf"
          className="text-base file:mr-3 file:h-10 file:rounded-[var(--radius-isian)] file:border file:border-garis-kuat file:bg-kertas-2 file:px-3 file:font-semibold file:text-tinta"
        />
      </label>
      <Tombol type="submit" ukuran="besar" disabled={sibuk || hari === 0}>
        {sibuk ? "Mengirim..." : "Ajukan"}
      </Tombol>
      {hasil && "galat" in hasil && <p role="alert" className="text-sm text-cap">{hasil.galat}</p>}
      {hasil && "status" in hasil && (
        <div role="status" className="rounded-[var(--radius-kartu)] bg-kertas-2 p-4" data-testid="hasil-izin">
          <Cap {...capStatus(hasil.status)} />
          <p className="mt-2">{hasil.alasan}</p>
          {hasil.status === "menunggu" && <p className="mt-1 text-sm text-tinta-2">Pemilik atau admin akan melihatnya di Feed. Statusnya muncul di daftar di bawah.</p>}
        </div>
      )}
    </form>
  );
}
