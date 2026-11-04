import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { formatPersen } from "@/lib/format";
import { ambilKamus, type Kamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { sisip } from "@/lib/i18n/sisip";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { FormGajiOrang, type GajiOrang, type RekeningOrang } from "@/components/app/aksi-gaji";
import { BANK_SKN } from "@/lib/gaji/transfer";
import { KartuLowongan } from "@/components/app/lowongan";
import { LingkaranRekrut } from "@/components/app/lingkaran-rekrut";
import { FormAkunStaf, FormTambahOrang } from "./form-orang";

export const metadata: Metadata = { title: "Orang" };

type PakaiTopi = { porsi: number; selesai: string | null; topi: { nama: string } | null };

/** Topi yang sedang dipakai, mis. "Kasir 50% · Gudang 50%". Topi = peran kerja; satu orang bisa memakai beberapa. */
function TopiOrang({ pakai, t }: { pakai: PakaiTopi[]; t: Kamus["orang"] }) {
  const aktif = (pakai ?? []).filter((p) => !p.selesai && p.topi).sort((a, b) => b.porsi - a.porsi);
  if (!aktif.length) return <p className="mt-1 text-sm text-tinta-2">{t.belumTopi}</p>;
  return (
    <ul className="mt-1 flex flex-wrap gap-1.5" aria-label={t.topiAria} data-testid="topi-orang">
      {aktif.map((p) => (
        <li key={p.topi!.nama} className="rounded-full border border-garis px-2 py-0.5 text-xs">
          <span data-pengguna>{p.topi!.nama}</span> <span className="angka text-tinta-2">{formatPersen(p.porsi / 100)}</span>
        </li>
      ))}
    </ul>
  );
}

async function Isi() {
  const sesi = await wajibPerusahaan();
  const bahasa = await bahasaAplikasi(sesi.bahasa);
  const kamus = ambilKamus(bahasa);
  const t = kamus.orang;
  if (sesi.peran !== "pemilik" && sesi.peran !== "admin") {
    return (
      <section className="mx-auto w-full max-w-xl px-5 py-10" lang={bahasa}>
        <h1 className="font-judul text-3xl font-extrabold tracking-tight">{t.khususJudul}</h1>
        <p className="mt-2 text-tinta-2" data-testid="ditolak">{t.khususKet}</p>
      </section>
    );
  }
  const supabase = await createClient();
  const [{ data: orang }, { data: usaha }] = await Promise.all([
    supabase.from("orang").select("id, nama, id_staf, user_id, data, pakai_topi(porsi, selesai, topi(nama)), orang_rahasia(gaji, bank, rekening, atas_nama)").order("dibuat_at", { ascending: true }),
    supabase.from("perusahaan").select("kode").eq("id", sesi.perusahaanId).maybeSingle(),
  ]);
  return (
    <section className="mx-auto w-full max-w-2xl px-5 py-10" lang={bahasa}>
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">{t.judul}</h1>
      <p className="mt-2 text-tinta-2">
        {sisip(t.kodeUsaha, { kode: <span className="font-mono font-semibold text-tinta" data-testid="kode-usaha">{usaha?.kode}</span> })}
      </p>
      <p className="mt-1 flex flex-wrap gap-x-5 text-sm"><a href="/app/mitra" className="underline underline-offset-4" data-testid="tautan-mitra">{kamus.mitra.judul}</a><a href="/app/orang/kerja" className="underline underline-offset-4">{kamus.hr.judul}</a><a href="/app/pengumuman" className="underline underline-offset-4">{kamus.hr.pengumumanJudul}</a></p>
      <FormTambahOrang teks={t} />
      {/* Nama bank untuk berkas transfer gaji: CIMB Niaga (inhouse) + daftar SKN resmi CIMB Niaga (lib/gaji/bank-skn.json). */}
      <datalist id="daftar-bank">{["CIMB NIAGA", ...BANK_SKN].map((b) => <option key={b} value={b} />)}</datalist>
      {orang?.length ? (
        <ul className="mt-6 divide-y divide-garis border-y border-garis">
          {orang.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-semibold" data-pengguna>{o.nama}</p>
                <p className="text-sm text-tinta-2">{o.id_staf ? sisip(t.idStaf, { id: <span className="font-mono">{o.id_staf}</span> }) : t.belumAkun}</p>
                <TopiOrang pakai={o.pakai_topi as unknown as PakaiTopi[]} t={t} />
              </div>
              <FormAkunStaf orangId={o.id} sudahAda={Boolean(o.user_id)} teks={t} />
              <FormGajiOrang orang={o.id} nama={o.nama} awal={((Array.isArray(o.orang_rahasia) ? o.orang_rahasia[0] : o.orang_rahasia)?.gaji as GajiOrang | undefined) ?? null} rekening={(Array.isArray(o.orang_rahasia) ? o.orang_rahasia[0] : o.orang_rahasia) as RekeningOrang | null} mulai={tanggalMulai(o.data)} teks={kamus.gajiOrang} bahasa={bahasa} />
              <Link href={`/app/serah-terima?orang=${o.id}`} className="text-sm text-tinta-2 underline underline-offset-4">{t.catatBerhenti}</Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-tinta-2">{t.kosong}</p>
      )}
      <KartuLowongan />
      <Suspense fallback={<div className="mt-10 h-32 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <LingkaranRekrut />
      </Suspense>
    </section>
  );
}

// Tanggal mulai kerja hanya dipakai bila berbentuk YYYY-MM-DD (impor lama bisa menyimpan teks lain).
const tanggalMulai = (data: unknown) => {
  const m = (data as { mulai?: unknown } | null)?.mulai;
  return typeof m === "string" && /^\d{4}-\d{2}-\d{2}$/.test(m) ? m : null;
};

export default function Orang() {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<div className="mx-auto mt-10 h-40 w-full max-w-2xl animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi />
      </Suspense>
    </main>
  );
}
