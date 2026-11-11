import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { FiturDipakai } from "@/components/app/fitur-dipakai";
import { KepalaHalaman } from "@/components/app/kepala-halaman";
import { TombolSalinTeks } from "@/components/app/siapkan";
import { Pratinjau } from "@/components/app/pratinjau-mod";
import { FormManifest, RiwayatVersi, TombolAturMod, TombolPasang, TombolTerapkan } from "@/components/app/tambah-fitur";
import { formatTanggalKalender } from "@/lib/format";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { asalTautan, resourceMcp } from "@/lib/mcp/http";
import { KATALOG_RESMI, SARAN_PAKET } from "@/lib/mod/katalog";
import { promptMod } from "@/lib/mod/prompt-mod";
import { fiturUsaha } from "@/lib/ruang-sesi";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";

// X-06 Tambah fitur: empat jalan menambah fitur tanpa mengulang dari awal. (1) modul bawaan Nadi, (2) paket resmi dengan
// pratinjau, (3) dibuat AI milik pemilik lewat MCP (draf saja), (4) dibuat sendiri. Semua jalan berakhir di draf yang
// diperiksa pengawas bukan AI dan hanya aktif setelah pemilik/admin menerapkan. Melepas fitur tidak menghapus datanya.
export const metadata: Metadata = { title: "Tambah fitur" };

// X-15: paket yang disarankan untuk jenis usaha ini tampil lebih dulu, sisanya menurut urutan katalog.
function urutPaket<T extends { manifest: { kode: string } }>(daftar: readonly T[], saran: readonly string[]): T[] {
  return [...daftar].sort((a, b) => (saran.includes(a.manifest.kode) ? saran.indexOf(a.manifest.kode) : 99) - (saran.includes(b.manifest.kode) ? saran.indexOf(b.manifest.kode) : 99));
}

const SUMBER: Record<string, string> = { resmi: "Paket resmi", ai: "AI milikmu", sendiri: "Buatan sendiri", impor: "Impor" };

async function Isi() {
  const sesi = await wajibPerusahaan();
  const bahasa = await bahasaAplikasi(sesi.bahasa);
  if (sesi.peran !== "pemilik" && sesi.peran !== "admin") {
    return (
      <>
        <KepalaHalaman jalur="/app/tambah-fitur" judul="Tambah fitur" />
        <p className="mt-6 text-sm text-tinta-2">Hanya pemilik atau admin yang bisa menambah fitur. Fitur yang sudah aktif ada di <Link href="/app/mod" className="underline underline-offset-4">Semua fitur tambahan</Link>.</p>
      </>
    );
  }
  const supabase = await createClient();
  const h = await headers();
  const [nyala, { data: usaha }, { data: mod }, { data: draf }, { data: token }, { data: versiMod }] = await Promise.all([
    fiturUsaha(sesi.perusahaanId),
    supabase.from("perusahaan").select("industri").eq("id", sesi.perusahaanId).maybeSingle(),
    supabase.from("mod").select("id, kode, nama, status, sumber, versi_aktif").neq("status", "draf").order("nama"),
    supabase.rpc("mod_draf_daftar"),
    supabase.from("mcp_token").select("nama_klien, dipakai_at").eq("jenis", "akses").is("dicabut_at", null).gt("kedaluwarsa_at", new Date().toISOString()).limit(20),
    supabase.from("mod_versi").select("mod_id, versi, diterapkan_at").order("versi", { ascending: false }).limit(1000),
  ]);
  // X-17 riwayat versi per fitur (RLS mod_versi: pemilik/admin).
  const versiDari = (modId: string) => ((versiMod ?? []) as { mod_id: string; versi: number; diterapkan_at: string }[])
    .filter((v) => v.mod_id === modId).map((v) => ({ versi: v.versi, at: formatTanggalKalender(v.diterapkan_at.slice(0, 10)) }));
  const terpasang = new Map((mod ?? []).map((m) => [m.kode as string, m]));
  const drafList = (draf ?? []) as { id: string; kode: string; nama: string; sumber: string; status: string; versi_aktif: number | null; alasan: string[] }[];
  const klien = [...new Set((token ?? []).map((t) => t.nama_klien as string))];
  return (
    <>
      <KepalaHalaman jalur="/app/tambah-fitur" judul="Tambah fitur" ket="Pilih fitur siap pakai, minta AI-mu menyusunnya, atau susun sendiri. Semua diperiksa Nadi dan baru aktif setelah kamu terapkan." />

      <nav aria-label="Bagian halaman" className="mt-5 flex flex-wrap gap-2 text-sm">
        {[["#modul", "Modul bawaan"], ["#paket", "Paket resmi"], ["#ai", "Dengan AI-mu"], ["#sendiri", "Buat sendiri"]].map(([h2, l]) => (
          <a key={h2} href={h2} className="rounded-full border border-garis-kuat px-3 py-1.5 font-semibold hover:bg-kertas-2">{l}</a>))}
      </nav>

      {drafList.length > 0 && (
        <section aria-labelledby="judul-draf" className="mt-8 rounded-[var(--radius-kartu)] border border-kunyit p-4" data-testid="draf-menunggu">
          <h2 id="judul-draf" className="text-lg font-semibold">Draf menunggu keputusanmu</h2>
          <ul className="mt-2 divide-y divide-garis text-sm">
            {drafList.map((d) => (
              <li key={d.id} className="py-3" data-draf={d.kode}>
                <p><span className="font-semibold" data-pengguna>{d.nama}</span> <span className="text-tinta-2">({SUMBER[d.sumber] ?? d.sumber}{d.versi_aktif ? `, mengganti versi ${d.versi_aktif}` : ", fitur baru"})</span></p>
                {d.alasan.length > 0 ? (
                  <div className="mt-1 text-cap"><p>Belum bisa diterapkan. Pemeriksa Nadi menemukan:</p>
                    <ul className="list-disc pl-5" data-testid="alasan-draf">{d.alasan.slice(0, 10).map((a, i) => <li key={i}>{a}</li>)}</ul></div>
                ) : <div className="mt-2"><TombolTerapkan id={d.id} nama={d.nama} /></div>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div id="modul" className="scroll-mt-20"><FiturDipakai nyala={nyala} paket={(usaha?.industri as string | null) ?? null} bahasa={bahasa} /></div>

      <section id="paket" aria-labelledby="judul-paket" className="mt-10 scroll-mt-20">
        <h2 id="judul-paket" className="text-lg font-semibold">Paket resmi</h2>
        <p className="mt-1 text-sm text-tinta-2">Fitur siap pakai yang disusun dan diuji tim Nadi. Melepas paket hanya menyembunyikannya; catatannya tetap tersimpan.</p>
        <ul className="mt-3 grid gap-3">
          {urutPaket(KATALOG_RESMI, SARAN_PAKET[(usaha?.industri as string | null) ?? ""] ?? []).map(({ manifest: m, untuk, contoh }) => {
            const ada = terpasang.get(m.kode);
            const disarankan = (SARAN_PAKET[(usaha?.industri as string | null) ?? ""] ?? []).includes(m.kode);
            return (
              <li key={m.kode} className="rounded-[var(--radius-kartu)] border border-garis p-4" data-paket={m.kode} data-terpasang={ada?.status ?? "belum"}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{m.nama}{disarankan && <span className="ml-2 rounded-full border border-garis-kuat px-2 py-0.5 text-xs font-semibold" data-testid="lencana-disarankan">Cocok untuk usahamu</span>}</p>
                    <p className="text-sm text-tinta-2">{m.deskripsi}</p>
                    <p className="mt-1 text-sm">Cocok untuk: {untuk}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {ada?.status === "aktif" ? (
                      <><Link href={`/app/mod/${m.kode}`} className="text-sm font-semibold underline underline-offset-4">Buka</Link><TombolAturMod id={ada.id as string} aksi="matikan" nama={m.nama} /></>
                    ) : ada?.status === "mati" ? <TombolAturMod id={ada.id as string} aksi="nyalakan" nama={m.nama} /> : <TombolPasang kode={m.kode} nama={m.nama} />}
                  </div>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm font-semibold">Pratinjau isi</summary>
                  <p className="mt-2 text-sm text-tinta-2">Contoh: {contoh}</p>
                  <Pratinjau m={m} />
                </details>
                <Link href={`/app/tambah-fitur/${m.kode}`} className="mt-2 inline-block text-sm font-semibold underline underline-offset-4">Lihat rincian {m.nama}</Link>
                {ada && <RiwayatVersi id={ada.id as string} kode={m.kode} nama={m.nama} aktif={(ada.versi_aktif as number | null) ?? null} versi={versiDari(ada.id as string)} />}
              </li>
            );
          })}
        </ul>
      </section>

      <section id="ai" aria-labelledby="judul-ai" className="mt-10 scroll-mt-20">
        <h2 id="judul-ai" className="text-lg font-semibold">Buat dengan AI-mu</h2>
        <p className="mt-1 text-sm text-tinta-2">ChatGPT, Gemini, atau AI lain yang mendukung MCP bisa menyusun fitur khusus usahamu sebagai draf. AI tidak bisa menerapkannya; draf muncul di bagian atas halaman ini untuk kamu periksa.</p>
        <p className="mt-2 text-sm" data-testid="status-mcp">
          {klien.length ? <>Tersambung: <span className="font-semibold" data-pengguna>{klien.join(", ")}</span>.</>
            : <>Belum ada AI yang tersambung. <Link href="/app/siapkan#sambung" className="underline underline-offset-4">Sambungkan AI-mu</Link>, atau salin prompt di bawah; AI-mu akan memandu.</>}
        </p>
        <div className="mt-3"><TombolSalinTeks teks={promptMod({ alamat: resourceMcp(h), asal: asalTautan(h) })} label="Salin prompt untuk AI-mu" labelSudah="Tersalin" /></div>
      </section>

      <section id="sendiri" aria-labelledby="judul-sendiri" className="mt-10 scroll-mt-20">
        <h2 id="judul-sendiri" className="text-lg font-semibold">Buat sendiri</h2>
        <p className="mt-1 text-sm text-tinta-2">Impor berkas fitur dari usaha lain, atau tempel isi fitur (manifest JSON). Nadi memeriksanya dengan aturan yang sama dengan buatan AI, lalu menyimpannya sebagai draf.</p>
        <p className="mt-2 text-sm"><Link href="/app/tambah-fitur/buat" className="font-semibold underline underline-offset-4">Susun lewat formulir, tanpa menulis JSON</Link></p>
        <div className="mt-3"><FormManifest /></div>
      </section>

      {(mod ?? []).some((m) => !KATALOG_RESMI.some((p) => p.manifest.kode === m.kode)) && (
        <section aria-labelledby="judul-milikmu" className="mt-10">
          <h2 id="judul-milikmu" className="text-lg font-semibold">Fitur buatanmu</h2>
          <ul className="mt-2 divide-y divide-garis border-y border-garis text-sm">
            {(mod ?? []).filter((m) => !KATALOG_RESMI.some((p) => p.manifest.kode === m.kode)).map((m) => (
              <li key={m.id as string} className="py-3" data-mod={m.kode}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span><span className="font-semibold" data-pengguna>{m.nama}</span> <span className="text-tinta-2">({SUMBER[m.sumber as string] ?? m.sumber}, versi {m.versi_aktif}, {m.status === "aktif" ? "aktif" : "dilepas"})</span></span>
                  <span className="flex flex-wrap items-center gap-2">
                    {m.status === "aktif" && <Link href={`/app/mod/${m.kode}`} className="font-semibold underline underline-offset-4">Buka</Link>}
                    <TombolAturMod id={m.id as string} aksi={m.status === "aktif" ? "matikan" : "nyalakan"} nama={m.nama as string} />
                  </span>
                </div>
                <RiwayatVersi id={m.id as string} kode={m.kode as string} nama={m.nama as string} aktif={(m.versi_aktif as number | null) ?? null} versi={versiDari(m.id as string)} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export default function HalamanTambahFitur() {
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10">
      <Suspense fallback={<div aria-hidden className="h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" />}>
        <Isi />
      </Suspense>
    </main>
  );
}
