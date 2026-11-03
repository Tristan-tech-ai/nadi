import Link from "next/link";
import { ArrowDownIcon, ArrowLeftIcon, ArrowUpIcon, ArrowsLeftRightIcon, EqualsIcon } from "@phosphor-icons/react/dist/ssr";
import { BandingKpi } from "@/components/app/banding-kpi";
import { formatTanggalKalender } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus, isiTeks, type Kamus } from "@/lib/i18n/kamus";
import { MIN_BANDING, namaHari, teksBanding, ukuranKpi, type Banding, type Kpi, type KpiMinggu, type RataTim, type RincianKerja } from "@/lib/kerja/kpi";
import { formatMenit, formatPoin } from "@/lib/kerja/poin";

type TK = Kamus["kpi"];
const rentang = (mulai: string, akhir: string, t: TK, b: Bahasa) => isiTeks(t.rentang, { a: formatTanggalKalender(mulai, b), b: formatTanggalKalender(akhir, b) });

/** Panah dengan teks: status tidak pernah hanya warna atau ikon (ANTI-SLOP S06). Turun tidak diberi warna bahaya: bukan teguran. */
function TandaBanding({ b }: { b: Banding | null }) {
  if (!b) return null;
  const Ikon = b.arah === "naik" ? ArrowUpIcon : b.arah === "turun" ? ArrowDownIcon : b.arah === "sama" ? EqualsIcon : null;
  return (
    <span className="inline-flex items-center gap-1 text-sm text-tinta-2" data-testid="banding-minggu" data-arah={b.arah ?? "belum"}>
      {Ikon && <Ikon size={14} weight="bold" aria-hidden />}
      {b.teks}
    </span>
  );
}

function BarisRincian({ k, t, bahasa }: { k: RincianKerja; t: TK; bahasa: Bahasa }) {
  const status = teksBanding(k.banding, bahasa);
  return (
    <li className="py-2" data-testid="rincian-kerja" data-id={k.id}>
      <p className="font-semibold" data-pengguna>{k.judul}</p>
      <p className="text-sm text-tinta-2">
        {namaHari(k.tanggal, bahasa)}, {formatTanggalKalender(k.tanggal, bahasa)} · {formatPoin(Number(k.poin), bahasa)}
        {k.tenggat ? (k.lewat_menit ? isiTeks(t.lewatTenggat, { lama: formatMenit(k.lewat_menit, bahasa) }) : t.tepatTenggat) : ""}
      </p>
      {k.lintas_topi && (
        <p className="mt-1 inline-flex items-center gap-1 text-xs"><ArrowsLeftRightIcon size={14} aria-hidden /> {t.lintasTopi}</p>
      )}
      {status && <p className="mt-1 text-xs" data-testid="status-banding">{status}</p>}
    </li>
  );
}

/**
 * Cermin kinerja satu orang (docs/design/kpi-cermin.md): empat angka dalam satu kolom, masing-masing dengan kalimat dari kerja
 * nyata, pembanding dirinya minggu lalu, rata-rata tim tanpa nama, dan "lihat rinciannya". Layar yang sama untuk staf dan untuk
 * pemilik yang mengetuk orang di tabel; formulir banding hanya untuk pemilik datanya sendiri.
 */
export function CerminKpi({ k, tim, mulai, akhir, milikSendiri, bahasa = "id" }: { k: Kpi; tim: RataTim; mulai: string; akhir: string; milikSendiri: boolean; bahasa?: Bahasa }) {
  const t = ambilKamus(bahasa).kpi;
  const ukuran = ukuranKpi(k, tim, bahasa);
  const peta = new Map(k.rincian.map((r) => [r.id, r]));
  const judul = milikSendiri ? t.kerjamu : isiTeks(t.kerjaOrang, { nama: k.nama });
  return (
    <section aria-labelledby="judul-cermin" className="mt-6 max-w-xl" data-testid="cermin-kpi" data-orang={k.id}>
      <h2 id="judul-cermin" className="text-lg font-semibold">{judul}</h2>
      <p className="mt-1 text-sm text-tinta-2">{isiTeks(t.cerminKet, { rentang: rentang(mulai, akhir, t, bahasa) })}</p>
      <ol className="mt-4 divide-y divide-garis border-y border-garis">
        {ukuran.map((u) => {
          const rincian = u.ids.map((id) => peta.get(id)).filter((r): r is RincianKerja => !!r);
          return (
            <li key={u.kunci} className="py-4" data-testid="ukuran-kpi" data-kunci={u.kunci} data-ids={u.ids.join(",")}>
              <p className="text-sm text-tinta-2">{u.label}</p>
              <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="angka text-2xl font-semibold" data-testid="angka-kpi">{u.angka}</span>
                <TandaBanding b={u.banding} />
              </p>
              {/* Penjelasan menyebut judul kerja (data pengguna) di dalam kalimat. */}
              <p className="mt-1" data-testid="penjelasan-kpi" data-pengguna>{u.penjelasan}</p>
              {u.rata && <p className="mt-1 text-sm text-tinta-2" data-testid="rata-tim">{u.rata}</p>}
              {rincian.length > 0 && (
                <details className="mt-2 text-sm">
                  <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-laut underline underline-offset-4">{t.lihatRincian}</summary>
                  <ul className="divide-y divide-garis" data-testid="daftar-rincian">
                    {rincian.map((r) => <BarisRincian key={r.id} k={r} t={t} bahasa={bahasa} />)}
                  </ul>
                </details>
              )}
            </li>
          );
        })}
      </ol>
      {milikSendiri && (
        <BandingKpi teks={t} kerja={k.rincian.map((r) => ({ id: r.id, judul: r.judul, hari: namaHari(r.tanggal, bahasa), ditandai: r.banding === "menunggu" }))} />
      )}
    </section>
  );
}

/** Staf yang akunnya belum terhubung ke data orang: jujur, dengan langkah berikutnya. */
export function KpiTanpaOrang({ bahasa = "id" }: { bahasa?: Bahasa }) {
  return (
    <p className="mt-6 rounded-[var(--radius-isian)] border border-garis-kuat p-3 text-sm" data-testid="kpi-tanpa-orang">{ambilKamus(bahasa).kpi.tanpaOrang}</p>
  );
}

function SelKpi({ angka, b, testid }: { angka: string; b: Banding | null; testid: string }) {
  return (
    <div className="lg:text-right" data-testid={testid}>
      <p className="angka font-semibold">{angka}</p>
      {b && b.arah !== null && <TandaBanding b={b} />}
    </div>
  );
}

/**
 * Tabel pemilik/admin bergaris buku kas: orang, tiga angka dengan panah dan teks, urut nama (bukan peringkat). Hadir sesuai
 * jadwal dan ambang naik/turun ditulis sekali di atas tabel, tidak diulang di setiap sel. Orang tanpa kerja selesai minggu ini
 * dirangkum dalam satu baris (seperti tab Beban), bukan deretan baris nol. Ketuk orang: cerminnya.
 */
export function KpiMingguIni({ data, bahasa = "id" }: { data: KpiMinggu; bahasa?: Bahasa }) {
  const t = ambilKamus(bahasa).kpi;
  const berkerja = data.orang.filter((o) => o.poin_selesai.kerja > 0);
  const kosong = data.orang.filter((o) => o.poin_selesai.kerja === 0);
  return (
    <section aria-labelledby="judul-kpi-minggu" className="mt-6" data-testid="kpi-minggu" data-selesai={data.selesai_n}>
      <h2 id="judul-kpi-minggu" className="text-lg font-semibold">{t.judul}</h2>
      <p className="mt-1 text-sm text-tinta-2">{isiTeks(t.ket, { rentang: rentang(data.mulai, data.akhir, t, bahasa), n: data.selesai_n })}</p>
      <p className="mt-2 text-sm text-tinta-2" data-testid="kpi-hadir">{isiTeks(t.hadir, { min: MIN_BANDING })}</p>
      {data.orang.length === 0 ? (
        <p className="mt-4 text-tinta-2" data-testid="kpi-kosong">{t.kosong}</p>
      ) : berkerja.length === 0 ? (
        <p className="mt-4 text-tinta-2" data-testid="kpi-belum-ada">{t.belumAda}</p>
      ) : (
        <>
          <div className="mt-4 hidden border-b border-garis-kuat pb-1 text-xs font-semibold text-tinta-2 lg:grid lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] lg:gap-3" aria-hidden>
            <span>{t.kolOrang}</span><span className="text-right">{t.kolSelesai}</span><span className="text-right">{t.kolTepat}</span><span className="text-right">{t.kolLintas}</span>
          </div>
          <ul className="divide-y divide-garis border-y border-garis lg:border-t-0" data-testid="daftar-kpi">
            {berkerja.map((o) => {
              const [poin, tepat, lintas] = ukuranKpi(o, data.rata_rata_tim, bahasa);
              return (
                <li key={o.id} data-testid="baris-kpi" data-nama={o.nama}>
                  <Link href={`/app/kerja?tab=kpi&orang=${o.id}`} className="grid grid-cols-3 gap-x-3 gap-y-2 py-3 hover:bg-kertas-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] lg:items-center">
                    <span className="col-span-3 font-semibold text-laut underline underline-offset-4 lg:col-span-1" data-pengguna>{o.nama}</span>
                    <SelKpi angka={poin.angka} b={poin.banding} testid="kpi-poin" />
                    <SelKpi angka={tepat.angka} b={tepat.banding} testid="kpi-tepat" />
                    <SelKpi angka={lintas.angka} b={null} testid="kpi-lintas" />
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-tinta-2 lg:hidden">{t.urutan}</p>
        </>
      )}
      {kosong.length > 0 && (
        <details className="mt-3 text-sm" data-testid="kpi-nol">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-tinta-2 underline-offset-4 hover:underline">
            {isiTeks(t.nol, { n: kosong.length })}
          </summary>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {kosong.map((o) => (
              <li key={o.id}>
                <Link href={`/app/kerja?tab=kpi&orang=${o.id}`} className="inline-flex min-h-11 items-center text-laut underline underline-offset-4" data-pengguna>{o.nama}</Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

export function KembaliKeTabel({ bahasa = "id" }: { bahasa?: Bahasa }) {
  return (
    <Link href="/app/kerja?tab=kpi" className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-laut underline underline-offset-4" data-testid="kembali-kpi">
      <ArrowLeftIcon size={16} aria-hidden /> {ambilKamus(bahasa).kpi.kembali}
    </Link>
  );
}

/** Memuat: kerangka yang meniru empat angka satu kolom (ANTI-SLOP S51). */
export function KerangkaKpi() {
  return (
    <div aria-hidden className="mt-6 grid max-w-xl gap-4" data-testid="kpi-memuat">
      <div className="h-5 w-48 animate-pulse rounded bg-kertas-2" />
      <div className="h-4 w-72 animate-pulse rounded bg-kertas-2" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="grid gap-2 border-b border-garis pb-4">
          <div className="h-3 w-24 animate-pulse rounded bg-kertas-2" />
          <div className="h-7 w-28 animate-pulse rounded bg-kertas-2" />
          <div className="h-4 w-full animate-pulse rounded bg-kertas-2" />
        </div>
      ))}
    </div>
  );
}
