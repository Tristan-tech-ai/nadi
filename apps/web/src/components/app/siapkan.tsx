"use client";

import { useActionState, useMemo, useState } from "react";
import { jadikanDraf, type HasilDraf } from "@/app/app/siapkan/draf-actions";
import { Tombol } from "@/components/ui/tombol";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";
import { barisDariButir } from "@/lib/onboarding/draf";
import { uraiTeksNadi } from "@/lib/onboarding/teks-nadi";

type Teks = Kamus["siapkan"];

export function TombolSalinTeks({ teks, label, labelSudah }: { teks: string; label: string; labelSudah: string }) {
  const [sudah, setSudah] = useState(false);
  return (
    <Tombol type="button" ragam="kedua" onClick={async () => { try { await navigator.clipboard.writeText(teks); setSudah(true); setTimeout(() => setSudah(false), 2500); } catch { setSudah(false); } }}>
      <span aria-live="polite">{sudah ? labelSudah : label}</span>
    </Tombol>
  );
}

/** Kotak tempel Teks Nadi dengan pratinjau per baris (aturan yang sama dengan server), lalu jadikan SATU draf untuk ditinjau (U-04). */
export function TempelHasil({ hari, teks: t }: { hari: string; kunci?: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilDraf, FormData>(jadikanDraf, null);
  const [isi, setIsi] = useState("");
  const urai = useMemo(() => (isi.trim() ? uraiTeksNadi(isi, hari) : null), [isi, hari]);
  const dikenali = urai?.baris.filter((b) => b.dikenali).length ?? 0;
  const nDraf = urai ? barisDariButir(urai.butir).length : 0;
  return (
    <form action={aksi} className="mt-3 grid gap-3 text-sm" aria-label={t.tempelAria}>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.tempelLabel}</span>
        <textarea name="teks" rows={10} value={isi} onChange={(e) => setIsi(e.target.value)} maxLength={20000} spellCheck={false}
          className="rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas p-2 font-mono text-sm" /></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.atauBerkas}</span>
        <input type="file" accept=".txt,.md,.json,text/plain,text/markdown,application/json" className="w-full max-w-full text-base"
          onChange={async (e) => { const f = e.target.files?.[0]; if (f && f.size <= 200_000) setIsi(await f.text()); }} /></label>
      {urai && (
        <div aria-live="polite">
          {urai.galat ? <p role="alert" className="text-cap">{t.galat[urai.galat as keyof typeof t.galat] ?? t.galat.tak_dikenal}</p> : (
            <>
              <p className="font-semibold">{isiTeks(t.ringkas, { a: nDraf, b: dikenali, c: urai.baris.length - dikenali })}</p>
              <ul className="mt-2 divide-y divide-garis border-y border-garis" data-testid="pratinjau-teks-nadi">
                {urai.baris.map((b) => (
                  <li key={b.no} className="flex flex-wrap items-baseline gap-2 py-1.5" data-dikenali={b.dikenali ? "ya" : "tidak"}>
                    <span className={`font-semibold ${b.dikenali ? "text-daun" : "text-cap"}`}>{b.dikenali ? t.dikenali : t.ditolak}</span>
                    <span className="font-mono break-all" data-pengguna>{b.teks}</span>
                    {!b.dikenali && <span className="text-tinta-2">{t.galat[b.alasan as keyof typeof t.galat] ?? t.galat.tak_dikenal}</span>}
                    {b.dikenali && b.detail && <span className="text-tinta-2">{isiTeks(t.fiturAsing, { list: b.detail })}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Tombol type="submit" disabled={sibuk || !nDraf}>{nDraf ? isiTeks(t.jadikan, { n: nDraf }) : t.jadikanKosong}</Tombol>
        {h?.galat && <p role="alert" className="text-cap">{h.galat}</p>}
      </div>
    </form>
  );
}
