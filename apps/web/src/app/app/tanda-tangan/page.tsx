import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { FormDokumen, FormMassal, FormTemplatTanda, TombolBatalTanda } from "@/components/app/tanda";
import { Cap } from "@/components/ui/cap";
import { formatTanggalKalender } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus, isiTeks, type Kamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { KepalaHalaman } from "@/components/app/kepala-halaman";
import { asalSitus } from "@/lib/situs";

export const metadata: Metadata = { title: "Dokumen dan tanda tangan" };

type T = Kamus["tanda"];
type Dok = { id: string; kode: string; judul: string; jenis: keyof T["jenisNama"]; nilai: number | null; status: keyof T["status"]; berakhir: string | null; dibuat_at: string };
type Penanda = { document_id: string; urutan: number; nama: string; status: keyof T["statusPenanda"] };
type Pengingat = { tertunda: { judul: string; nama: string; kontak: string | null }[]; berakhir: { judul: string; berakhir: string; sisa_hari: number }[] };
const judul = "text-lg font-semibold";
const meterai = (j: string, n: number | null) => j === "perjanjian" || j === "pernyataan" || (j === "kuitansi" && (n ?? 0) > 5_000_000);

async function Isi() {
  const sesi = await wajibPerusahaan();
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).tanda;
  if (sesi.peran !== "pemilik" && sesi.peran !== "admin") {
    return <div lang={bahasa}><KepalaHalaman jalur="/app/tanda-tangan" judul={t.judul} ket={t.hanya} /></div>;
  }
  const h = await headers();
  const tuan = h.get("x-forwarded-host") ?? h.get("host");
  const asal = tuan ? `${h.get("x-forwarded-proto") ?? "https"}://${tuan}` : asalSitus();
  const supabase = await createClient();
  const [dd, ss, tp, pg] = await Promise.all([
    supabase.from("sign_document").select("id, kode, judul, jenis, nilai, status, berakhir, dibuat_at").order("dibuat_at", { ascending: false }).limit(50),
    supabase.from("sign_signer").select("document_id, urutan, nama, status").order("urutan"),
    supabase.from("sign_template").select("id, judul").order("judul"),
    supabase.rpc("sign_reminders"),
  ]);
  const dok = (dd.data ?? []) as Dok[];
  const penanda = (ss.data ?? []) as Penanda[];
  const templat = (tp.data ?? []) as { id: string; judul: string }[];
  const P = pg.data as Pengingat | null;

  return (
    <div lang={bahasa}>
      <KepalaHalaman jalur="/app/tanda-tangan" judul={t.judul} ket={t.ket} />
      <p className="mt-3 rounded-[var(--radius-kartu)] bg-kertas-2 p-3 text-sm" data-testid="jujur-tanda">{t.jujur}</p>

      {P && (P.tertunda.length > 0 || P.berakhir.length > 0) && (
        <section className="mt-6" aria-labelledby="judul-ingat">
          <h2 id="judul-ingat" className={judul}>{t.pengingatJudul}</h2>
          <ul className="mt-2 space-y-1 text-sm" data-testid="pengingat-tanda">
            {P.tertunda.map((x, i) => <li key={`t${i}`} data-pengguna>{isiTeks(t.tertunda, { nama: x.nama, judul: x.judul })}</li>)}
            {P.berakhir.map((x, i) => <li key={`b${i}`} data-pengguna>{isiTeks(t.berakhirDalam, { judul: x.judul, tanggal: formatTanggalKalender(x.berakhir, bahasa), n: x.sisa_hari })}</li>)}
          </ul>
        </section>
      )}

      <section className="mt-8" aria-labelledby="judul-dok">
        <h2 id="judul-dok" className={judul}>{t.daftarJudul}</h2>
        {dok.length === 0 ? <p data-langkah='#judul-baru' className="mt-2 text-sm text-tinta-2">{t.kosong}</p> : (
          <ul className="mt-3 divide-y divide-garis border-y border-garis text-sm" data-testid="daftar-tanda">
            {dok.map((d) => (
              <li key={d.id} className="py-3" data-judul={d.judul} data-status={d.status}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold" data-pengguna>{d.judul}</p>
                  <Cap jenis={d.status === "selesai" ? "diterima" : d.status === "ditolak" || d.status === "batal" ? "ditolak" : "menunggu"} label={t.status[d.status]} />
                </div>
                <p className="text-tinta-2">{t.jenisNama[d.jenis]}, <a href={`/tanda/cek/${d.kode}`} className="angka text-laut underline underline-offset-2">{isiTeks(t.kodeCek, { kode: d.kode })}</a>{d.berakhir ? `, ${formatTanggalKalender(d.berakhir, bahasa)}` : ""}</p>
                <ol className="mt-1 list-decimal pl-5 text-tinta-2">{penanda.filter((p) => p.document_id === d.id).map((p) => <li key={p.urutan}><span data-pengguna>{p.nama}</span>, {t.statusPenanda[p.status]}</li>)}</ol>
                {meterai(d.jenis, d.nilai) && <p className="mt-1 text-xs text-tinta-2">{t.meterai}</p>}
                {d.status === "dikirim" && <div className="mt-2"><TombolBatalTanda id={d.id} label={`${t.batalkan}: ${d.judul}`} teks={t.batalkan} /></div>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-baru">
        <h2 id="judul-baru" className={judul}>{t.buatJudul}</h2>
        <FormDokumen asal={asal} teks={t} />
      </section>

      <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-templat">
        <h2 id="judul-templat" className={judul}>{t.templatJudul}</h2>
        <p className="mt-1 text-sm text-tinta-2">{t.templatKet}</p>
        <FormTemplatTanda teks={t} />
        {templat.length > 0 && <FormMassal templat={templat} asal={asal} teks={t} />}
      </section>
    </div>
  );
}

export default function HalamanTandaTangan() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <Suspense fallback={<div aria-hidden><div className="h-9 w-48 animate-pulse rounded-[var(--radius-isian)] bg-kertas-2" /><div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" /></div>}>
        <Isi />
      </Suspense>
    </main>
  );
}
