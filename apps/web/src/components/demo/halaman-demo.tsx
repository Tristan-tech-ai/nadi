import Link from "next/link";
import { cacheLife } from "next/cache";
import { Suspense } from "react";
import { AlurNyata } from "@/components/app/alur-nyata";
import { DaftarSarapan, type Sarapan } from "@/components/app/sarapan-data";
import { PetaUsaha } from "@/components/app/peta-usaha";
import { PutusanDemo } from "@/components/landing/putusan-demo";
import { KartuUsulan } from "@/components/ui/kartu-usulan";
import { LogoNadi } from "@/components/ui/logo";
import { Rupiah } from "@/components/ui/rupiah";
import type { Alur } from "@/lib/alur/alur";
import { formatAngka } from "@/lib/format";
import { anonRpc } from "@/lib/mcp/http";
import { masukCoba } from "@/app/auth-actions";
import { cobaAktif } from "@/lib/auth/tamu";

type Demo = {
  usaha: { nama: string };
  usulan: { id: string; judul: string; penjelasan: string | null; sumber: string; keyakinan: number | null; dampak_rp: number | null }[];
  orang: { nama: string; id_staf: string; jabatan: string | null }[];
  belanja_7_hari: number;
  absen_kemarin: number;
  alur?: { invoice: Alur; rekrut: Alur };
  sarapan?: Sarapan;
};

const PILIHAN = [
  { kunci: "fnb", label: "Warung makan", href: "/demo" },
  { kunci: "toko", label: "Toko grosir", href: "/demo/toko" },
] as const;
const SUMBER: Record<string, string> = { lempar: "Dari Lempar Saja", mcp: "Dari asisten AI pemilik", aturan: "Dari aturan" };

/** Data usaha contoh; berubah hanya saat penyegaran malam, jadi disimpan di cache server (prerender + segarkan per jam). */
async function ambilDemo(kunci: "fnb" | "toko") {
  "use cache";
  try {
    const d = (await anonRpc("demo_lihat", { p_kunci: kunci })) as Demo | null;
    cacheLife("hours");
    return d;
  } catch {
    // Database tidak terjangkau (mis. build tanpa kunci asli): jangan simpan kegagalan lama-lama.
    cacheLife("seconds");
    return null;
  }
}

export function HalamanDemo({ kunci, galat }: { kunci: "fnb" | "toko"; galat?: Promise<string | undefined> }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-16">
      <div className="flex items-center justify-between">
        <Link href="/" aria-label="Beranda Nadi"><LogoNadi /></Link>
        <Link href="/masuk" className="text-sm font-semibold underline-offset-4 hover:underline">Masuk</Link>
      </div>
      <section aria-labelledby="judul-coba" className="mt-6 rounded-[var(--radius-kartu)] border border-garis p-5" data-testid="coba-aplikasi">
        <h1 id="judul-coba" className="font-judul text-3xl font-extrabold tracking-tight">Coba Nadi tanpa daftar</h1>
        <p className="mt-2">Masuk ke aplikasi Nadi yang sebenarnya, di <span className="stabilo">usaha contoh Toko Bu Sari</span>. Semua nama dan angka karangan.
          Semua layar bisa dibuka sebagai pemilik; perubahan tidak disimpan dan AI tidak dipakai.</p>
        <Suspense fallback={<div className="mt-4 h-12 w-56 animate-pulse rounded-[var(--radius-isian)] bg-kertas-2" aria-hidden />}>
          <TombolCoba galat={galat} />
        </Suspense>
        <Link href="/daftar" className="mt-4 inline-block text-sm font-semibold underline underline-offset-4">Buat akun untuk usahamu</Link>
      </section>
      <p className="mt-8 text-sm text-tinta-2">Atau lihat sekilas tanpa masuk:</p>
      <nav aria-label="Pilih usaha contoh" className="mt-3 flex gap-2">
        {PILIHAN.map((p) => (
          <Link key={p.kunci} href={p.href} aria-current={p.kunci === kunci ? "page" : undefined}
            className="rounded-full border border-garis px-4 py-2 text-sm font-semibold aria-[current=page]:border-tinta aria-[current=page]:bg-tinta aria-[current=page]:text-kertas">
            {p.label}
          </Link>
        ))}
      </nav>
      <Suspense fallback={<div className="mt-8 h-96 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <IsiDemo kunci={kunci} />
      </Suspense>
    </main>
  );
}


/** Tombol masuk mode coba; bila masuk anonim belum dinyalakan di Supabase, Nadi berkata jujur, bukan tombol yang gagal. */
async function TombolCoba({ galat }: { galat?: Promise<string | undefined> }) {
  const [aktif, g] = await Promise.all([cobaAktif(), galat]);
  return <>
    {g === "coba" ? <p role="alert" className="mt-4 rounded-[var(--radius-isian)] border border-cap px-3 py-2 text-sm text-cap">Usaha contoh belum bisa dibuka. Coba lagi sebentar, atau lihat sekilas di bawah.</p> : null}
    {aktif ? (
      <form action={masukCoba} className="mt-4">
        <button type="submit" className="inline-flex h-12 items-center rounded-[var(--radius-isian)] bg-tinta px-5 font-semibold text-kertas transition-[background-color] duration-150 hover:bg-tinta/90">Buka usaha contoh</button>
      </form>
    ) : <p className="mt-4 text-sm text-tinta-2" data-testid="coba-belum">Mode coba sedang disiapkan. Sementara itu lihat sekilas di bawah, atau buat akun gratis.</p>}
  </>;
}

async function IsiDemo({ kunci }: { kunci: "fnb" | "toko" }) {
  const d = await ambilDemo(kunci);
  return (
    <>
        {!d ? (
          <p role="alert" className="mt-8 text-tinta-2">Usaha contoh sedang tidak bisa dibuka. Coba lagi sebentar.</p>
        ) : (
          <>
            <h2 className="mt-8 font-judul text-2xl font-extrabold tracking-tight">{d.usaha.nama}</h2>
            <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-[var(--radius-kartu)] bg-kertas-2 p-4">
                <dt className="text-sm text-tinta-2">Belanja 7 hari</dt>
                <dd className="mt-1 text-xl font-semibold"><Rupiah nilai={d.belanja_7_hari} ringkas /></dd>
              </div>
              <div className="rounded-[var(--radius-kartu)] bg-kertas-2 p-4">
                <dt className="text-sm text-tinta-2">Usulan menunggu</dt>
                <dd className="angka mt-1 text-xl font-semibold">{formatAngka(d.usulan.length)}</dd>
              </div>
              <div className="col-span-2 rounded-[var(--radius-kartu)] bg-kertas-2 p-4 sm:col-span-1">
                <dt className="text-sm text-tinta-2">Absen kemarin</dt>
                <dd className="mt-1 text-xl font-semibold">{d.absen_kemarin > 0 ? <><span className="angka">{formatAngka(d.absen_kemarin)}</span> orang</> : "Belum dicatat"}</dd>
              </div>
            </dl>
            {d.sarapan ? <DaftarSarapan sarapan={d.sarapan} /> : null}
            <h2 className="mt-8 text-lg font-semibold">Perlu keputusan pemilik</h2>
            <div className="mt-3 grid gap-3" data-testid="feed-demo">
              {d.usulan.map((u) => (
                <KartuUsulan key={u.id} usulan={{ judul: u.judul, penjelasan: u.penjelasan ?? "", sumber: SUMBER[u.sumber] ?? u.sumber, keyakinan: u.keyakinan ?? undefined, dampakRp: u.dampak_rp ?? undefined }} aksi={<PutusanDemo />} />
              ))}
            </div>
            <h2 className="mt-10 text-lg font-semibold">Orang</h2>
            <ul className="mt-3 divide-y divide-garis border-y border-garis">
              {d.orang.map((o) => (
                <li key={o.id_staf} className="flex items-baseline justify-between gap-3 py-3">
                  <span className="font-semibold">{o.nama}</span>
                  <span className="text-sm text-tinta-2"><span className="font-mono">{o.id_staf}</span> · {o.jabatan}</span>
                </li>
              ))}
            </ul>
            <PetaUsaha privat={false} muatAwal={kunci} judul={kunci === "toko" ? "Peta toko langsung" : "Peta warung langsung"} />
            {d.alur ? <AlurNyata invoice={d.alur.invoice} rekrut={d.alur.rekrut} /> : null}
          </>
        )}
    </>
  );
}