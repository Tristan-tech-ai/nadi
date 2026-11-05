"use client";

import QRCode from "qrcode";
import { useActionState, useEffect, useId, useState } from "react";
import { catatAktivitasKeamanan } from "@/app/auth-actions";
import { beriPeran, simpanPeran, type HasilAkses } from "@/app/app/akun/keamanan/actions";
import { Tombol } from "@/components/ui/tombol";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Teks = Kamus["keamanan"];
const isian = "h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";

/** Nyalakan/matikan 2FA TOTP lewat Supabase MFA (enroll, challenge, verify, unenroll) langsung dari peramban. */
export function DuaLangkah({ teks: t }: { teks: Teks }) {
  const [aktif, setAktif] = useState<string | null | undefined>(undefined);
  const [baru, setBaru] = useState<{ id: string; qr: string; kunci: string } | null>(null);
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const idKode = useId();
  const muat = async () => {
    const { data } = await createBrowserSupabase().auth.mfa.listFactors();
    setAktif(data?.totp?.[0]?.id ?? null);
  };
  useEffect(() => { void createBrowserSupabase().auth.mfa.listFactors().then(({ data }) => setAktif(data?.totp?.[0]?.id ?? null)); }, []);

  const mulai = async () => {
    setPesan(null);
    setSibuk(true);
    const sb = createBrowserSupabase();
    // Faktor lama yang belum diverifikasi (pendaftaran terputus) dibuang dulu agar nama faktor tidak bentrok.
    const { data: semua } = await sb.auth.mfa.listFactors();
    for (const f of semua?.all ?? []) if (f.status !== "verified") await sb.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: `Nadi ${new Date().toISOString().slice(0, 10)}` });
    setSibuk(false);
    if (error || !data) return setPesan({ ok: false, teks: t.gagal });
    setBaru({ id: data.id, qr: await QRCode.toString(data.totp.uri, { type: "svg", margin: 1, errorCorrectionLevel: "M" }), kunci: data.totp.secret });
  };
  const aktifkan = async (f: FormData) => {
    if (!baru) return;
    setSibuk(true);
    const { error } = await createBrowserSupabase().auth.mfa.challengeAndVerify({ factorId: baru.id, code: String(f.get("kode") ?? "").replace(/\D/g, "") });
    setSibuk(false);
    if (error) return setPesan({ ok: false, teks: t.kodeSalah });
    await catatAktivitasKeamanan("2fa.aktif");
    setBaru(null);
    setPesan({ ok: true, teks: t.berhasilAktif });
    await muat();
  };
  const matikan = async () => {
    if (!aktif) return;
    setSibuk(true);
    const sb = createBrowserSupabase();
    const { error } = await sb.auth.mfa.unenroll({ factorId: aktif });
    if (!error) await sb.auth.refreshSession();
    setSibuk(false);
    if (error) return setPesan({ ok: false, teks: t.gagal });
    await catatAktivitasKeamanan("2fa.nonaktif");
    setPesan({ ok: true, teks: t.berhasilMati });
    await muat();
  };

  return (
    <div className="mt-3 text-sm" data-testid="dua-langkah" data-aktif={aktif ? "ya" : aktif === null ? "tidak" : ""}>
      {aktif === undefined ? <div aria-hidden className="h-10 w-64 animate-pulse rounded bg-kertas-2" /> : aktif ? (<>
        <p>{t.duaAktif}</p>
        <Tombol type="button" ragam="kedua" className="mt-3" disabled={sibuk} onClick={() => void matikan()}>{t.matikan}</Tombol>
      </>) : baru ? (
        <form action={aktifkan} className="grid max-w-sm gap-3" aria-label={t.aktifkan}>
          <p>{t.pindai}</p>
          <div role="img" aria-label={t.qr} className="h-48 w-48 bg-[white] p-2 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: baru.qr }} />
          <p className="text-tinta-2">{t.kunci}: <span className="angka break-all font-mono" data-testid="kunci-2fa">{baru.kunci}</span></p>
          <label htmlFor={idKode} className="text-tinta-2">{t.kode}</label>
          <input id={idKode} name="kode" required inputMode="numeric" autoComplete="one-time-code" maxLength={7} className={`${isian} angka w-40 tracking-widest`} />
          <div><Tombol type="submit" disabled={sibuk}>{t.aktifkan}</Tombol></div>
        </form>
      ) : (<>
        <p className="text-tinta-2">{t.duaMati}</p>
        <Tombol type="button" className="mt-3" disabled={sibuk} onClick={() => void mulai()}>{t.nyalakan}</Tombol>
      </>)}
      {pesan && <p role={pesan.ok ? "status" : "alert"} className={`mt-2 ${pesan.ok ? "text-daun" : "text-cap"}`}>{pesan.teks}</p>}
    </div>
  );
}

export function KeluarLain({ teks: t }: { teks: Teks }) {
  const [selesai, setSelesai] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
      <Tombol type="button" ragam="kedua" disabled={sibuk} onClick={async () => {
        setSibuk(true);
        const { error } = await createBrowserSupabase().auth.signOut({ scope: "others" });
        if (!error) { await catatAktivitasKeamanan("sesi.cabut"); setSelesai(true); window.location.reload(); }
        setSibuk(false);
      }}>{t.keluarLain}</Tombol>
      {selesai && <p role="status" className="text-daun">{t.sesiKeluar}</p>}
    </div>
  );
}

function Hasil({ h }: { h: HasilAkses }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="w-full text-cap">{h.galat}</p> : <p role="status" className="w-full text-daun">{h.pesan}</p>;
}

export function FormPeran({ izin, teks: t }: { izin: string[]; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilAkses, FormData>(simpanPeran, null);
  const id = useId();
  return (
    <form action={aksi} className="mt-3 grid gap-3 text-sm" aria-label={t.peranJudul} key={h && "pesan" in h ? h.pesan : "f"}>
      <div className="flex max-w-sm flex-col gap-1"><label htmlFor={id} className="text-tinta-2">{t.namaPeran}</label><input id={id} name="nama" required minLength={2} maxLength={60} className={isian} /></div>
      <fieldset className="grid gap-2"><legend className="sr-only">{t.peranJudul}</legend>
        {izin.map((z) => <label key={z} className="flex items-center gap-2"><input type="checkbox" name="izin" value={z} className="h-5 w-5" />{t.izinNama[z as keyof Teks["izinNama"]]}</label>)}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3"><Tombol type="submit" disabled={sibuk}>{t.simpanPeran}</Tombol><Hasil h={h} /></div>
    </form>
  );
}

export function PilihPeran({ user, nama, nilai, peran, teks: t }: { user: string; nama: string; nilai: string; peran: { id: string; name: string }[]; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilAkses, FormData>(beriPeran, null);
  const id = useId();
  const label = isiTeks(t.beriPeran, { nama });
  return (
    <form action={aksi} className="flex flex-wrap items-end gap-2 text-sm" aria-label={label}>
      <input type="hidden" name="user" value={user} />
      <div className="flex flex-col gap-1"><label htmlFor={id} className="text-tinta-2">{label}</label>
        <select id={id} name="peran" defaultValue={nilai} className={isian}><option value="">{t.tanpaPeran}</option>
          {peran.map((p) => <option key={p.id} value={p.id} data-pengguna>{p.name}</option>)}</select></div>
      <Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.simpanPeran}</Tombol>
      <Hasil h={h} />
    </form>
  );
}
