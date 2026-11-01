import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { Suspense } from "react";
import { FormBatalBerhenti, FormCatatBerhenti, FormCentang, FormPengganti, FormPindahkan } from "@/components/app/serah-terima";
import { Cap } from "@/components/ui/cap";
import { formatTanggalKalender } from "@/lib/format";
import { hariIni } from "@/lib/izin";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { zonaUsahaIni } from "@/lib/zona-usaha";

export const metadata: Metadata = { title: "Serah terima" };

// F3-07 (docs/design/serah-terima-layar.md): paket serah terima orang yang berhenti; akses dicabut otomatis setelah tanggal efektif.

type Berhenti = { id: string; orang_id: string; tanggal_surat: string; tanggal_efektif: string; alasan: string; peringatan: string[]; status: "disiapkan" | "selesai" | "batal"; orang: { nama: string } | null };
type Butir = { id: string; berhenti_id: string; jenis: "kerja" | "topi" | "ilmu" | "akses_otomatis" | "akses_manual"; judul: string; status: string; pengganti_id: string | null };

const ALASAN: Record<string, string> = { mundur: "mengundurkan diri", kontrak_selesai: "kontrak selesai", lainnya: "alasan lain" };
const selisihHari = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

function Paket({ b, butir, orang, hari }: { b: Berhenti; butir: Butir[]; orang: { id: string; nama: string }[]; hari: string }) {
  const nama = b.orang?.nama ?? "Orang ini";
  const per = (j: Butir["jenis"]) => butir.filter((x) => x.jenis === j);
  const namaOrang = new Map(orang.map((o) => [o.id, o.nama]));
  const calon = orang.filter((o) => o.id !== b.orang_id);
  const kerja = per("kerja");
  const bisaPindah = kerja.filter((k) => k.status === "terbuka" && k.pengganti_id).length;
  const sisa = selisihHari(hari, b.tanggal_efektif);
  const aktif = b.status === "disiapkan";
  return (
    <article className="mt-8 border-t border-garis pt-6" data-testid="paket-serah" aria-labelledby={`judul-${b.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 id={`judul-${b.id}`} className="text-lg font-semibold">Serah terima {nama}, berhenti {formatTanggalKalender(b.tanggal_efektif)}</h2>
        {b.status === "selesai" ? <Cap jenis="diterima" label="Selesai" /> : b.status === "batal" ? <Cap jenis="ditolak" label="Batal" /> : <Cap jenis="menunggu" label={sisa > 0 ? `${sisa} hari lagi` : sisa === 0 ? "Hari terakhir" : "Dicabut segera"} />}
      </div>
      <p className="mt-1 text-sm text-tinta-2">Surat diterima {formatTanggalKalender(b.tanggal_surat)}, {ALASAN[b.alasan] ?? b.alasan}.</p>
      {b.peringatan.includes("kurang_30_hari") && aktif && (
        <p className="mt-2 rounded-[var(--radius-isian)] bg-kunyit px-3 py-2 text-sm text-[var(--stabilo-teks)]">PP 35/2021 Pasal 36 huruf i: surat pengunduran diri paling lambat 30 hari sebelum tanggal berhenti. Tetap tersimpan bila kalian sudah sepakat.</p>
      )}

      <h3 className="mt-5 font-semibold">1. Kerja dan topi</h3>
      {kerja.length + per("topi").length === 0 ? (
        <p className="mt-1 text-sm text-tinta-2">{nama} tidak memegang kerja yang masih berjalan.</p>
      ) : (
        <ul className="mt-2 divide-y divide-garis border-y border-garis text-sm" data-testid="butir-kerja">
          {[...per("topi"), ...kerja].map((x) => (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p>{x.jenis === "topi" ? "Topi " : ""}{x.judul}</p>
                <p className="text-tinta-2">{x.status === "selesai" ? `Sudah dipindah ke ${namaOrang.get(x.pengganti_id ?? "") ?? "pengganti"}` : x.pengganti_id ? `Usulan pengganti: ${namaOrang.get(x.pengganti_id) ?? "rekan"} (bertopi sama, kerja terbuka paling sedikit)` : "Belum ada rekan bertopi sama"}</p>
              </div>
              {aktif && x.status !== "selesai" && <FormPengganti butir={x.id} judul={x.judul} pengganti={x.pengganti_id} orang={calon} />}
            </li>
          ))}
        </ul>
      )}
      {aktif && kerja.length > 0 && <FormPindahkan berhenti={b.id} jumlah={bisaPindah} />}

      <h3 className="mt-6 font-semibold">2. Ilmu yang hanya {nama} tahu</h3>
      {per("ilmu").length === 0 ? (
        <p className="mt-1 text-sm text-tinta-2">Setiap topi {nama} juga dipakai rekan lain.</p>
      ) : (
        <ul className="mt-2 divide-y divide-garis border-y border-garis text-sm">
          {per("ilmu").map((x) => (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <p>{x.judul}{x.status === "selesai" ? " (sudah dijelaskan)" : ""}</p>
              {aktif && <FormCentang butir={x.id} judul={x.judul} selesai={x.status === "selesai"} />}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-xs text-tinta-2">Minta {nama} menjelaskan langsung ke penggantinya sebelum tanggal berhenti, lalu tandai beres.</p>

      <h3 className="mt-6 font-semibold">3. Akses</h3>
      <p className="mt-1 text-sm text-tinta-2">Dicabut Nadi otomatis setelah {formatTanggalKalender(b.tanggal_efektif)} pukul 23.59 waktu usaha, paling lambat 1 jam sesudahnya:</p>
      <ul className="mt-1 list-disc pl-5 text-sm" data-testid="akses-otomatis">
        {per("akses_otomatis").length === 0 ? <li>{nama} tidak punya akun Nadi.</li> : per("akses_otomatis").map((x) => <li key={x.id}>{x.judul}{x.status === "selesai" ? " (sudah dicabut)" : ""}</li>)}
      </ul>
      <p className="mt-3 text-sm text-tinta-2">Dicek sendiri:</p>
      <ul className="mt-1 divide-y divide-garis border-y border-garis text-sm" data-testid="akses-manual">
        {per("akses_manual").map((x) => (
          <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <p>{x.judul}{x.status === "selesai" ? " (beres)" : ""}</p>
            {aktif && <FormCentang butir={x.id} judul={x.judul} selesai={x.status === "selesai"} />}
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-tinta-2">Hak keuangan (gaji sampai tanggal berhenti, sisa cuti) masih dihitung lewat halaman Gaji.</p>
      {aktif && <FormBatalBerhenti berhenti={b.id} />}
    </article>
  );
}

async function Isi({ searchParams }: { searchParams: PageProps<"/app/serah-terima">["searchParams"] }) {
  const sesi = await wajibPerusahaan();
  if (sesi.peran !== "pemilik" && sesi.peran !== "admin") {
    return <p className="mt-6 text-tinta-2">Serah terima hanya untuk pemilik dan admin.</p>;
  }
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: bh }, { data: org }, zona] = await Promise.all([
    supabase.from("berhenti").select("id, orang_id, tanggal_surat, tanggal_efektif, alasan, peringatan, status, orang:orang_id(nama)").neq("status", "batal").order("dibuat_at", { ascending: false }).limit(10),
    supabase.from("orang").select("id, nama").eq("status", "aktif").order("nama").limit(500),
    zonaUsahaIni(sesi.perusahaanId),
  ]);
  const daftar = (bh ?? []) as unknown as Berhenti[];
  const { data: bt } = daftar.length
    ? await supabase.from("serah_butir").select("id, berhenti_id, jenis, judul, status, pengganti_id").in("berhenti_id", daftar.map((b) => b.id)).order("dibuat_at")
    : { data: [] };
  const butir = (bt ?? []) as Butir[];
  const orang = (org ?? []) as { id: string; nama: string }[];
  const hari = hariIni(new Date(), zona);
  return (
    <>
      <FormCatatBerhenti orang={orang} pilih={typeof sp.orang === "string" ? sp.orang : ""} hari={hari} kunci={randomUUID()} />
      {daftar.length === 0
        ? <p className="mt-8 text-tinta-2" data-testid="serah-kosong">Belum ada yang berhenti. Saat ada surat pengunduran diri, catat di atas supaya kerjanya pindah dan aksesnya dicabut tepat waktu.</p>
        : daftar.map((b) => <Paket key={b.id} b={b} butir={butir.filter((x) => x.berhenti_id === b.id)} orang={orang} hari={hari} />)}
    </>
  );
}

export default function SerahTerima(props: PageProps<"/app/serah-terima">) {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">Serah terima</h1>
      <p className="mt-2 text-tinta-2">Saat karyawan berhenti: kerjanya pindah ke rekan, ilmunya dijelaskan, dan aksesnya dicabut Nadi setelah hari terakhirnya.</p>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
