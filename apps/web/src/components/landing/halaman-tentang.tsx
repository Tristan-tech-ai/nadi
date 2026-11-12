import Link from "next/link";
import { Bagian, HalamanInfo } from "@/components/landing/halaman-info";
import { awalanJalur, type Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus } from "@/lib/i18n/kamus";
import { SUREL_KONTAK } from "@/lib/situs";

const TAUTAN = "font-semibold text-tinta underline underline-offset-4";

/** Halaman tentang dua bahasa (D-15, I-03). Usaha contoh tetap berbahasa Indonesia. */
export function HalamanTentang({ bahasa }: { bahasa: Bahasa }) {
  const k = ambilKamus(bahasa).tentangHalaman;
  return (
    <HalamanInfo bahasa={bahasa} warna="cap" judul={k.judul} pengantar={k.pengantar}>
      <Bagian judul={k.kenapaJudul}>
        {k.kenapa.map((p) => <p key={p}>{p}</p>)}
      </Bagian>
      <Bagian judul={k.caraJudul}>
        <ul className="list-disc space-y-1 pl-5">
          {k.cara.map((x) => <li key={x}>{x}</li>)}
        </ul>
      </Bagian>
      <Bagian judul={k.siapaJudul}>
        <p>
          {k.siapaAwal}{" "}
          <Link href="/demo" className={TAUTAN} hrefLang="id">{k.siapaDemo}</Link> {k.siapaTengah}{" "}
          <Link href={`${awalanJalur(bahasa)}/panduan`} className={TAUTAN}>{k.siapaPanduan}</Link>{k.siapaAkhir}
        </p>
        <p data-testid="kontak-nadi">{k.kontak} <a href={`mailto:${SUREL_KONTAK}`} className={TAUTAN}>{SUREL_KONTAK}</a></p>
      </Bagian>
    </HalamanInfo>
  );
}
