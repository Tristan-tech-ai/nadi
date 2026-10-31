"use client";

import { useEffect, useState } from "react";
import { Tombol } from "@/components/ui/tombol";
import { buatUji, type Soal } from "@/lib/rekrut/uji-kerja";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const isian = "h-12 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base";
const SATUAN = { rupiah: "Rupiah", gram: "Gram", ml: "Mililiter", buah: "Buah" } as const;

type Keadaan = { jenis: "memuat" } | { jenis: "tidak-ada" } | { jenis: "isi"; soal: Soal[] } | { jenis: "terkirim" } | { jenis: "galat"; pesan: string };

/** Uji kerja sesuai topi lowongan (F2-04). Benih dari database, soal disusun di sini; nilai dihitung ulang server saat dinilai. */
export function UjiKerja({ lamaran }: { lamaran: string }) {
  const [k, setK] = useState<Keadaan>({ jenis: "memuat" });
  const [isi, setIsi] = useState<string[]>([]);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    let batal = false;
    createBrowserSupabase()
      .rpc("uji_mulai", { p_lamaran: lamaran })
      .then(({ data, error }) => {
        if (batal) return;
        if (error) return setK({ jenis: "galat", pesan: error.message });
        const d = data as { topi: string; benih: number; selesai: boolean } | null;
        const soal = d ? buatUji(d.topi, d.benih) : null;
        if (!d || !soal) return setK({ jenis: "tidak-ada" });
        if (d.selesai) return setK({ jenis: "terkirim" });
        setIsi(soal.map(() => ""));
        setK({ jenis: "isi", soal });
      });
    return () => {
      batal = true;
    };
  }, [lamaran]);

  if (k.jenis === "memuat") return <div className="mt-6 h-40 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />;
  if (k.jenis === "tidak-ada") return null;

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    if (isi.some((x) => !x.trim())) return setGalat("Isi semua jawaban dulu. Tulis angkanya saja, misalnya 12500.");
    setSibuk(true);
    setGalat(null);
    const { error } = await createBrowserSupabase().rpc("uji_kirim", { p_lamaran: lamaran, p_jenis: "kerja", p_jawaban: isi.map((x) => x.trim()) });
    setSibuk(false);
    if (error) return setGalat(error.code === "23505" ? "Jawaban ini sudah terkirim sebelumnya." : `${error.message} Coba kirim lagi.`);
    setK({ jenis: "terkirim" });
  }

  return (
    <section className="mt-6 rounded-[var(--radius-kartu)] border border-garis p-5" aria-labelledby="judul-uji" data-testid="uji-kerja">
      <h2 id="judul-uji" className="text-lg font-semibold">Uji kerja singkat</h2>
      {k.jenis === "terkirim" ? (
        <p role="status" className="mt-1" data-testid="uji-terkirim">Jawaban uji kerja terkirim. Terima kasih.</p>
      ) : k.jenis === "galat" ? (
        <p role="alert" className="mt-1 text-cap">{k.pesan}</p>
      ) : (
        <form onSubmit={kirim} className="mt-1 flex flex-col gap-4" noValidate>
          <p className="text-tinta-2">Tiga soal hitungan seperti pekerjaan sehari-hari. Boleh pakai kalkulator. Tulis angkanya saja.</p>
          <ol className="flex flex-col gap-4">
            {k.soal.map((s, i) => (
              <li key={i} className="rounded-[var(--radius-kartu)] bg-kertas-2 p-4">
                <label className="flex flex-col gap-2">
                  <span><span className="text-sm text-tinta-2">Soal {i + 1}. </span>{s.teks}</span>
                  <span className="text-sm text-tinta-2">Jawaban ({SATUAN[s.satuan]})</span>
                  <input
                    className={isian}
                    inputMode={s.satuan === "buah" ? "text" : "numeric"}
                    autoComplete="off"
                    value={isi[i] ?? ""}
                    onChange={(e) => setIsi((x) => x.map((v, j) => (j === i ? e.target.value : v)))}
                    data-testid={`uji-jawaban-${i}`}
                  />
                </label>
              </li>
            ))}
          </ol>
          {galat && <p role="alert" className="text-sm text-cap">{galat}</p>}
          <Tombol type="submit" disabled={sibuk} className="self-start" data-testid="kirim-uji">{sibuk ? "Mengirim..." : "Kirim jawaban uji"}</Tombol>
        </form>
      )}
    </section>
  );
}
