import Link from "next/link";
import { ArrowDownIcon, ArrowLeftIcon, ArrowUpIcon, ArrowsLeftRightIcon, EqualsIcon } from "@phosphor-icons/react/dist/ssr";
import { BandingKpi } from "@/components/app/banding-kpi";
import { formatTanggalKalender } from "@/lib/format";
import { MIN_BANDING, namaHari, teksBanding, ukuranKpi, type Banding, type Kpi, type KpiMinggu, type RataTim, type RincianKerja } from "@/lib/kerja/kpi";
import { formatMenit, formatPoin } from "@/lib/kerja/poin";

const tanggal = formatTanggalKalender;
const rentang = (mulai: string, akhir: string) => `${tanggal(mulai)} sampai ${tanggal(akhir)}`;

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

function BarisRincian({ k }: { k: RincianKerja }) {
  const status = teksBanding(k.banding);
  return (
    <li className="py-2" data-testid="rincian-kerja" data-id={k.id}>
      <p className="font-semibold">{k.judul}</p>
      <p className="text-sm text-tinta-2">
        {namaHari(k.tanggal)}, {tanggal(k.tanggal)} · {formatPoin(Number(k.poin))}
        {k.tenggat ? (k.lewat_menit ? ` · lewat tenggat ${formatMenit(k.lewat_menit)}` : " · tepat tenggat") : ""}
      </p>
      {k.lintas_topi && (
        <p className="mt-1 inline-flex items-center gap-1 text-xs"><ArrowsLeftRightIcon size={14} aria-hidden /> Lintas topi</p>
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
export function CerminKpi({ k, tim, mulai, akhir, milikSendiri }: { k: Kpi; tim: RataTim; mulai: string; akhir: string; milikSendiri: boolean }) {
  const ukuran = ukuranKpi(k, tim);
  const peta = new Map(k.rincian.map((r) => [r.id, r]));
  const judul = milikSendiri ? "Kerjamu minggu ini" : `Kerja ${k.nama} minggu ini`;
  return (
    <section aria-labelledby="judul-cermin" className="mt-6 max-w-xl" data-testid="cermin-kpi" data-orang={k.id}>
      <h2 id="judul-cermin" className="text-lg font-semibold">{judul}</h2>
      <p className="mt-1 text-sm text-tinta-2">
        {rentang(mulai, akhir)}. Dihitung dari kerja yang ditandai Selesai di papan kerja. Tidak ada nilai gabungan: setiap angka berdiri sendiri.
      </p>
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
              <p className="mt-1" data-testid="penjelasan-kpi">{u.penjelasan}</p>
              {u.rata && <p className="mt-1 text-sm text-tinta-2" data-testid="rata-tim">{u.rata}</p>}
              {rincian.length > 0 && (
                <details className="mt-2 text-sm">
                  <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-laut underline underline-offset-4">lihat rinciannya</summary>
                  <ul className="divide-y divide-garis" data-testid="daftar-rincian">
                    {rincian.map((r) => <BarisRincian key={r.id} k={r} />)}
                  </ul>
                </details>
              )}
            </li>
          );
        })}
      </ol>
      {milikSendiri && (
        <BandingKpi kerja={k.rincian.map((r) => ({ id: r.id, judul: r.judul, hari: namaHari(r.tanggal), ditandai: r.banding === "menunggu" }))} />
      )}
    </section>
  );
}

/** Staf yang akunnya belum terhubung ke data orang: jujur, dengan langkah berikutnya. */
export function KpiTanpaOrang() {
  return (
    <p className="mt-6 rounded-[var(--radius-isian)] border border-garis-kuat p-3 text-sm" data-testid="kpi-tanpa-orang">
      Kinerjamu belum bisa dihitung karena akunmu belum terhubung ke data orang di usaha ini. Minta pemilik menghubungkannya di menu Orang.
    </p>
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
export function KpiMingguIni({ data }: { data: KpiMinggu }) {
  const berkerja = data.orang.filter((o) => o.poin_selesai.kerja > 0);
  const kosong = data.orang.filter((o) => o.poin_selesai.kerja === 0);
  return (
    <section aria-labelledby="judul-kpi-minggu" className="mt-6" data-testid="kpi-minggu" data-selesai={data.selesai_n}>
      <h2 id="judul-kpi-minggu" className="text-lg font-semibold">Kinerja minggu ini</h2>
      <p className="mt-1 text-sm text-tinta-2">
        {rentang(data.mulai, data.akhir)}. {data.selesai_n} kerja selesai. Setiap angka dijelaskan dari kerja nyata; ketuk nama untuk melihat rinciannya.
      </p>
      <p className="mt-2 text-sm text-tinta-2" data-testid="kpi-hadir">
        Hadir sesuai jadwal muncul setelah jadwal shift diisi. Naik atau turun dari minggu lalu tampil bila orangnya punya minimal {MIN_BANDING} kerja selesai di kedua minggu.
      </p>
      {data.orang.length === 0 ? (
        <p className="mt-4 text-tinta-2" data-testid="kpi-kosong">Belum ada orang aktif. Tambah orang di menu Orang dulu.</p>
      ) : berkerja.length === 0 ? (
        <p className="mt-4 text-tinta-2" data-testid="kpi-belum-ada">
          Belum ada kerja selesai minggu ini. Angka muncul setelah kerja di papan ditandai Selesai.
        </p>
      ) : (
        <>
          <div className="mt-4 hidden border-b border-garis-kuat pb-1 text-xs font-semibold text-tinta-2 lg:grid lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] lg:gap-3" aria-hidden>
            <span>Orang</span><span className="text-right">Kerja selesai</span><span className="text-right">Tepat tenggat</span><span className="text-right">Lintas topi</span>
          </div>
          <ul className="divide-y divide-garis border-y border-garis lg:border-t-0" data-testid="daftar-kpi">
            {berkerja.map((o) => {
              const [poin, tepat, lintas] = ukuranKpi(o, data.rata_rata_tim);
              return (
                <li key={o.id} data-testid="baris-kpi" data-nama={o.nama}>
                  <Link href={`/app/kerja?tab=kpi&orang=${o.id}`} className="grid grid-cols-3 gap-x-3 gap-y-2 py-3 hover:bg-kertas-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] lg:items-center">
                    <span className="col-span-3 font-semibold text-laut underline underline-offset-4 lg:col-span-1">{o.nama}</span>
                    <SelKpi angka={poin.angka} b={poin.banding} testid="kpi-poin" />
                    <SelKpi angka={tepat.angka} b={tepat.banding} testid="kpi-tepat" />
                    <SelKpi angka={lintas.angka} b={null} testid="kpi-lintas" />
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-tinta-2 lg:hidden">Urutan angka: kerja selesai, tepat tenggat, lintas topi.</p>
        </>
      )}
      {kosong.length > 0 && (
        <details className="mt-3 text-sm" data-testid="kpi-nol">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-tinta-2 underline-offset-4 hover:underline">
            {kosong.length} orang belum punya kerja selesai minggu ini
          </summary>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {kosong.map((o) => (
              <li key={o.id}>
                <Link href={`/app/kerja?tab=kpi&orang=${o.id}`} className="inline-flex min-h-11 items-center text-laut underline underline-offset-4">{o.nama}</Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

export function KembaliKeTabel() {
  return (
    <Link href="/app/kerja?tab=kpi" className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-laut underline underline-offset-4" data-testid="kembali-kpi">
      <ArrowLeftIcon size={16} aria-hidden /> Kembali ke kinerja semua orang
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
