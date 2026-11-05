import type { Metadata } from "next";
import { Suspense } from "react";
import { LogoNadi } from "@/components/ui/logo";
import { formatRupiah, formatTanggalKalender } from "@/lib/format";
import { langkahServis, STATUS_PELANGGAN, URUTAN_SERVIS } from "@/lib/servis";
import { createClient } from "@/lib/supabase/server";

// W-07B: status order servis untuk pelanggan tanpa akun (kode acak 12 heksa). Bahasa Indonesia: penerimanya pelanggan di Indonesia.
export const metadata: Metadata = { title: "Status order", robots: { index: false, follow: false } };

type Status = { usaha: string; nomor: string; pelanggan: string; item: string; status: string; janji: string | null; estimasi: number | null; zona: string;
  riwayat: { status: string; at: string }[]; tagihan: string | null };

async function Isi({ params }: { params: PageProps<"/servis/[kode]">["params"] }) {
  const { kode } = await params;
  const supabase = await createClient();
  const { data } = /^[0-9A-Fa-f]{12}$/.test(kode) ? await supabase.rpc("service_status", { p_kode: kode }) : { data: null };
  const s = data as Status | null;
  if (!s) return <p role="alert" className="mt-8 text-tinta-2" data-testid="servis-tidak-ada">Order tidak ditemukan. Periksa lagi tautan dari tempat servis.</p>;
  const n = langkahServis(s.status);
  const jam = (d: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: s.zona || "Asia/Jakarta" }).format(new Date(d)).replace(/(\d{2}):(\d{2})/, "$1.$2");
  return (
    <article className="mt-8" data-testid="servis-status" data-status={s.status}>
      <p className="text-sm text-tinta-2">{s.usaha}</p>
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">{STATUS_PELANGGAN[s.status] ?? s.status}</h1>
      <p className="mt-1 text-tinta-2"><span className="angka">{s.nomor}</span>, {s.item}</p>
      {s.janji && s.status !== "diambil" && s.status !== "batal" && <p className="mt-1">Janji selesai {formatTanggalKalender(s.janji)}</p>}
      {s.estimasi !== null && <p className="mt-1">Perkiraan biaya <span className="angka">{formatRupiah(s.estimasi)}</span></p>}
      {s.status !== "batal" && (
        <ol className="mt-6 grid gap-2" aria-label="Tahap order">
          {URUTAN_SERVIS.map((u, i) => {
            const e = s.riwayat.find((r) => r.status === u);
            return (
              <li key={u} className={`flex justify-between gap-3 rounded-[var(--radius-kartu)] border p-3 ${i <= n ? "border-tinta" : "border-garis text-tinta-2"}`}>
                <span>{i <= n ? "Sudah: " : "Belum: "}{STATUS_PELANGGAN[u]}</span>
                {e && <span className="angka text-sm text-tinta-2">{jam(e.at)}</span>}
              </li>
            );
          })}
        </ol>
      )}
      {s.tagihan && <p className="mt-6"><a href={`/i/${s.tagihan}`} className="underline underline-offset-4" data-testid="servis-tagihan">Lihat dan bayar tagihan</a></p>}
      <p className="mt-6 text-sm text-tinta-2">Pertanyaan soal order ini? Hubungi {s.usaha} langsung.</p>
    </article>
  );
}

export default function StatusServis(props: PageProps<"/servis/[kode]">) {
  return (
    <main className="mx-auto w-full max-w-md px-5 py-8">
      <LogoNadi />
      <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi params={props.params} />
      </Suspense>
    </main>
  );
}
