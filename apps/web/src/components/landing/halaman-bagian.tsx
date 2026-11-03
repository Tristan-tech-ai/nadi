import { Bagian, HalamanInfo } from "@/components/landing/halaman-info";
import type { Bahasa } from "@/lib/i18n/bahasa";

export type IsiHalamanBagian = {
  judul: string;
  pengantar: string;
  draf?: string;
  bagian: { judul: string; isi: string[]; daftar: string[] }[];
};

/** Halaman publik berupa bagian berjudul (privasi, syarat), dua bahasa (I-03). Teks dari kamus. */
export function HalamanBagian({ bahasa, isi }: { bahasa: Bahasa; isi: IsiHalamanBagian }) {
  return (
    <HalamanInfo bahasa={bahasa} judul={isi.judul} pengantar={isi.pengantar} draf={isi.draf}>
      {isi.bagian.map((b) => (
        <Bagian key={b.judul} judul={b.judul}>
          {b.isi.map((p) => <p key={p}>{p}</p>)}
          {b.daftar.length ? (
            <ul className="list-disc space-y-1 pl-5">
              {b.daftar.map((x) => <li key={x}>{x}</li>)}
            </ul>
          ) : null}
        </Bagian>
      ))}
    </HalamanInfo>
  );
}
