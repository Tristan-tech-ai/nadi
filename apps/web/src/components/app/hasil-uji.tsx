import { FAKTOR_IPIP, skorIpip, type Faktor } from "@/lib/rekrut/ipip";
import { buatUji, nilaiUji } from "@/lib/rekrut/uji-kerja";
import { Rupiah } from "@/components/ui/rupiah";
import { formatAngka } from "@/lib/format";
import { isiTeks, type Kamus } from "@/lib/i18n/kamus";
import { sisip } from "@/lib/i18n/sisip";

export type BarisUji = { jenis: "kerja" | "ipip"; topi_kode: string | null; benih: number | null; jawaban: unknown; selesai_at: string | null };

/** Hasil uji kerja (dinilai ulang dari benih) dan IPIP (skor resmi, tanpa tafsiran tinggi/rendah) di layar penilai. */
export function HasilUji({ baris, teks: t, bahasa = "id" }: { baris: BarisUji[]; teks: Kamus["wawancara"]; bahasa?: "id" | "en" }) {
  const isiLang = bahasa === "id" ? undefined : "id";
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
          <h2 id="judul-hasil-uji" className="font-semibold">{t.ujiKerja}</h2>
          <p className="mt-1">
            {sisip(t.benar, { benar: <span className="angka font-semibold" data-testid="uji-benar">{nilai.benar}</span>, dari: <span className="angka">{nilai.dari}</span> })}
          </p>
          <ol className="mt-3 flex flex-col gap-3 text-sm">
            {soal.map((s, i) => (
              <li key={i} className="border-l-2 border-garis pl-3">
                <p lang={isiLang}>{s.teks}</p>
                <p className="mt-1">
                  {t.jawabanPelamar} <span className="angka font-semibold" data-pengguna>{jawaban[i] || t.kosong}</span>{" "}
                  {nilai.per[i] ? <span className="text-daun">{t.benarKecil}</span> : <span className="text-cap">{sisip(t.seharusnya, { nilai: s.satuan === "rupiah" ? <Rupiah nilai={s.jawaban} /> : <span className="angka">{formatAngka(s.jawaban, bahasa)} <span lang={isiLang}>{s.satuan}</span></span> })}</span>}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}
      {skor && (
        <section className="mt-6 rounded-[var(--radius-kartu)] border border-garis p-4" aria-labelledby="judul-ipip" data-testid="hasil-ipip">
          <h2 id="judul-ipip" className="font-semibold">{t.ipip}</h2>
          <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
            {(Object.keys(FAKTOR_IPIP) as unknown as Faktor[]).map((f) => (
              <div key={f} className="contents">
                <dt lang={isiLang}>{FAKTOR_IPIP[f]}</dt>
                <dd className="angka text-right">{skor[f] === null ? <span className="text-tinta-2">{t.belumLengkap}</span> : isiTeks(t.dari50, { n: skor[f] })}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-tinta-2">
            {t.ipipKet}
          </p>
        </section>
      )}
    </>
  );
}
