import { Bagian, HalamanInfo } from "@/components/landing/halaman-info";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { SUREL_KONTAK } from "@/lib/situs";

/** Alamat kontak di dalam kalimat menjadi tautan email. */
function Kalimat({ teks }: { teks: string }) {
  const i = teks.indexOf(SUREL_KONTAK);
  if (i < 0) return <>{teks}</>;
  return <>{teks.slice(0, i)}<a href={`mailto:${SUREL_KONTAK}`} className="font-semibold underline underline-offset-4">{SUREL_KONTAK}</a>{teks.slice(i + SUREL_KONTAK.length)}</>;
}

export type IsiHalamanBagian = {
  judul: string;
  pengantar: string;
  draf?: string;
  bagian: { judul: string; isi: string[]; daftar: string[] }[];
};

/** Halaman publik berupa bagian berjudul (privasi, syarat), dua bahasa (I-03). Teks dari kamus. */
export function HalamanBagian({ bahasa, isi }: { bahasa: Bahasa; isi: IsiHalamanBagian }) {
  return (
    <HalamanInfo bahasa={bahasa} warna="tulang" judul={isi.judul} pengantar={isi.pengantar} draf={isi.draf}>
      {isi.bagian.map((b) => (
        <Bagian key={b.judul} judul={b.judul}>
          {b.isi.map((p) => <p key={p}><Kalimat teks={p} /></p>)}
          {b.daftar.length ? (
            <ul className="list-disc space-y-1 pl-5">
              {b.daftar.map((x) => <li key={x}><Kalimat teks={x} /></li>)}
            </ul>
          ) : null}
        </Bagian>
      ))}
    </HalamanInfo>
  );
}
