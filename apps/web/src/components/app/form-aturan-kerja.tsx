"use client";

import { useActionState, useRef, useState, type FormEvent } from "react";
import { CheckCircleIcon } from "@phosphor-icons/react";
import { simpanAturanKerja, type HasilAturanKerja } from "@/app/app/perusahaan/actions";
import { Tombol } from "@/components/ui/tombol";
import { perluLembarDampak, POLA_KERJA, type PolaKerja } from "@/lib/gaji/pola-kerja";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";

type Props = { pola: PolaKerja; tersimpan: boolean; diaturSendiri: boolean; bisaUbah: boolean; lemburLibur: number; slip: number; teks: Kamus["aturanKerja"] };

/**
 * Dua pilihan besar (bukan dropdown) dan satu tombol utama. Bila pola berubah dan usaha sudah punya lembur libur atau slip,
 * lembar bawah menjelaskan dampaknya dengan jumlah nyata sebelum menyimpan (tanpa dialog bawaan browser, S52).
 */
export function FormAturanKerja({ pola, tersimpan, diaturSendiri, bisaUbah, lemburLibur, slip, teks: t }: Props) {
  const judulPola = (k: PolaKerja) => (k === "5_hari" ? t.judul5 : t.judul6);
  const ketPola = (k: PolaKerja) => (k === "5_hari" ? t.ket5 : t.ket6);
  const [pilihan, setPilihan] = useState<PolaKerja>(pola);
  const [sendiri, setSendiri] = useState(diaturSendiri);
  const lembar = useRef<HTMLDialogElement>(null);
  const [h, aksi, sibuk] = useActionState<HasilAturanKerja, FormData>(async (lalu, fd) => {
    const r = await simpanAturanKerja(lalu, fd);
    lembar.current?.close();
    return r;
  }, null);
  const perlu = perluLembarDampak(pola, pilihan, { lemburLibur, slip });
  const kirim = (e: FormEvent<HTMLFormElement>) => {
    const pengirim = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    if (perlu && pengirim?.dataset.konfirmasi !== "ya") {
      e.preventDefault();
      lembar.current?.showModal();
    }
  };
  const hari = POLA_KERJA[pilihan].hari;
  // Pesan berhasil hanya untuk pilihan yang sedang tampil; galat tetap terlihat sampai disimpan ulang.
  const hasil = h && ("galat" in h || h.pola === pilihan) ? h : null;

  return (
    <form action={aksi} onSubmit={kirim} aria-label={t.judul} className="mt-1">
      <p className="text-sm text-tinta-2">{t.ket}</p>
      <fieldset disabled={!bisaUbah} className="mt-4 grid gap-3">
        <legend className="sr-only">{t.legend}</legend>
        {(Object.keys(POLA_KERJA) as PolaKerja[]).map((k) => {
          const dipakai = k === pola;
          const dipilih = k === pilihan;
          return (
            <label
              key={k}
              data-testid={`pola-${k}`}
              className={`flex gap-3 rounded-[var(--radius-kartu)] border p-4 transition-[background-color,border-color] duration-150 ${bisaUbah ? "cursor-pointer hover:bg-kertas-2" : ""} ${dipilih ? "border-tinta bg-kertas-2" : "border-garis"}`}
            >
              <input type="radio" name="pola" value={k} checked={dipilih} onChange={() => setPilihan(k)} className="mt-0.5 size-5 shrink-0 accent-[var(--tinta)]" />
              <span className="grid gap-1">
                <span className="font-semibold">{judulPola(k)}</span>
                <span className="text-sm text-tinta-2">{ketPola(k)}</span>
                {dipakai && (
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-daun" data-testid="dipakai-sekarang">
                    <CheckCircleIcon size={18} weight="fill" aria-hidden /> {t.dipakai}
                  </span>
                )}
                {dipakai && !tersimpan && (
                  <span className="text-sm text-tinta-2">{t.bawaan}</span>
                )}
              </span>
            </label>
          );
        })}
        <p className="text-sm text-tinta-2">{t.dasar}</p>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="diatur_sendiri" checked={sendiri} onChange={(e) => setSendiri(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--tinta)]" />
          <span className="grid gap-1">
            <span>{t.diaturSendiri}</span>
            {sendiri && <span className="text-tinta-2">{t.diaturSendiriKet}</span>}
          </span>
        </label>
      </fieldset>

      {bisaUbah ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {/* Tombol kedua: di /app/perusahaan tombol utama milik Nyalakan pemberitahuan (satu tombol utama per layar, S22). */}
          <Tombol type="submit" ragam="kedua" disabled={sibuk}>{sibuk ? t.menyimpan : t.simpan}</Tombol>
          {hasil && "pesan" in hasil && <p role="status" className="text-sm text-daun" data-testid="aturan-kerja-hasil">{hasil.pesan}</p>}
          {hasil && "galat" in hasil && <p role="alert" className="text-sm text-cap" data-testid="aturan-kerja-galat">{hasil.galat}</p>}
        </div>
      ) : (
        <p className="mt-4 text-sm text-tinta-2" data-testid="aturan-kerja-baca">{t.hanyaPemilik}</p>
      )}

      {bisaUbah && (
        <dialog
          ref={lembar}
          aria-labelledby="judul-dampak-pola"
          data-testid="lembar-dampak"
          className="mx-auto mb-0 mt-auto w-full max-w-none rounded-t-[var(--radius-lembar)] bg-kertas p-5 text-tinta backdrop:bg-tinta/40 sm:mb-auto sm:max-w-lg sm:rounded-[var(--radius-lembar)]"
        >
          <h3 id="judul-dampak-pola" className="text-lg font-semibold">{isiTeks(t.gantiJudul, { hari })}</h3>
          <ul className="mt-3 grid list-disc gap-2 pl-5 text-sm">
            {[lemburLibur > 0 ? isiTeks(t.dampakAda, { n: lemburLibur }) : t.dampakBelum, isiTeks(t.dampakMulai, { hari: POLA_KERJA[pilihan].hari }), t.dampakSlip].map((k) => <li key={k}>{k}</li>)}
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            <Tombol type="submit" data-konfirmasi="ya" disabled={sibuk}>{sibuk ? t.menyimpan : isiTeks(t.gantiTombol, { hari })}</Tombol>
            <Tombol ragam="teks" onClick={() => lembar.current?.close()}>{t.batal}</Tombol>
          </div>
        </dialog>
      )}
    </form>
  );
}
