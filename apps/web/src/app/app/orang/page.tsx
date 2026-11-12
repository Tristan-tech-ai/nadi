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
import { KepalaHalaman } from "@/components/app/kepala-halaman";
import { FormDivisi } from "@/components/app/divisi";
import { FormCabutAdmin, FormTambahAdmin } from "@/components/app/admin-usaha";
import { TEKS_ADMIN } from "@/components/app/admin-teks";
import type { Bahasa } from "@/lib/i18n/bahasa";

export const metadata: Metadata = { title: "Orang" };
const LEPAS_TAMPIL = 30;

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
        <KepalaHalaman jalur="/app/orang" judul={t.khususJudul} ket={<span data-testid="ditolak">{t.khususKet}</span>} />
      </section>
    );
  }
  const supabase = await createClient();
  // Q-42: hanya orang aktif yang membawa formulir akun dan gaji. Dulu semua baris orang (termasuk nonaktif dan kandidat)
  // dirender dengan formulirnya, jadi setiap Tambah orang di usaha 500 orang mengirim ulang halaman 3 MB (6,5 dtk lokal, sekitar 20 dtk produksi).
  const [{ data: orang }, { data: usaha }, { data: lepas, count: jumlahLepas }] = await Promise.all([
    supabase.from("orang").select("id, nama, id_staf, user_id, data, pakai_topi(porsi, selesai, topi(nama)), orang_rahasia(gaji, bank, rekening, atas_nama)").eq("status", "aktif").order("dibuat_at", { ascending: true }),
    supabase.from("perusahaan").select("kode").eq("id", sesi.perusahaanId).maybeSingle(),
    supabase.from("orang").select("id, nama", { count: "exact" }).in("status", ["nonaktif", "keluar"]).order("dibuat_at", { ascending: false }).limit(LEPAS_TAMPIL),
  ]);
  return (
    <section className="mx-auto w-full max-w-2xl px-5 py-10" lang={bahasa}>
      <KepalaHalaman jalur="/app/orang" judul={t.judul} ket={false} />
      <p className="mt-2 text-tinta-2">
        {sisip(t.kodeUsaha, { kode: <span className="font-mono font-semibold text-tinta" data-testid="kode-usaha">{usaha?.kode}</span> })}
      </p>
      <FormTambahOrang teks={t} />
      {/* Nama bank untuk berkas transfer gaji: CIMB Niaga (inhouse) + daftar SKN resmi CIMB Niaga (lib/gaji/bank-skn.json; satu nama bisa punya dua kode BIC, mis. BANK HIBANK INDONESIA, jadi isian dibuat unik). */}
      <datalist id="daftar-bank">{[...new Set(["CIMB NIAGA", ...BANK_SKN])].map((b) => <option key={b} value={b} />)}</datalist>
      {orang?.length ? (
        <ul id="daftar-orang" className="mt-6 divide-y divide-garis border-y border-garis">
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
      {jumlahLepas ? (
        <details className="mt-4 text-sm" data-testid="orang-tidak-aktif">
          <summary className="cursor-pointer text-tinta-2 underline underline-offset-4">{sisip(t.tidakAktif, { n: jumlahLepas })}</summary>
          <p className="mt-2 text-tinta-2">{t.tidakAktifKet}</p>
          <p className="mt-2" data-pengguna>{(lepas ?? []).map((o) => o.nama).join(", ")}{jumlahLepas > LEPAS_TAMPIL ? ` ${t.danLainnya.replace("{n}", String(jumlahLepas - LEPAS_TAMPIL))}` : ""}</p>
        </details>
      ) : null}
      <Suspense fallback={<div className="mt-10 h-24 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <BagianDivisi orang={(orang ?? []).map((o) => ({ id: o.id as string, nama: o.nama as string }))} />
      </Suspense>
      {sesi.peran === "pemilik" && (
        <Suspense fallback={<div className="mt-10 h-24 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
          <BagianAdmin bahasa={bahasa} />
        </Suspense>
      )}
      <KartuLowongan />
      <Suspense fallback={<div className="mt-10 h-32 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <LingkaranRekrut />
      </Suspense>
    </section>
  );
}

/** ADMIN-01: pemilik menjadikan akun Nadi lain admin dan mencabutnya (list_admins, add_admin, remove_admin khusus pemilik). */
async function BagianAdmin({ bahasa }: { bahasa: Bahasa }) {
  const t = TEKS_ADMIN[bahasa];
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_admins");
  const admin = (data ?? []) as { user_id: string; email: string; aktif: boolean }[];
  return (
    <section className="mt-10" aria-labelledby="judul-admin" data-testid="admin-usaha">
      <h2 id="judul-admin" className="text-lg font-semibold">{t.judul}</h2>
      <p className="mt-1 text-sm text-tinta-2">{t.ket}</p>
      {admin.length === 0 ? <p className="mt-3 text-sm text-tinta-2">{t.kosong}</p> : (
        <ul className="mt-3 divide-y divide-garis border-y border-garis text-sm" data-testid="daftar-admin">
          {admin.map((a) => (
            <li key={a.user_id} className="flex flex-wrap items-center justify-between gap-2 py-2" data-admin={a.email}>
              <span className="font-mono" data-pengguna>{a.email}</span>
              {a.aktif ? <FormCabutAdmin user={a.user_id} email={a.email} teks={t} /> : <span className="text-tinta-2">{t.dicabut}</span>}
            </li>
          ))}
        </ul>
      )}
      <FormTambahAdmin teks={t} />
    </section>
  );
}

/** X-13 divisi: kepala divisi otomatis menjadi penyetuju izin anggota (setelah atasan langsung) dan peninjau hasil kerja mereka. */
async function BagianDivisi({ orang }: { orang: { id: string; nama: string }[] }) {
  const supabase = await createClient();
  const [{ data: divisi }, { data: anggota }] = await Promise.all([
    supabase.from("divisi").select("id, nama, kepala_id").order("nama"),
    supabase.from("divisi_anggota").select("divisi_id, orang_id").is("keluar_at", null),
  ]);
  const nama = new Map(orang.map((o) => [o.id, o.nama]));
  const daftar = (divisi ?? []) as { id: string; nama: string; kepala_id: string | null }[];
  const anggotaDari = (d: string) => ((anggota ?? []) as { divisi_id: string; orang_id: string }[]).filter((a) => a.divisi_id === d).map((a) => a.orang_id);
  return (
    <section className="mt-10" aria-labelledby="judul-divisi" data-testid="divisi">
      <h2 id="judul-divisi" className="text-lg font-semibold">Divisi</h2>
      <p className="mt-1 text-sm text-tinta-2">Kepala divisi menyetujui izin anggotanya bila mereka belum punya atasan langsung, lalu meninjau hasil kerja anggota. Kepala divisi tetap tidak melihat gaji.</p>
      {daftar.length === 0 ? <p className="mt-3 text-sm text-tinta-2">Belum ada divisi. Buat divisi pertama, misalnya Desain atau Gudang.</p> : (
        <ul className="mt-3 divide-y divide-garis border-y border-garis text-sm" data-testid="daftar-divisi">
          {daftar.map((d) => {
            const isi = anggotaDari(d.id);
            return (
              <li key={d.id} className="py-3" data-divisi={d.nama}>
                <p><span className="font-semibold" data-pengguna>{d.nama}</span> <span className="text-tinta-2">kepala <span data-pengguna>{d.kepala_id ? nama.get(d.kepala_id) ?? "-" : "belum ada"}</span>, {isi.length} anggota{isi.length ? ": " : ""}<span data-pengguna>{isi.map((o) => nama.get(o) ?? "-").join(", ")}</span></span></p>
                <details className="mt-2"><summary className="cursor-pointer text-tinta-2 underline underline-offset-4">Ubah divisi {d.nama}</summary>
                  <div className="mt-2"><FormDivisi orang={orang} awal={{ id: d.id, nama: d.nama, kepala: d.kepala_id, anggota: isi }} /></div></details>
              </li>
            );
          })}
        </ul>
      )}
      <details className="mt-3 rounded-[var(--radius-kartu)] border border-garis p-4" data-testid="buat-divisi" open={daftar.length === 0}>
        <summary className="cursor-pointer font-semibold">Buat divisi</summary>
        <div className="mt-3"><FormDivisi orang={orang} /></div>
      </details>
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
