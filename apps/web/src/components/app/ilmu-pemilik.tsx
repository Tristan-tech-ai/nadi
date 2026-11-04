"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { simpanLangkahIlmu, simpanTranskripIlmu, susunLangkahIlmu, type HasilIlmu } from "@/app/app/serah-terima/actions";
import { Tombol } from "@/components/ui/tombol";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";
import { transkripsi, type ModelTranskrip } from "@/lib/wawancara/transkrip";

type Teks = Kamus["ilmuPemilik"];
export type IlmuTampil = { id: string; judul: string; url: string | null; transkrip: string | null; langkah: string[] | null; sumber: "model" | "pemilik" | null };
type Keadaan = { jenis: "diam" } | { jenis: "unduh"; persen: number } | { jenis: "dengar" } | { jenis: "galat"; pesan: string };

/** F3-07C: pemilik/admin mendengar klip penjelasan, membuat transkrip di perangkat, menyusun langkah (model ringan lewat Edge
 *  Function, masukan tak tepercaya), lalu mengedit dan menyimpannya. Klip asli selalu tampil. */
export function IlmuPemilik({ ilmu, model, teks: t, bahasa }: { ilmu: IlmuTampil; model: ModelTranskrip | null; teks: Teks; bahasa: string }) {
  const router = useRouter();
  const [k, setK] = useState<Keadaan>({ jenis: "diam" });
  const [menyusun, setMenyusun] = useState(false);
  const [galatSusun, setGalatSusun] = useState("");
  const [h, aksi, sibuk] = useActionState<HasilIlmu, FormData>(simpanLangkahIlmu, {});
  const isiLang = bahasa === "id" ? undefined : "id";
  const langkah = h.ok && h.langkah ? h.langkah : ilmu.langkah;

  async function transkrip() {
    if (!ilmu.url || !model) return;
    setK({ jenis: "dengar" });
    try {
      const teks = await transkripsi(ilmu.url, model, (persen) => setK({ jenis: "unduh", persen }));
      setK({ jenis: "dengar" });
      const r = await simpanTranskripIlmu(ilmu.id, teks);
      if (r.galat) return setK({ jenis: "galat", pesan: r.galat });
      setK({ jenis: "diam" });
      router.refresh();
    } catch {
      setK({ jenis: "galat", pesan: t.transkripGagal });
    }
  }

  async function susun() {
    setGalatSusun("");
    setMenyusun(true);
    const r = await susunLangkahIlmu(ilmu.id);
    setMenyusun(false);
    if (r.galat) return setGalatSusun(r.galat);
    router.refresh();
  }

  const sibukTranskrip = k.jenis === "unduh" || k.jenis === "dengar";
  return (
    <div className="mt-2 flex w-full flex-col gap-3 rounded-[var(--radius-isian)] bg-kertas-2 p-3" data-testid="ilmu-pemilik">
      {ilmu.url ? <audio controls preload="none" src={ilmu.url} className="w-full" aria-label={isiTeks(t.klipAria, { judul: ilmu.judul })} /> : <p className="text-sm text-cap">{t.klipGagal}</p>}
      {model ? (
        <div className="flex flex-col gap-1">
          <Tombol ragam="kedua" onClick={transkrip} disabled={sibukTranskrip || !ilmu.url} className="self-start" data-testid="transkrip-ilmu">
            {sibukTranskrip ? t.mentranskrip : ilmu.transkrip ? t.transkripUlang : t.buatTranskrip}
          </Tombol>
          <p className="text-sm text-tinta-2" aria-live="polite">
            {k.jenis === "unduh" ? isiTeks(t.mengunduh, { n: Math.round(k.persen) }) : k.jenis === "dengar" ? t.mendengar : k.jenis === "galat" ? <span role="alert" className="text-cap">{k.pesan}</span> : null}
          </p>
        </div>
      ) : <p className="text-sm text-tinta-2">{t.tanpaModel}</p>}
      {ilmu.transkrip ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-tinta-2">{t.transkrip}</summary>
          <p className="mt-1 whitespace-pre-line" lang={isiLang} data-pengguna data-testid="transkrip-ilmu-teks">{ilmu.transkrip}</p>
        </details>
      ) : null}
      <div className="flex flex-col gap-1">
        <Tombol ragam="kedua" onClick={susun} disabled={menyusun || !ilmu.transkrip} className="self-start" data-testid="susun-langkah">{menyusun ? t.menyusun : t.susun}</Tombol>
        {!ilmu.transkrip ? <p className="text-xs text-tinta-2">{t.perluTranskrip}</p> : null}
        {galatSusun ? <p role="alert" className="text-sm text-cap">{galatSusun}</p> : null}
      </div>
      {langkah?.length ? (
        <div>
          <p className="font-semibold">{t.langkah}</p>
          <ol className="mt-1 list-decimal pl-5 text-sm" lang={isiLang} data-pengguna data-testid="langkah-ilmu">
            {langkah.map((l, i) => <li key={i}>{l}</li>)}
          </ol>
          <p className="mt-1 text-xs text-tinta-2">{(h.ok ? "pemilik" : ilmu.sumber) === "model" ? t.catatanModel : t.catatanPemilik}</p>
        </div>
      ) : null}
      <details className="text-sm">
        <summary className="cursor-pointer text-tinta-2">{t.edit}</summary>
        <form action={aksi} className="mt-2 flex flex-col gap-2">
          <input type="hidden" name="butir" value={ilmu.id} />
          <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.editLabel}</span>
            <textarea name="langkah" rows={5} defaultValue={(langkah ?? []).join("\n")} className="rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas p-2 text-base" data-testid="edit-langkah" /></label>
          <div className="flex flex-wrap items-center gap-3">
            <Tombol type="submit" ragam="kedua" disabled={sibuk}>{sibuk ? t.menyimpan : t.simpan}</Tombol>
            {h.ok ? <p role="status" className="text-sm text-daun">{t.tersimpan}</p> : h.galat ? <p role="alert" className="text-sm text-cap">{h.galat}</p> : null}
          </div>
        </form>
      </details>
    </div>
  );
}
