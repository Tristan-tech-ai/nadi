import { FAKTOR_IPIP, skorIpip, type Faktor } from "@/lib/rekrut/ipip";
import { buatUji, nilaiUji } from "@/lib/rekrut/uji-kerja";
import { Rupiah } from "@/components/ui/rupiah";
import { formatAngka } from "@/lib/format";

export type BarisUji = { jenis: "kerja" | "ipip"; topi_kode: string | null; benih: number | null; jawaban: unknown; selesai_at: string | null };

/** Hasil uji kerja (dinilai ulang dari benih) dan IPIP (skor resmi, tanpa tafsiran tinggi/rendah) di layar penilai. */
export function HasilUji({ baris }: { baris: BarisUji[] }) {
  const kerja = baris.find((b) => b.jenis === "kerja" && b.selesai_at && b.topi_kode && b.benih !== null);
  const ipip = baris.find((b) => b.jenis === "ipip" && b.selesai_at);
  const soal = kerja ? buatUji(kerja.topi_kode!, kerja.benih!) : null;
  const jawaban = Array.isArray(kerja?.jawaban) ? (kerja.jawaban as string[]) : [];
  const nilai = soal ? nilaiUji(soal, jawaban) : null;
  const isiIpip = ipip && ipip.jawaban && typeof ipip.jawaban === "object" ? (ipip.jawaban as Record<string, number>) : null;
  const skor = isiIpip ? skorIpip(Object.fromEntries(Object.entries(isiIpip).map(([k, v]) => [Number(k), v]))) : null;
  if (!soal && !skor) return null;

  return (
    <>
      {soal && nilai && (
        <section className="mt-6 rounded-[var(--radius-kartu)] border border-garis p-4" aria-labelledby="judul-hasil-uji" data-testid="hasil-uji-kerja">
          <h2 id="judul-hasil-uji" className="font-semibold">Uji kerja</h2>
          <p className="mt-1">
            Benar <span className="angka font-semibold" data-testid="uji-benar">{nilai.benar}</span> dari <span className="angka">{nilai.dari}</span> soal.
          </p>
          <ol className="mt-3 flex flex-col gap-3 text-sm">
            {soal.map((s, i) => (
              <li key={i} className="border-l-2 border-garis pl-3">
                <p>{s.teks}</p>
                <p className="mt-1">
                  Jawaban pelamar: <span className="angka font-semibold">{jawaban[i] || "kosong"}</span>{" "}
                  {nilai.per[i] ? <span className="text-daun">(benar)</span> : <span className="text-cap">(seharusnya {s.satuan === "rupiah" ? <Rupiah nilai={s.jawaban} /> : <span className="angka">{formatAngka(s.jawaban)} {s.satuan}</span>})</span>}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}
      {skor && (
        <section className="mt-6 rounded-[var(--radius-kartu)] border border-garis p-4" aria-labelledby="judul-ipip" data-testid="hasil-ipip">
          <h2 id="judul-ipip" className="font-semibold">Kenali dirimu (IPIP)</h2>
          <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
            {(Object.keys(FAKTOR_IPIP) as unknown as Faktor[]).map((f) => (
              <div key={f} className="contents">
                <dt>{FAKTOR_IPIP[f]}</dt>
                <dd className="angka text-right">{skor[f] === null ? <span className="text-tinta-2">belum lengkap</span> : `${skor[f]} dari 50`}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-tinta-2">
            Gambaran diri pelamar, bukan ukuran kemampuan kerja. Pakai sebagai bahan obrolan saat wawancara, jangan untuk menolak. Kestabilan emosi bukan diagnosis kesehatan.
          </p>
        </section>
      )}
    </>
  );
}
