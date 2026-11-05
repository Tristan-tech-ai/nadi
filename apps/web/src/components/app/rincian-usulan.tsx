"use client";

// U-13: "Lihat rincian" di kartu usulan. Dimuat saat dibuka pertama kali (disclosure <details>, pola umum), lalu menampilkan
// yang akan ditambah, diubah (sebelum -> sesudah), dan dilewati karena sudah ada.
import { useState } from "react";
import { bacaRincian } from "@/app/app/rincian-actions";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { rincian, type Rincian } from "@/lib/rincian-usulan";

const T = {
  id: { lihat: "Lihat rincian", memuat: "Memuat rincian...", tambah: "Akan ditambah", ubah: "Akan diubah", lewati: "Dilewati karena sudah ada", isi: "Isi usulan", sebelum: "Sekarang", sesudah: "Jadi", kosong: "Tidak ada rincian lain." },
  en: { lihat: "See details", memuat: "Loading details...", tambah: "Will be added", ubah: "Will change", lewati: "Skipped because they already exist", isi: "Proposal content", sebelum: "Now", sesudah: "Becomes", kosong: "No other details." },
};

export function RincianUsulan({ usulanId, bahasa: b = "id" }: { usulanId: string; bahasa?: Bahasa }) {
  const t = T[b];
  const [isi, setIsi] = useState<Rincian | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [dimuat, setDimuat] = useState(false);
  return (
    <details className="mt-2 text-sm" data-testid="rincian-usulan"
      onToggle={(e) => {
        if (!(e.currentTarget as HTMLDetailsElement).open || dimuat) return;
        setDimuat(true);
        void bacaRincian(usulanId).then((h) => { if (h.galat) setGalat(h.galat); else if (h.data) setIsi(rincian(h.data, b)); });
      }}>
      <summary className="inline-flex min-h-10 cursor-pointer items-center font-semibold underline underline-offset-4">{t.lihat}</summary>
      <div className="mt-1 grid gap-3 rounded-[var(--radius-isian)] border border-garis bg-kertas p-3" aria-live="polite">
        {galat ? <p role="alert" className="text-cap">{galat}</p> : !isi ? <p className="text-tinta-2">{t.memuat}</p> : (
          <>
            {isi.ubah.length > 0 && (
              <section aria-label={t.ubah}>
                <p className="font-semibold">{t.ubah}</p>
                <table className="mt-1 w-full text-left text-sm">
                  <thead className="text-xs text-tinta-2"><tr><th className="py-1 pr-2 font-normal"><span className="sr-only">-</span></th><th className="py-1 pr-2 font-normal">{t.sebelum}</th><th className="py-1 font-normal">{t.sesudah}</th></tr></thead>
                  <tbody>{isi.ubah.map((u) => (
                    <tr key={u.label} className="border-t border-garis" data-berubah={u.sebelum !== u.sesudah ? "ya" : "tidak"}>
                      <th scope="row" className="py-1 pr-2 font-normal text-tinta-2">{u.label}</th>
                      <td className="py-1 pr-2">{u.sebelum}</td>
                      <td className={`py-1 ${u.sebelum !== u.sesudah ? "font-semibold" : ""}`}>{u.sesudah}</td>
                    </tr>))}</tbody>
                </table>
              </section>
            )}
            {isi.tambah.length > 0 && (
              <section aria-label={t.tambah}>
                <p className="font-semibold">{t.tambah} ({isi.tambah.length})</p>
                <ul className="mt-1 grid gap-1">{isi.tambah.map((x, i) => (
                  <li key={i} className="border-t border-garis pt-1" data-pengguna>
                    {x.isi.map(([k, v]) => <span key={k} className="mr-3 inline-block"><span className="text-tinta-2">{k}</span> {v}</span>)}
                  </li>))}</ul>
              </section>
            )}
            {isi.lewati.length > 0 && (
              <section aria-label={t.lewati}><p className="font-semibold">{t.lewati} ({isi.lewati.length})</p><p className="text-tinta-2" data-pengguna>{isi.lewati.join(", ")}</p></section>
            )}
            {isi.isi.length > 0 && (
              <section aria-label={t.isi}>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">{isi.isi.map(([k, v]) => (
                  <div key={k} className="contents"><dt className="text-tinta-2">{k}</dt><dd className="min-w-0 break-words" data-pengguna>{v}</dd></div>))}</dl>
              </section>
            )}
            {!isi.ubah.length && !isi.tambah.length && !isi.lewati.length && !isi.isi.length && <p className="text-tinta-2">{t.kosong}</p>}
          </>
        )}
      </div>
    </details>
  );
}
