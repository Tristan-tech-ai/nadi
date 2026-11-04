import { Bagian, HalamanInfo } from "@/components/landing/halaman-info";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus } from "@/lib/i18n/kamus";

// Halaman keamanan dua bahasa (D-15, I-03). Setiap klaim punya bukti di repo; lihat docs/quality/keamanan-f0.md.
export function HalamanKeamanan({ bahasa }: { bahasa: Bahasa }) {
  const k = ambilKamus(bahasa).keamananHalaman;
  return (
    <HalamanInfo bahasa={bahasa} warna="laut" judul={k.judul} pengantar={k.pengantar}>
      {k.bagian.map((b) => (
        <Bagian key={b.judul} judul={b.judul}>
          {b.isi.map((p) => <p key={p}>{p}</p>)}
        </Bagian>
      ))}
    </HalamanInfo>
  );
}
