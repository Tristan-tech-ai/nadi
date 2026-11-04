"use client";

import { useEffect, useState } from "react";
import { Tombol } from "@/components/ui/tombol";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Teks = Kamus["wawancaraKeluar"];
type Info = { usaha: string; nama: string; sudah: boolean };
const isian = "rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas p-2 text-base";

/** Tiga pertanyaan tetap, sekali kirim lewat RPC anon dengan token dari fragmen URL. */
export function FormKeluar({ teks: t, bahasa }: { teks: Teks; bahasa: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [terkirim, setTerkirim] = useState(false);
  const db = (pesan: string) => (bahasa === "id" ? pesan : isiTeks(t.galatDb, { pesan }));

  useEffect(() => {
    let batal = false;
    // Token hanya ada di fragmen URL (tidak terlihat server); dibaca setelah mount, state diisi setelah await.
    (async () => {
      await Promise.resolve();
      const tok = decodeURIComponent(window.location.hash.slice(1));
      if (!/^nmw_[0-9a-f]{64}$/.test(tok)) { if (!batal) setGalat(t.tautanSalah); return; }
      const { data, error } = await createBrowserSupabase().rpc("buka_wawancara_keluar", { p_token: tok });
      if (batal) return;
      setToken(tok);
      if (error) setGalat(t.tautanSalah);
      else setInfo(data as Info);
    })();
    return () => { batal = true; };
  }, [t.tautanSalah]);

  async function kirim(form: FormData) {
    if (!token) return;
    setGalat("");
    setSibuk(true);
    const { error } = await createBrowserSupabase().rpc("kirim_wawancara_keluar", {
      p_token: token, p_membantu: String(form.get("membantu") ?? ""), p_berat: String(form.get("berat") ?? ""), p_ubah: String(form.get("ubah") ?? ""),
    });
    setSibuk(false);
    if (error) return setGalat(error.code === "22023" || error.code === "23505" ? db(error.message) : t.gagal);
    setTerkirim(true);
  }

  if (galat && !info) return <p role="alert" className="mt-4 text-tinta-2" data-testid="keluar-galat">{galat}</p>;
  if (!info) return <p className="mt-4 text-tinta-2">{t.memuat}</p>;
  if (terkirim || info.sudah) return <p role="status" className="mt-4" data-testid="keluar-terkirim">{terkirim ? t.terkirim : t.sudah}</p>;
  return (
    <>
      <p className="mt-2 text-tinta-2">{isiTeks(t.sapa, { nama: info.nama, namaUsaha: info.usaha })}</p>
      <p className="mt-3 rounded-[var(--radius-isian)] bg-kertas-2 p-3 font-semibold" data-testid="tidak-memengaruhi">{t.tidakMemengaruhi}</p>
      <form action={kirim} className="mt-6 flex flex-col gap-4" aria-label={t.metaJudul}>
        {(["membantu", "berat", "ubah"] as const).map((k) => (
          <label key={k} className="flex flex-col gap-1"><span className="font-medium">{t[k]}</span>
            <textarea name={k} rows={3} maxLength={1000} className={isian} /></label>
        ))}
        <p className="text-sm text-tinta-2">{t.bolehKosong}</p>
        <Tombol type="submit" ukuran="besar" disabled={sibuk} data-testid="kirim-keluar">{sibuk ? t.mengirim : t.kirim}</Tombol>
        {galat ? <p role="alert" className="text-sm text-cap">{galat}</p> : null}
      </form>
    </>
  );
}
