"use client";

import { useId, useState } from "react";
import { Tombol } from "@/components/ui/tombol";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { sidikTeks } from "@/lib/tanda";

const isian = "w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 py-2 text-base";

/**
 * Tanda tangan dari perangkat penanda tangan sendiri: RPC dipanggil langsung dari peramban sehingga alamat jaringan dan perangkat
 * yang tercatat di jejak bukti adalah milik penanda tangan, bukan server Nadi.
 */
export function FormTanda({ token, nama, kode, teks: t }: { token: string; nama: string; kode: string; teks: Kamus["tandaPublik"] }) {
  const [ketik, setKetik] = useState("");
  const [setuju, setSetuju] = useState(false);
  const [alasan, setAlasan] = useState("");
  const [tolak, setTolak] = useState(false);
  const [hasil, setHasil] = useState<"ok" | "tolak" | null>(null);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const id = { nama: useId(), alasan: useId() };
  const kirim = async () => {
    setSibuk(true); setGalat("");
    const { error } = await createBrowserSupabase().rpc("sign_document", { p_token: token, p_nama_ketik: ketik, p_setuju: setuju });
    setSibuk(false);
    if (error) return setGalat(error.message);
    setHasil("ok");
  };
  const kirimTolak = async () => {
    setSibuk(true); setGalat("");
    const { error } = await createBrowserSupabase().rpc("decline_sign", { p_token: token, p_alasan: alasan });
    setSibuk(false);
    if (error) return setGalat(error.message);
    setHasil("tolak");
  };
  if (hasil) return (
    <div className="mt-6" role="status" data-testid="hasil-tanda">
      <p className="font-semibold">{hasil === "ok" ? t.berhasil : t.ditolak}</p>
      <a href={`/tanda/cek/${kode}`} className="mt-2 inline-block text-laut underline underline-offset-2">{t.cek}</a>
    </div>
  );
  return (
    <div className="mt-6 grid gap-4">
      <div className="flex flex-col gap-1"><label htmlFor={id.nama} className="text-sm text-tinta-2">{isiTeks(t.ketikNama, { nama })}</label>
        <input id={id.nama} value={ketik} onChange={(e) => setKetik(e.target.value)} autoComplete="name" className={isian} /></div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={setuju} onChange={(e) => setSetuju(e.target.checked)} className="mt-0.5 h-5 w-5" /><span>{t.setuju}</span></label>
      <div className="flex flex-wrap items-center gap-3">
        <Tombol type="button" disabled={sibuk || !setuju || !ketik.trim()} onClick={kirim}>{t.tandatangani}</Tombol>
        <Tombol type="button" ragam="kedua" onClick={() => setTolak((x) => !x)}>{t.tolak}</Tombol>
      </div>
      {tolak && (
        <div className="grid gap-2">
          <label htmlFor={id.alasan} className="text-sm text-tinta-2">{t.alasan}</label>
          <textarea id={id.alasan} value={alasan} onChange={(e) => setAlasan(e.target.value)} rows={2} maxLength={300} className={isian} />
          <div><Tombol type="button" ragam="kedua" disabled={sibuk || alasan.trim().length < 3} onClick={kirimTolak}>{t.kirimTolak}</Tombol></div>
        </div>
      )}
      {galat && <p role="alert" className="text-sm text-cap">{galat}</p>}
    </div>
  );
}

/** Cocokkan salinan: sidik SHA-256 dihitung di perangkat ini; hanya sidiknya yang dikirim, bukan isi salinan. */
export function CocokkanSalinan({ kode, teks: t }: { kode: string; teks: Kamus["cekTanda"] }) {
  const [isi, setIsi] = useState("");
  const [cocok, setCocok] = useState<boolean | null>(null);
  const id = useId();
  const periksa = async () => {
    const sidik = await sidikTeks(isi.trim());
    const { data } = await createBrowserSupabase().rpc("verify_sign", { p_kode: kode, p_sidik: sidik });
    setCocok((data as { salinan_cocok: boolean | null } | null)?.salinan_cocok ?? false);
  };
  return (
    <div className="mt-3 grid gap-2">
      <label htmlFor={id} className="text-sm text-tinta-2">{t.tempel}</label>
      <textarea id={id} value={isi} onChange={(e) => { setIsi(e.target.value); setCocok(null); }} rows={5} className={isian} />
      <div><Tombol type="button" ragam="kedua" disabled={!isi.trim()} onClick={periksa}>{t.periksa}</Tombol></div>
      {cocok !== null && <p role="status" className={`text-sm font-semibold ${cocok ? "text-daun" : "text-cap"}`} data-testid="hasil-cocok">{cocok ? t.cocok : t.tidakCocok}</p>}
    </div>
  );
}
