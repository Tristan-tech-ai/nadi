import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { IlustrasiAmplop } from "@/components/ilustrasi";
import { FormStatusSurat, FormTautPihak, type Kandidat } from "@/components/app/agenda-surat";
import { Cap } from "@/components/ui/cap";
import { formatTanggal, formatTanggalKalender } from "@/lib/format";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { sisip } from "@/lib/i18n/sisip";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { zonaUsahaIni } from "@/lib/zona-usaha";
import { KepalaHalaman } from "@/components/app/kepala-halaman";

export const metadata: Metadata = { title: "Agenda surat" };

// F4-03 (docs/research/agenda-surat.md): surat masuk yang disetujui dari Lempar, bernomor agenda Nomor Sakti, tertaut ke pihak.

type Agenda = {
  id: string;
  nomor_agenda: string;
  nomor_surat: string | null;
  jenis: string | null;
  perihal: string | null;
  tanggal_surat: string | null;
  diterima_at: string;
  pihak_teks: string | null;
  pihak_yakin: number | null;
  pihak_cara: "otomatis" | "manual" | null;
  pihak_kandidat: Kandidat[];
  status: "baru" | "ditindaklanjuti" | "selesai";
  catatan: string | null;
  pihak: { nama: string } | null;
  berkas: { jalur: string } | null;
};

const STATUS = { baru: "Baru", ditindaklanjuti: "Ditindaklanjuti", selesai: "Selesai" } as const;
const CAP = { baru: "menunggu", ditindaklanjuti: "menunggu", selesai: "diterima" } as const;

async function Isi({ searchParams }: { searchParams: PageProps<"/app/surat">["searchParams"] }) {
  const sesi = await wajibPerusahaan();
  const bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).agenda;
  const LABEL: Record<keyof typeof STATUS, string> = { baru: t.stBaru, ditindaklanjuti: t.stTindak, selesai: t.stSelesai };
  const isiLang = bahasa === "id" ? undefined : "id";
  const kepala = (
    <>
      <KepalaHalaman jalur="/app/surat" judul={t.judul} ket={t.ket} />
    </>
  );
  if (!["pemilik", "admin", "akuntan"].includes(sesi.peran)) {
    return <div lang={bahasa}>{kepala}<p className="mt-6 text-tinta-2">{t.hanyaPeran}</p></div>;
  }
  const kelola = sesi.peran === "pemilik" || sesi.peran === "admin";
  const sp = await searchParams;
  const status = typeof sp.status === "string" && sp.status in STATUS ? sp.status : null;
  const cari = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : "";
  const supabase = await createClient();
  let q = supabase
    .from("agenda_surat")
    .select("id, nomor_agenda, nomor_surat, jenis, perihal, tanggal_surat, diterima_at, pihak_teks, pihak_yakin, pihak_cara, pihak_kandidat, status, catatan, pihak:pihak_orang_id(nama), berkas:berkas_id(jalur)")
    .eq("arah", "masuk")
    .order("diterima_at", { ascending: false })
    .limit(100);
  if (status) q = q.eq("status", status);
  if (cari) {
    const aman = cari.replace(/[%_,()*\\]/g, " ");
    q = q.or(`nomor_surat.ilike.%${aman}%,nomor_agenda.ilike.%${aman}%,jenis.ilike.%${aman}%,perihal.ilike.%${aman}%,pihak_teks.ilike.%${aman}%`);
  }
  const [{ data }, { data: org }, zona] = await Promise.all([
    q,
    kelola ? supabase.from("orang").select("id, nama").eq("status", "aktif").order("nama").limit(300) : Promise.resolve({ data: [] }),
    zonaUsahaIni(sesi.perusahaanId),
  ]);
  const baris = (data ?? []) as unknown as Agenda[];
  const jalur = baris.map((b) => b.berkas?.jalur).filter((j): j is string => Boolean(j));
  const { data: tautan } = jalur.length ? await supabase.storage.from("berkas").createSignedUrls(jalur, 3600) : { data: [] };
  const urlBerkas = new Map<string, string>();
  for (const t of tautan ?? []) if (t.path && t.signedUrl) urlBerkas.set(t.path, t.signedUrl);

  return (
    <div lang={bahasa}>
      {kepala}
      <nav className="mt-6 flex flex-wrap gap-2 text-sm" aria-label={t.saringAria}>
        {[["", t.semua], ...Object.entries(LABEL)].map(([k, label]) => (
          <Link key={k} href={k ? `/app/surat?status=${k}` : "/app/surat"} aria-current={(status ?? "") === k ? "page" : undefined}
            className={`rounded-full border px-3 py-1 ${(status ?? "") === k ? "border-tinta font-semibold text-tinta" : "border-garis-kuat text-tinta-2"}`}>{label}</Link>
        ))}
      </nav>
      <form className="mt-3 flex gap-2 text-sm" role="search" action="/app/surat">
        {status && <input type="hidden" name="status" value={status} />}
        <label className="sr-only" htmlFor="cari-surat">{t.cari}</label>
        <input id="cari-surat" name="q" defaultValue={cari} placeholder={t.cari} className="h-10 min-w-0 flex-1 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base" />
        <button type="submit" className="h-10 rounded-[var(--radius-isian)] border border-garis-kuat px-3 font-semibold">{t.cariTombol}</button>
      </form>
      {baris.length === 0 ? (
        <div className="mt-6 flex flex-col items-start gap-3">{!cari && !status && <IlustrasiAmplop className="w-28" />}<p className="text-tinta-2" data-testid="agenda-kosong">
          {cari || status ? t.tidakCocok : <>{t.kosongAwal} <Link href="/app/lempar" className="text-laut underline underline-offset-2">{t.lempar}</Link>{t.kosongAkhir}</>}
        </p></div>
      ) : (
        <ul className="mt-6 divide-y divide-garis border-y border-garis" data-testid="daftar-agenda">
          {baris.map((b) => (
            <li key={b.id} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold">{b.nomor_agenda}</p>
                  <p className="font-semibold">{b.jenis ? <span lang={isiLang}>{b.jenis}</span> : t.surat}{b.nomor_surat && <span className="font-mono font-normal text-tinta-2"> {b.nomor_surat}</span>}</p>
                </div>
                <Cap jenis={CAP[b.status]} label={LABEL[b.status]} />
              </div>
              <p className="mt-1 text-sm text-tinta-2">
                {b.tanggal_surat ? isiTeks(t.bertanggal, { t: formatTanggalKalender(b.tanggal_surat, bahasa) }) : ""}{isiTeks(t.diterima, { t: formatTanggal(new Date(b.diterima_at), zona, bahasa) })}
                {b.berkas && urlBerkas.get(b.berkas.jalur) && <>. <a href={urlBerkas.get(b.berkas.jalur)} target="_blank" rel="noopener noreferrer" className="text-laut underline underline-offset-2">{t.lihatAsli}</a></>}
              </p>
              {b.perihal && <p className="mt-1 text-sm" data-pengguna>{b.perihal}</p>}
              <p className="mt-2 text-sm" data-testid="pihak-surat">
                {b.pihak
                  ? <>{t.pihak} <span className="font-semibold" data-pengguna>{b.pihak.nama}</span>{b.pihak_cara === "otomatis" && b.pihak_yakin !== null ? isiTeks(t.otomatis, { n: Math.round(b.pihak_yakin * 100) }) : b.pihak_cara === "manual" ? t.manual : ""}</>
                  : b.pihak_teks
                    ? <>{sisip(t.tertulis, { teks: <span data-pengguna>&quot;{b.pihak_teks}&quot;</span> })}{b.pihak_kandidat.length > 1 ? t.ragu : ""}</>
                    : <>{t.tanpaPihak}</>}
              </p>
              {kelola && !b.pihak && <FormTautPihak agenda={b.id} kandidat={b.pihak_kandidat} orang={(org ?? []) as { id: string; nama: string }[]} nomor={b.nomor_agenda} teks={t} />}
              {b.catatan && <p className="mt-1 text-sm text-tinta-2">{t.catatan} <span data-pengguna>{b.catatan}</span></p>}
              {kelola && (
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer text-tinta-2">{t.ubah}</summary>
                  <FormStatusSurat agenda={b.id} status={b.status} catatan={b.catatan} nomor={b.nomor_agenda} teks={t} />
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Surat(props: PageProps<"/app/surat">) {
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-10">
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
