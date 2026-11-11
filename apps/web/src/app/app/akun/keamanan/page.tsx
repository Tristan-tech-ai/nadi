import type { Metadata } from "next";
import { Suspense } from "react";
import { DuaLangkah, FormPeran, KeluarLain, PilihPeran } from "@/components/app/keamanan";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { isiTeks } from "@/lib/i18n/isi-teks";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { zonaUsahaIni } from "@/lib/zona-usaha";
import { KepalaHalaman } from "@/components/app/kepala-halaman";

export const metadata: Metadata = { title: "Akun dan keamanan" };

type Log = { id: string; user_id: string; kind: string; ip: string | null; user_agent: string | null; at: string };
type SesiPerangkat = { id: string; aktif: string | null; perangkat: string | null; ip: string | null; ini: boolean; aal: string | null };
const IZIN = ["stok.lihat", "stok.ubah", "kerja.kelola", "proyek.kelola"];

/** Ringkas user agent jadi "Chrome di Windows" tanpa pustaka. */
function perangkat(ua: string | null, cadangan: string) {
  if (!ua) return cadangan;
  const b = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Peramban";
  const o = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return o ? `${b}, ${o}` : b;
}

async function Isi() {
  const sesi = await wajibPerusahaan();
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).keamanan;
  const zona = await zonaUsahaIni(sesi.perusahaanId);
  const supabase = await createClient();
  const pemilik = sesi.peran === "pemilik", pengelola = pemilik || sesi.peran === "admin";
  const [sesiP, logSaya, logUsaha, peran, anggota] = await Promise.all([
    supabase.rpc("my_sessions"),
    supabase.from("activity_log").select("id, user_id, kind, ip, user_agent, at").eq("user_id", sesi.userId).order("at", { ascending: false }).limit(20),
    pengelola ? supabase.from("activity_log").select("id, user_id, kind, ip, user_agent, at").eq("perusahaan_id", sesi.perusahaanId).order("at", { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
    pemilik ? supabase.from("custom_role").select("id, name, permissions").order("name") : Promise.resolve({ data: [] }),
    pemilik ? supabase.from("anggota").select("user_id, peran, custom_role_id, orang(nama)").in("peran", ["staf", "akuntan"]).eq("aktif", true).limit(200) : Promise.resolve({ data: [] }),
  ]);
  const waktu = (d: string | null) => d ? new Intl.DateTimeFormat(bahasa === "en" ? "en-GB" : "id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: zona }).format(new Date(d)).replace(/(\d{2}):(\d{2})/, "$1.$2") : "";
  const sesiList = (sesiP.data ?? []) as SesiPerangkat[];
  const daftarLog = (rows: Log[]) => rows.length === 0 ? <p className="mt-2 text-sm text-tinta-2">{t.logKosong}</p> : (
    <ul className="mt-2 divide-y divide-garis border-y border-garis text-sm">
      {rows.map((l) => (
        <li key={l.id} className="flex flex-wrap justify-between gap-2 py-2" data-testid="log" data-jenis={l.kind}>
          <span>{t.jenisLog[l.kind as keyof Teks["jenisLog"]] ?? l.kind} <span className="text-tinta-2">{perangkat(l.user_agent, t.tanpaPerangkat)}{l.ip ? `, ${l.ip}` : ""}</span></span>
          <span className="angka text-tinta-2">{waktu(l.at)}</span>
        </li>
      ))}
    </ul>
  );
  type Teks = typeof t;

  return (
    <div lang={bahasa}>
      <KepalaHalaman jalur="/app/akun/keamanan" judul={t.judul} ket={t.ket} />

      <section className="mt-8" aria-labelledby="dua">
        <h2 id="dua" className="text-lg font-semibold">{t.duaJudul}</h2>
        <p className="mt-1 max-w-2xl text-sm text-tinta-2">{t.duaKet}</p>
        <DuaLangkah teks={t} />
      </section>

      <section className="mt-10" aria-labelledby="sesi">
        <h2 id="sesi" className="text-lg font-semibold">{t.sesiJudul}</h2>
        <ul className="mt-2 divide-y divide-garis border-y border-garis text-sm" data-testid="daftar-sesi">
          {sesiList.map((s) => (
            <li key={s.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span>{perangkat(s.perangkat, t.tanpaPerangkat)}{s.ip ? `, ${s.ip}` : ""}{s.ini && <strong className="ml-2">({t.sesiIni})</strong>}</span>
              <span className="angka text-tinta-2">{isiTeks(t.terakhir, { waktu: waktu(s.aktif) })}</span>
            </li>
          ))}
        </ul>
        {sesiList.length > 1 && <KeluarLain teks={t} />}
      </section>

      <section className="mt-10" aria-labelledby="log">
        <h2 id="log" className="text-lg font-semibold">{t.logJudul}</h2>
        {daftarLog((logSaya.data ?? []) as Log[])}
      </section>

      {pemilik && (
        <section className="mt-10" aria-labelledby="peran">
          <h2 id="peran" className="text-lg font-semibold">{t.peranJudul}</h2>
          <p className="mt-1 max-w-2xl text-sm text-tinta-2">{t.peranKet}</p>
          <FormPeran izin={IZIN} teks={t} />
          {(peran.data ?? []).length > 0 && (<>
            <h3 className="mt-6 font-semibold">{t.daftarPeran}</h3>
            <ul className="mt-2 grid gap-1 text-sm" data-testid="daftar-peran">{((peran.data ?? []) as { id: string; name: string; permissions: string[] }[]).map((p) => (
              <li key={p.id}><span className="font-semibold" data-pengguna>{p.name}</span>: {p.permissions.map((z) => t.izinNama[z as keyof Teks["izinNama"]] ?? z).join(", ")}</li>))}</ul>
          </>)}
          <div className="mt-4 grid gap-3">
            {(anggota.data ?? []).length === 0 ? <p className="text-sm text-tinta-2">{t.tanpaAnggota}</p>
              : ((anggota.data ?? []) as unknown as { user_id: string; custom_role_id: string | null; orang: { nama: string } | null }[]).map((a) => (
                <PilihPeran key={a.user_id} user={a.user_id} nama={a.orang?.nama ?? a.user_id.slice(0, 8)} nilai={a.custom_role_id ?? ""}
                  peran={(peran.data ?? []) as { id: string; name: string }[]} teks={t} />))}
          </div>
        </section>
      )}

      {pengelola && (
        <section className="mt-10" aria-labelledby="audit">
          <h2 id="audit" className="text-lg font-semibold">{t.auditJudul}</h2>
          <p className="mt-1 max-w-2xl text-sm text-tinta-2">{t.auditKet}</p>
          {daftarLog((logUsaha.data ?? []) as Log[])}
        </section>
      )}
    </div>
  );
}

export default function HalamanKeamanan() {
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10">
      <Suspense fallback={<div aria-hidden className="h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" />}>
        <Isi />
      </Suspense>
    </main>
  );
}
