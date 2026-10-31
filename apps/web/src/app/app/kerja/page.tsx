import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowsLeftRightIcon } from "@phosphor-icons/react/dist/ssr";
import { BebanMingguIni, BebanSayaIni } from "@/components/app/beban";
import { CerminKpi, KembaliKeTabel, KerangkaKpi, KpiMingguIni, KpiTanpaOrang } from "@/components/app/kpi";
import { PapanStaf, TambahKerja, UbahPoin, type KerjaTampil } from "@/components/app/kerja";
import type { BebanMinggu, BebanSaya } from "@/lib/kerja/adil";
import type { KpiMinggu, KpiSaya } from "@/lib/kerja/kpi";
import { formatJam } from "@/lib/format";
import { bacaKolom, formatTenggat, LABEL_STATUS, ringkasStatus, STATUS_KERJA, teksPoin, teksSelesai, type KerjaPapan, type StatusKerja } from "@/lib/kerja/poin";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";

export const metadata: Metadata = { title: "Kerja" };

function KartuKerja({ k, pengelola }: { k: KerjaTampil; pengelola: boolean }) {
  return (
    <li className="py-3 lg:px-3" data-testid="kartu-kerja" data-judul={k.judul}>
      <p className="font-semibold">{k.judul}</p>
      <p className="mt-0.5 text-sm text-tinta-2">
        {k.topi?.nama ?? "Tanpa topi"} · {k.pelaksana?.nama ?? "Belum ada pelaksana"}
      </p>
      {k.lintas_topi && (
        <p className="mt-1 inline-flex items-center gap-1 rounded-full border border-garis-kuat px-2 py-0.5 text-xs" data-testid="lintas-topi">
          <ArrowsLeftRightIcon size={14} aria-hidden /> Lintas topi
        </p>
      )}
      {k.status !== "selesai" && (
        <p className="mt-1 text-sm">
          {k.tenggatTeks ? `Tenggat ${k.tenggatTeks}` : "Tanpa tenggat"}
          {k.status === "jalan" && k.mulaiTeks && <span className="text-tinta-2"> · mulai {k.mulaiTeks}</span>}
        </p>
      )}
      {k.status === "selesai" && <p className="mt-1 text-sm font-semibold" data-testid="durasi-nyata">{teksSelesai(k.aktual_menit, k.estimasi?.menit ?? null)}</p>}
      <p className={`mt-1 text-sm ${k.estimasi ? "" : "text-cap"}`} data-testid="poin-kerja">{teksPoin(k.estimasi)}</p>
      {k.estimasi && <p className="mt-0.5 text-xs text-tinta-2" data-testid="alasan-poin">{k.estimasi.alasan}</p>}
      {pengelola && <UbahPoin kerja={k.id} judul={k.judul} poin={k.estimasi?.poin ?? null} />}
    </li>
  );
}

const pertama = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const ID_SAH = /^[0-9a-f-]{36}$/i;
const galatKpi = <p role="alert" className="mt-6 text-cap" data-testid="kpi-galat">Kinerja minggu ini gagal dimuat. Muat ulang halaman ini sebentar lagi.</p>;

/**
 * Tab kinerja (F3-03). Staf: cermin miliknya (public.kpi_saya). Pemilik/admin/akuntan: tabel semua orang (public.kpi_minggu);
 * ?orang=<id> membuka cermin orang itu, layar yang sama dengan yang dilihat orangnya, tanpa formulir banding.
 */
async function BagianKpi({ semua, orang }: { semua: boolean; orang: string | null }) {
  const supabase = await createClient();
  if (!semua) {
    const { data, error } = await supabase.rpc("kpi_saya", { p_mulai: null });
    if (error || !data) return galatKpi;
    const d = data as KpiSaya;
    return d.orang ? <CerminKpi k={d.orang} tim={d.rata_rata_tim} mulai={d.mulai} akhir={d.akhir} milikSendiri /> : <KpiTanpaOrang />;
  }
  const { data, error } = await supabase.rpc("kpi_minggu", { p_mulai: null });
  if (error || !data) return galatKpi;
  const d = data as KpiMinggu;
  if (!orang) return <KpiMingguIni data={d} />;
  const k = d.orang.find((o) => o.id === orang);
  return (
    <>
      <KembaliKeTabel />
      {k ? <CerminKpi k={k} tim={d.rata_rata_tim} mulai={d.mulai} akhir={d.akhir} milikSendiri={false} />
        : <p className="mt-4 text-tinta-2" data-testid="kpi-orang-hilang">Orang ini tidak ada di daftar orang aktif minggu ini. Pilih orang lain dari tabel.</p>}
    </>
  );
}

async function Isi({ searchParams }: { searchParams: PageProps<"/app/kerja">["searchParams"] }) {
  const sesi = await wajibPerusahaan();
  const pengelola = sesi.peran === "pemilik" || sesi.peran === "admin";
  const sp = await searchParams;
  const kolom = bacaKolom(sp.kolom);
  const namaTab = pertama(sp.tab);
  const tabBeban = pengelola && namaTab === "beban";
  const tabKpi = namaTab === "kpi";
  // Akuntan ikut membaca tabel kinerja (sama dengan public.kpi_minggu); peran lain melihat cermin miliknya.
  const lihatSemua = pengelola || sesi.peran === "akuntan";
  const daftarTab = [
    { href: "/app/kerja", label: "Papan hari ini", aktif: !tabBeban && !tabKpi },
    ...(pengelola ? [{ href: "/app/kerja?tab=beban", label: "Beban minggu ini", aktif: tabBeban }] : []),
    { href: "/app/kerja?tab=kpi", label: lihatSemua ? "Kinerja minggu ini" : "Kerjamu minggu ini", aktif: tabKpi },
  ];
  const tab = (
    <nav aria-label="Bagian kerja" className="mt-4">
      <ul className="flex flex-wrap gap-1 border-b border-garis">
        {daftarTab.map((t) => (
          <li key={t.href}>
            <Link href={t.href} aria-current={t.aktif ? "page" : undefined}
              className={`-mb-px inline-flex min-h-11 items-center border-b-2 px-3 text-sm ${t.aktif ? "border-tinta font-semibold text-tinta" : "border-transparent text-tinta-2"}`}>
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
  if (tabKpi) {
    const orang = pertama(sp.orang);
    return (
      <>
        {tab}
        <Suspense fallback={<KerangkaKpi />}>
          <BagianKpi semua={lihatSemua} orang={lihatSemua && orang && ID_SAH.test(orang) ? orang : null} />
        </Suspense>
      </>
    );
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("papan_kerja");
  if (error) {
    return <p role="alert" className="mt-6 text-cap" data-testid="kerja-galat">Papan kerja gagal dimuat. Muat ulang halaman ini sebentar lagi.</p>;
  }
  const sekarang = new Date();
  const daftar: KerjaTampil[] = ((data ?? []) as KerjaPapan[]).map((k) => ({
    ...k,
    tenggatTeks: k.tenggat ? formatTenggat(k.tenggat, sekarang) : null,
    mulaiTeks: k.mulai_at ? formatJam(new Date(k.mulai_at), "Asia/Makassar", false) : null,
  }));

  if (sesi.peran === "staf") {
    const { data: saya } = await supabase.rpc("beban_saya", { p_mulai: null });
    return (
      <>
        {tab}
        {saya && <BebanSayaIni data={saya as BebanSaya} />}
        <PapanStaf daftar={daftar} />
      </>
    );
  }

  const jumlah = ringkasStatus(daftar);
  let tambah = null;
  if (pengelola) {
    const [{ data: topi }, { data: orang }] = await Promise.all([
      supabase.from("topi").select("id, nama").eq("aktif", true).order("nama"),
      supabase.from("orang").select("id, nama").eq("status", "aktif").order("nama"),
    ]);
    tambah = <TambahKerja topi={(topi ?? []) as { id: string; nama: string }[]} orang={(orang ?? []) as { id: string; nama: string }[]} />;
  }

  if (tabBeban) {
    const { data: beban, error: eb } = await supabase.rpc("beban_minggu", { p_mulai: null });
    return (
      <>
        {tab}
        <div className="mt-4">{tambah}</div>
        {eb || !beban
          ? <p role="alert" className="mt-6 text-cap" data-testid="beban-galat">Beban minggu ini gagal dimuat. Muat ulang halaman ini sebentar lagi.</p>
          : <BebanMingguIni data={beban as BebanMinggu} />}
      </>
    );
  }

  return (
    <>
      {tab}
      <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm" data-testid="ringkasan-kerja" aria-label="Ringkasan kerja hari ini">
        {STATUS_KERJA.map((s) => (
          <div key={s} className="flex gap-1">
            <dt className="text-tinta-2">{LABEL_STATUS[s]}</dt>
            <dd className="angka font-semibold" data-status={s}>{jumlah[s]}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4">{tambah ?? <p className="text-sm text-tinta-2">Kerja ditambah pemilik atau admin. Kamu bisa melihat papannya.</p>}</div>

      {daftar.length === 0 ? (
        <p className="mt-6 text-tinta-2" data-testid="kerja-kosong">Belum ada kerja hari ini. Tambah kerja pertama, misalnya Cek stok beras.</p>
      ) : (
        <>
          <nav aria-label="Saring kolom" className="mt-6 lg:hidden">
            <ul className="flex flex-wrap gap-2">
              {STATUS_KERJA.map((s) => (
                <li key={s}>
                  <Link
                    href={`/app/kerja?kolom=${s}`}
                    aria-current={kolom === s ? "page" : undefined}
                    className={`inline-flex min-h-11 items-center rounded-full border px-3 text-sm ${kolom === s ? "border-tinta bg-tinta font-semibold text-kertas" : "border-garis-kuat text-tinta"}`}
                  >
                    {LABEL_STATUS[s]} {jumlah[s]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-4 lg:mt-6 lg:grid lg:grid-cols-4 lg:divide-x lg:divide-garis lg:border-y lg:border-garis">
            {STATUS_KERJA.map((s: StatusKerja) => {
              const isi = daftar.filter((k) => k.status === s);
              return (
                <section key={s} aria-labelledby={`kolom-${s}`} data-testid={`kolom-${s}`} className={kolom === s ? "block" : "hidden lg:block"}>
                  <h2 id={`kolom-${s}`} className="border-b border-garis py-2 text-sm font-semibold lg:px-3">
                    {LABEL_STATUS[s]}{s === "selesai" ? " hari ini" : ""} <span className="angka text-tinta-2">({isi.length})</span>
                  </h2>
                  {isi.length ? (
                    <ul className="divide-y divide-garis">{isi.map((k) => <KartuKerja key={k.id} k={k} pengelola={pengelola} />)}</ul>
                  ) : (
                    <p className="py-3 text-sm text-tinta-2 lg:px-3">Tidak ada.</p>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

function Kerangka() {
  return (
    <div aria-hidden className="mt-4 grid gap-4" data-testid="kerja-memuat">
      <div className="h-5 w-64 animate-pulse rounded bg-kertas-2" />
      <div className="h-12 w-40 animate-pulse rounded-[var(--radius-isian)] bg-kertas-2" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="grid gap-2 border-b border-garis pb-3">
          <div className="h-4 w-1/2 animate-pulse rounded bg-kertas-2" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-kertas-2" />
          <div className="h-3 w-2/5 animate-pulse rounded bg-kertas-2" />
        </div>
      ))}
    </div>
  );
}

export default function Kerja(props: PageProps<"/app/kerja">) {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10 lg:max-w-6xl">
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">Kerja hari ini</h1>
      <p className="mt-2 text-tinta-2">Poin beban: 1 poin = 15 menit kerja wajar, diperkirakan dari kerja serupa dan dikoreksi waktu nyata.</p>
      <Suspense fallback={<Kerangka />}>
        <Isi searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
