import { CheckCircleIcon, WarningIcon } from "@phosphor-icons/react/dist/ssr";
import { formatAngka } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";
import { formatHari, jalurTeks, kalimatPenyimpangan, labelLangkah, ringkasAlur, sisiBerurut, type Alur } from "@/lib/alur/alur";
import { LangkahPertama } from "@/components/app/langkah-pertama";

/** Teks bawaan = kamus id `alur` (diuji sama); demo publik memakai bawaan ini tanpa menarik kamus. */
export const TEKS_ALUR_ID: Kamus["alur"] = {
  judul: "Alur nyata vs alur kertas",
  ket: "Disusun dari catatan kejadian 90 hari terakhir: apa yang benar-benar terjadi, bukan yang tertulis di prosedur.",
  catatan: "Langkah dan kalimat alur ditulis dalam bahasa Indonesia.",
  invoice: "Tagihan (invoice)",
  rekrut: "Rekrut",
  kosongInvoice: "Belum ada invoice dalam 90 hari terakhir. Begitu invoice terbit, alurnya tergambar di sini.",
  langkahKosong: "Buat lowongan",
  kosongRekrut: "Belum ada lamaran dalam 90 hari terakhir. Begitu pelamar masuk, alurnya tergambar di sini.",
  alurKertas: "Alur kertas:",
  tidakAda: "Tidak ada penyimpangan dari alur kertas.",
  jalurSering: "Jalur yang paling sering terjadi",
  masihBerjalan: " (masih berjalan)",
  langkah: "Langkah ke langkah",
  caption: "Perpindahan antarlangkah {judul}: jumlah dan waktu tengah",
  dari: "Dari, lalu",
  kali: "Kali",
  biasanya: "Biasanya",
};

/** Satu alur (invoice atau rekrut): alur kertas, jalur yang benar-benar terjadi, langkah ke langkah, dan penyimpangan. */
export function KartuAlur({ alur, judul, teks: t = TEKS_ALUR_ID, bahasa = "id" }: { alur: Alur; judul: string; teks?: Kamus["alur"]; bahasa?: Bahasa }) {
  // Langkah, ringkasan, dan penyimpangan disusun lib/alur dalam bahasa Indonesia: di bahasa lain ditandai lang="id".
  const isiLang = bahasa === "id" ? undefined : "id";
  const ringkas = ringkasAlur(alur);
  const masalah = alur.penyimpangan.map(kalimatPenyimpangan).filter((k): k is string => k !== null);
  return (
    <div className="mt-6" data-testid={`alur-${alur.jenis}`}>
      <h3 className="font-semibold">{judul}</h3>
      {!ringkas ? (
        <p className="mt-2 text-sm text-tinta-2" data-testid="alur-kosong">{alur.jenis === "invoice" ? t.kosongInvoice : <>{t.kosongRekrut} <LangkahPertama href="/app/orang#judul-lowongan">{t.langkahKosong}</LangkahPertama></>}</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-tinta-2" data-testid="alur-ringkas" lang={isiLang}>
            {ringkas}
            {alur.siklus_hari !== null ? ` Dari awal sampai selesai biasanya ${formatHari(alur.siklus_hari)}.` : null}
          </p>
          <p className="mt-3 text-sm"><span className="text-tinta-2">{t.alurKertas}</span> <span lang={isiLang}>{jalurTeks(alur.kertas)}</span></p>

          {masalah.length > 0 ? (
            <ul className="mt-3 grid gap-2" data-testid="alur-penyimpangan" lang={isiLang}>
              {masalah.map((k) => (
                <li key={k} className="flex items-start gap-2 text-sm">
                  <WarningIcon size={18} aria-hidden className="mt-0.5 shrink-0" />
                  <span><span className="stabilo rounded px-1">{k}</span></span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 flex items-start gap-2 text-sm text-daun">
              <CheckCircleIcon size={18} aria-hidden className="mt-0.5 shrink-0" />
              <span>{t.tidakAda}</span>
            </p>
          )}

          <h4 className="mt-5 text-sm font-semibold">{t.jalurSering}</h4>
          <ul className="mt-2 divide-y divide-garis border-y border-garis" data-testid="alur-varian">
            {alur.varian.map((v) => (
              <li key={v.jalur.join(">")} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 break-words">
                  <span lang={isiLang}>{jalurTeks(v.jalur)}</span>
                  {!v.selesai ? <span className="text-tinta-2">{t.masihBerjalan}</span> : null}
                </span>
                <span className="angka shrink-0 font-semibold">{formatAngka(v.jumlah, bahasa)}</span>
              </li>
            ))}
          </ul>

          <h4 className="mt-5 text-sm font-semibold">{t.langkah}</h4>
          <table className="mt-2 w-full text-sm" data-testid="alur-sisi">
            <caption className="sr-only">{isiTeks(t.caption, { judul: judul.toLowerCase() })}</caption>
            <thead>
              <tr className="border-b border-garis text-left text-tinta-2">
                <th scope="col" className="py-2 font-normal">{t.dari}</th>
                <th scope="col" className="py-2 text-right font-normal">{t.kali}</th>
                <th scope="col" className="py-2 text-right font-normal">{t.biasanya}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-garis">
              {sisiBerurut(alur).map((s) => (
                <tr key={`${s.dari}>${s.ke}`}>
                  <td className="py-2 pr-2" lang={isiLang}>{labelLangkah(s.dari)} → {labelLangkah(s.ke)}</td>
                  <td className="angka py-2 text-right">{formatAngka(s.jumlah, bahasa)}</td>
                  <td className="py-2 pl-2 text-right whitespace-nowrap" lang={isiLang}>{formatHari(s.median_hari)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

/** Bagian "Alur nyata" berisi alur invoice dan rekrut. */
export function AlurNyata({ invoice, rekrut, testid = "alur-nyata", teks: t = TEKS_ALUR_ID, bahasa = "id" }: { invoice: Alur; rekrut: Alur; testid?: string; teks?: Kamus["alur"]; bahasa?: Bahasa }) {
  return (
    <section className="mt-10 border-t border-garis pt-6" aria-labelledby={`judul-${testid}`} data-testid={testid} lang={bahasa}>
      <h2 id={`judul-${testid}`} className="text-lg font-semibold">{t.judul}</h2>
      <p className="mt-1 text-sm text-tinta-2">{t.ket}</p>
      {bahasa !== "id" ? <p className="mt-1 text-sm text-tinta-2">{t.catatan}</p> : null}
      <KartuAlur alur={invoice} judul={t.invoice} teks={t} bahasa={bahasa} />
      <KartuAlur alur={rekrut} judul={t.rekrut} teks={t} bahasa={bahasa} />
    </section>
  );
}
