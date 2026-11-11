import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PencilSimpleLineIcon, SparkleIcon } from "@phosphor-icons/react/dist/ssr";
import { KepalaHalaman } from "@/components/app/kepala-halaman";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { saranPaket } from "@/lib/mod/katalog";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Isi data awal" };

// U-04 langkah 2 Mulai (permintaan Tristan 4 Nov 2026 11.50 dan 11.57): dua pilihan sejajar. Isi sendiri tetap jalan utama;
// Siapkan dengan AI-mu memakai AI milik pengguna (chat gratis atau MCP) yang menulis draf untuk diperiksa di Nadi.
async function Isi() {
  const sesi = await wajibPerusahaan();
  const b: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const en = b === "en";
  const kartu = "flex min-h-40 flex-col gap-2 rounded-[var(--radius-kartu)] border border-garis p-5 hover:bg-kertas-2";
  // X-15: paket resmi yang biasa dipakai jenis usaha ini; dipasang dari halaman rinciannya, tidak otomatis.
  const { data: usaha } = await (await createClient()).from("perusahaan").select("industri").eq("id", sesi.perusahaanId).maybeSingle();
  const saran = saranPaket((usaha?.industri as string | null) ?? null);
  const pengelola = sesi.peran === "pemilik" || sesi.peran === "admin";
  return (
    <div lang={b}>
      <KepalaHalaman jalur="/app/mulai" judul={en ? "Fill in your first data" : "Isi data awal usahamu"}
        ket={en ? "Your business is ready. Choose how to add people, hats, and rules. You can switch any time." : "Usahamu sudah siap. Pilih cara mengisi orang, topi, dan aturan. Bisa ganti cara kapan saja."} />
      <div className="mt-8 grid gap-4 min-[600px]:grid-cols-2" data-testid="pilihan-isi">
        <Link href="/app/orang" className={kartu}>
          <PencilSimpleLineIcon size={28} aria-hidden />
          <span className="text-lg font-bold">{en ? "Fill it in yourself" : "Isi sendiri"}</span>
          <span className="text-sm text-tinta-2">{en ? "Add people one by one or import an Excel list. Takes a few minutes." : "Tambah orang satu per satu atau impor daftar Excel. Beberapa menit saja."}</span>
        </Link>
        <Link href="/app/siapkan" className={kartu}>
          <SparkleIcon size={28} aria-hidden />
          <span className="text-lg font-bold">{en ? "Set up with your AI" : "Siapkan dengan AI-mu"}</span>
          <span className="text-sm text-tinta-2">{en ? "Give your files to ChatGPT, Gemini, or another AI. It writes a draft; you check it here and apply once." : "Lempar berkasmu ke ChatGPT, Gemini, atau AI lain. AI menulis draf, kamu periksa di sini lalu terapkan sekali."}</span>
        </Link>
      </div>
      {pengelola && saran.length > 0 && (
        <section className="mt-10" aria-labelledby="judul-saran-paket" data-testid="saran-paket">
          <h2 id="judul-saran-paket" className="text-lg font-semibold">{en ? "Add-on features often used by businesses like yours" : "Fitur tambahan yang biasa dipakai usaha sepertimu"}</h2>
          <p className="mt-1 text-sm text-tinta-2">{en ? "Optional. Open one to see what it contains, then install it if it fits." : "Tidak wajib. Buka untuk melihat isinya, lalu pasang bila cocok."}</p>
          <ul className="mt-3 divide-y divide-garis border-y border-garis text-sm">
            {saran.map((p) => (
              <li key={p.manifest.kode} className="py-3" data-saran={p.manifest.kode}>
                <Link href={`/app/tambah-fitur/${p.manifest.kode}`} className="font-semibold underline underline-offset-4">{p.manifest.nama}</Link>
                <p className="mt-0.5 text-tinta-2">{p.manifest.deskripsi}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="mt-6 text-sm"><Link href="/app" className="underline underline-offset-4">{en ? "Skip for now, open Today" : "Lewati dulu, buka Hari ini"}</Link></p>
    </div>
  );
}

export default function Lanjut() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <Suspense fallback={<div aria-hidden className="h-72 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" />}>
        <Isi />
      </Suspense>
    </main>
  );
}
