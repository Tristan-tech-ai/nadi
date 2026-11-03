import type { ReactNode } from "react";
import Link from "next/link";
import { CoinsIcon, LockSimpleIcon, WarningIcon } from "@phosphor-icons/react/dist/ssr";
import { BatalKolam, SetujuiKolam, UnduhCsvKolam } from "@/components/app/kolam-aksi";
import { Cap } from "@/components/ui/cap";
import { Rupiah } from "@/components/ui/rupiah";
import { Tombol } from "@/components/ui/tombol";
import { AMBANG_KERJA, cocokDenganKolam, SUMBER_INSENTIF, teksPersen, teksPoinKolam, type BarisKolam, type HitungKolam, type KolamSaya, type Pengecualian } from "@/lib/gaji/kolam";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus, isiTeks, type Kamus } from "@/lib/i18n/kamus";
import { sisip } from "@/lib/i18n/sisip";

type TK = Kamus["kolam"];
type K = { t: TK; bahasa: Bahasa; isiLang?: string };
const kamusKolam = (bahasa: Bahasa): K => ({ t: ambilKamus(bahasa).kolam, bahasa, isiLang: bahasa === "id" ? undefined : "id" });
/** Nama bulan dari YYYY-MM menurut bahasa (nama_bulan dari SQL selalu bahasa Indonesia). */
const namaBulanDari = (bulan: string, bahasa: Bahasa, cadangan: string) =>
  bahasa === "id" ? cadangan : new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${bulan.slice(0, 7)}-01T00:00:00Z`));

const isian = "rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base";
const GRID = "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,3fr)]";

/** URL tab kolam dengan isian dan pengecualian (k=<id>~<alasan>), supaya pratinjau bisa dibuka ulang dan dibagikan ke admin. */
export function urlKolam(bulan: string, jumlah: number | null, kecuali: Pengecualian[]) {
  const q = new URLSearchParams({ tab: "bonus", bulan });
  if (jumlah) q.set("jumlah", String(jumlah));
  for (const k of kecuali) q.append("k", `${k.orang_id}~${k.alasan}`);
  return `/app/kerja?${q.toString()}`;
}

/** Keterangan insentif lawan bonus (PP 36/2021) dan perlakuan slip; tampil di setiap keadaan layar kolam. Teks aturan Indonesia:
 *  di bahasa lain diberi label khusus Indonesia dan ditandai lang="id". */
function Keterangan({ k: { t, isiLang } }: { k: K }) {
  return (
    <>
    {isiLang ? (
      <p className="mt-6 max-w-3xl rounded-[var(--radius-kartu)] border border-garis-kuat px-3 py-2 text-sm" data-testid="khusus-indonesia">
        <span className="font-semibold">{t.hanyaIndonesia}.</span> {t.hanyaIndonesiaKet}
      </p>
    ) : null}
    <div className="mt-6 max-w-3xl border-t border-garis pt-4 text-sm text-tinta-2" data-testid="keterangan-insentif" lang={isiLang}>
      <p>
        <span className="font-semibold text-tinta">Dicatat sebagai insentif, bukan bonus.</span> Insentif adalah pendapatan non-upah yang ditetapkan
        sesuai kebijakan usaha ({SUMBER_INSENTIF}), jadi tidak masuk dasar pesangon (Pasal 66: upah pokok dan tunjangan tetap). Bonus atas keuntungan
        usaha (Pasal 11) diatur di perjanjian kerja, peraturan perusahaan, atau PKB; tuliskan di sana dulu bila kamu ingin membaginya sebagai bonus.
      </p>
      <p className="mt-2">
        Di slip, insentif masuk bruto PPh 21 bulan itu. Iuran BPJS tidak berubah, karena dasarnya upah pokok dan tunjangan tetap (Perpres 82/2018
        Pasal 33, PP 44/2015 Pasal 19, PP 45/2015 Pasal 29, PP 46/2015 Pasal 17), sedangkan insentif bukan upah.
      </p>
    </div>
    </>
  );
}

function Isian({ bulan, jumlah, kecuali, utama, k: { t } }: { bulan: string; jumlah: number | null; kecuali: Pengecualian[]; utama: boolean; k: K }) {
  return (
    <form method="get" action="/app/kerja" className="mt-4 grid gap-3 rounded-[var(--radius-kartu)] bg-kertas-2 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-end" aria-label={t.isianAria} data-testid="isian-kolam">
      <input type="hidden" name="tab" value="bonus" />
      {kecuali.map((k) => <input key={k.orang_id} type="hidden" name="k" value={`${k.orang_id}~${k.alasan}`} />)}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-tinta-2">{t.bulanKerja}</span>
        <input type="month" name="bulan" required defaultValue={bulan} className={`h-10 ${isian}`} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-tinta-2">{t.jumlahKolam}</span>
        <input name="jumlah" required inputMode="numeric" autoComplete="off" placeholder="1000000" defaultValue={jumlah ?? ""} className={`h-10 ${isian}`} />
      </label>
      <Tombol type="submit" ragam={utama ? "utama" : "kedua"}>{t.lihat}</Tombol>
    </form>
  );
}

function KepalaTabel({ k: { t } }: { k: K }) {
  return (
    <div className={`mt-4 hidden border-b border-garis-kuat pb-1 text-xs font-semibold text-tinta-2 lg:grid ${GRID} lg:gap-3`} aria-hidden>
      <span>{t.kolOrang}</span><span className="text-right">{t.kolPoin}</span><span className="text-right">{t.kolBagian}</span><span className="text-right">{t.kolRupiah}</span><span>{t.kolDasar}</span>
    </div>
  );
}

type Baris = { orang_id: string; nama: string; poin: number; persen: number; rupiah: number; alasan: string; dibanding: number };

function BarisBuku({ b, aksi, k: { t, bahasa, isiLang } }: { b: Baris; aksi?: ReactNode; k: K }) {
  return (
    <li className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 py-3 ${GRID} lg:items-baseline`} data-testid="baris-kolam" data-nama={b.nama} data-rupiah={b.rupiah}>
      <p className="font-semibold" data-pengguna>{b.nama}</p>
      <Rupiah nilai={b.rupiah} className="text-right font-semibold lg:order-4" bahasa={bahasa} />
      <p className="angka text-sm text-tinta-2 lg:order-2 lg:text-right lg:text-base lg:text-tinta">{teksPoinKolam(b.poin, bahasa)}</p>
      <p className="angka text-right text-sm text-tinta-2 lg:order-3 lg:text-base lg:text-tinta">{teksPersen(b.persen, bahasa)}</p>
      <div className="col-span-2 text-sm text-tinta-2 lg:order-5 lg:col-span-1">
        <p data-testid="alasan-kolam" lang={isiLang}>{b.alasan}</p>
        {b.dibanding > 0 && <p className="mt-1 text-xs" data-testid="sedang-dibanding">{t.dibanding}</p>}
        {aksi}
      </div>
    </li>
  );
}

function Kecualikan({ b, bulan, jumlah, kecuali, k: { t } }: { b: Baris; bulan: string; jumlah: number; kecuali: Pengecualian[]; k: K }) {
  return (
    <details className="mt-1">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-laut underline underline-offset-4">{sisip(t.kecualikan, { nama: <span data-pengguna>{b.nama}</span> })}</summary>
      <form method="get" action="/app/kerja" className="mt-1 grid max-w-md gap-2" aria-label={isiTeks(t.kecualikan, { nama: b.nama })}>
        <input type="hidden" name="tab" value="bonus" />
        <input type="hidden" name="bulan" value={bulan} />
        <input type="hidden" name="jumlah" value={jumlah} />
        {kecuali.map((k) => <input key={k.orang_id} type="hidden" name="k" value={`${k.orang_id}~${k.alasan}`} />)}
        <input type="hidden" name="kecuali" value={b.orang_id} />
        <label className="flex flex-col gap-1">
          <span>{t.alasanTertulis}</span>
          <input name="alasan" required minLength={3} maxLength={300} placeholder={t.alasanContoh} className={`h-10 ${isian}`} />
        </label>
        <div><Tombol type="submit" ragam="kedua">{t.kecualikanTombol}</Tombol></div>
      </form>
    </details>
  );
}

/**
 * Tab "Kolam bonus" (docs/design/kolam-bonus-beban.md). Pemilik dan admin; hanya pemilik yang menyetujui. Pratinjau dari
 * public.hitung_kolam (SQL), diperiksa ulang dengan pembagian sisa terbesar di browser sebelum tombol setujui muncul. Urut nama,
 * bukan peringkat.
 */
export function KolamBonus({ bulan, jumlah, kecuali, h, galat, pemilik, bahasa = "id" }: {
  bulan: string; jumlah: number | null; kecuali: Pengecualian[]; h: HitungKolam | null; galat: string | null; pemilik: boolean; bahasa?: Bahasa;
}) {
  const k = kamusKolam(bahasa);
  const { t, isiLang } = k;
  const nb = h ? namaBulanDari(h.bulan, bahasa, h.nama_bulan) : "";
  const cocok = h ? cocokDenganKolam(Number(h.jumlah), h.bagian) : true;
  const bisaSetujui = !!h && h.cukup && !h.slip_terkunci && !h.disetujui && cocok;
  return (
    <section aria-labelledby="judul-kolam" className="mt-6" data-testid="kolam-bonus">
      <h2 id="judul-kolam" className="text-lg font-semibold">{t.judul}</h2>
      <p className="mt-1 max-w-3xl text-sm text-tinta-2">{t.ket}</p>
      <Isian bulan={bulan} jumlah={jumlah} kecuali={kecuali} utama={!bisaSetujui} k={k} />
      {!pemilik && <p className="mt-3 text-sm text-tinta-2" data-testid="kolam-admin">{t.admin}</p>}

      {galat ? (
        <p role="alert" className="mt-4 text-cap" data-testid="kolam-galat">{galat}</p>
      ) : !h ? (
        <p className="mt-6 text-tinta-2" data-testid="kolam-kosong">{t.kosong}</p>
      ) : (
        <div className="mt-6" data-testid="pratinjau-kolam" data-bulan={h.bulan} data-jumlah={h.jumlah}>
          <h3 className="font-semibold">{isiTeks(t.pratinjau, { bulan: nb })} <Rupiah nilai={Number(h.jumlah)} bahasa={bahasa} /></h3>
          <p className="mt-1 text-sm text-tinta-2">{isiTeks(t.ringkas, { n: h.kerja_n, poin: teksPoinKolam(Number(h.total_poin), bahasa), zona: h.zona })}</p>
          {h.slip_terkunci && (
            <p className="mt-3 flex items-start gap-2 rounded-[var(--radius-isian)] border border-garis-kuat p-3 text-sm" data-testid="kolam-terkunci">
              <LockSimpleIcon size={18} aria-hidden className="mt-0.5 shrink-0" />
              {isiTeks(t.terkunci, { bulan: nb })}
            </p>
          )}
          {h.disetujui && (
            <p className="mt-3 text-sm" data-testid="kolam-sudah">
              {sisip(t.sudah, { bulan: nb, jumlah: <Rupiah nilai={Number(h.disetujui.jumlah)} bahasa={bahasa} /> })}
            </p>
          )}
          {!h.cukup ? (
            <p role="status" className="mt-3 rounded-[var(--radius-isian)] border border-garis-kuat p-3 text-sm" data-testid="kolam-belum-cukup">
              <span lang={isiLang}>{h.pesan}</span>{isiTeks(t.minimal, { n: AMBANG_KERJA })}
            </p>
          ) : (
            <>
              {h.peringatan.map((p) => (
                <p key={p} className="mt-3 flex items-start gap-2 text-sm" data-testid="peringatan-kolam" lang={isiLang}>
                  <WarningIcon size={18} aria-hidden className="mt-0.5 shrink-0" /><span className="stabilo rounded px-1">{p}</span>
                </p>
              ))}
              <KepalaTabel k={k} />
              <ul className="divide-y divide-garis border-y border-garis lg:border-t-0" data-testid="daftar-kolam">
                {h.bagian.map((b) => {
                  const baris: Baris = { ...b, poin: Number(b.poin), persen: Number(b.persen), rupiah: Number(b.rupiah), dibanding: b.dibanding_ids.length };
                  return <BarisBuku key={b.orang_id} b={baris} k={k} aksi={pemilik && !h.disetujui ? <Kecualikan b={baris} bulan={bulan} jumlah={Number(h.jumlah)} kecuali={kecuali} k={k} /> : null} />;
                })}
              </ul>
              <p className="mt-2 flex justify-between gap-3 text-sm font-semibold" data-testid="jumlah-kolam">
                <span>{isiTeks(t.jumlahOrang, { n: h.bagian.length })}</span>
                <Rupiah nilai={h.bagian.reduce((s, b) => s + Number(b.rupiah), 0)} bahasa={bahasa} />
              </p>
              {!cocok && (
                <p role="alert" className="mt-3 text-cap" data-testid="kolam-tidak-cocok">{t.tidakCocok}</p>
              )}
            </>
          )}
          {h.tanpa_poin.length > 0 && (
            <p className="mt-3 text-sm text-tinta-2" data-testid="kolam-tanpa-poin">
              {sisip(t.tanpaPoin, { n: h.tanpa_poin.reduce((s, x) => s + x.kerja_n, 0), nama: <span data-pengguna>{h.tanpa_poin.map((x) => x.nama).join(", ")}</span> })}
            </p>
          )}
          {h.dikecualikan.length > 0 && (
            <div className="mt-4 text-sm" data-testid="kolam-dikecualikan">
              <p className="font-semibold">{t.dikecualikan}</p>
              <ul className="mt-1 grid gap-1">
                {h.dikecualikan.map((d) => (
                  <li key={d.orang_id}>
                    <span data-pengguna>{d.nama}: {d.alasan}.</span>{" "}
                    <Link href={urlKolam(bulan, Number(h.jumlah), kecuali.filter((k) => k.orang_id !== d.orang_id))} className="inline-flex min-h-11 items-center text-laut underline underline-offset-4">
                      {t.ikutkan}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {h.cukup && cocok && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <UnduhCsvKolam baris={h.bagian as BarisKolam[]} bulan={bulan} namaBulan={h.nama_bulan} teks={t} />
            </div>
          )}
          {pemilik && bisaSetujui && <SetujuiKolam bulan={bulan} jumlah={Number(h.jumlah)} dikecualikan={kecuali} namaBulan={nb} teks={t} />}
        </div>
      )}
      <Keterangan k={k} />
    </section>
  );
}

export type KolamTersimpan = {
  id: string;
  jumlah: number;
  disetujui_at: string;
  dikecualikan: Pengecualian[];
  kolam_bagian: { orang_id: string; poin: number; kerja_n: number; persen: number; rupiah: number; alasan: string; dibanding_ids: string[]; orang: { nama: string; id_staf: string | null } | null }[];
};

/** Kolam yang sudah disetujui untuk bulan itu: tabel buku kas dari public.kolam_bagian, CSV, dan batal (pemilik). */
export function KolamDisetujui({ k: kolam, bulan, namaBulan, terkunci, pemilik, isian, bahasa = "id" }: {
  k: KolamTersimpan; bulan: string; namaBulan: string; terkunci: boolean; pemilik: boolean; isian: ReactNode; bahasa?: Bahasa;
}) {
  const k = kamusKolam(bahasa);
  const { t } = k;
  const bagian = [...kolam.kolam_bagian].sort((a, b) => (a.orang?.nama ?? "").localeCompare(b.orang?.nama ?? "", "id") || a.orang_id.localeCompare(b.orang_id));
  const baris: BarisKolam[] = bagian.map((b) => ({ orang_id: b.orang_id, nama: b.orang?.nama ?? t.orangTidakAktif, id_staf: b.orang?.id_staf ?? null, poin: Number(b.poin), persen: Number(b.persen), rupiah: Number(b.rupiah), kerja_n: b.kerja_n }));
  return (
    <section aria-labelledby="judul-kolam" className="mt-6" data-testid="kolam-bonus">
      <h2 id="judul-kolam" className="text-lg font-semibold">{t.judul}</h2>
      {isian}
      <div className="mt-6" data-testid="kolam-disetujui" data-kolam={kolam.id}>
        <h3 className="flex flex-wrap items-center gap-2 font-semibold">
          {isiTeks(t.kolamBulan, { bulan: namaBulan })} <Rupiah nilai={Number(kolam.jumlah)} bahasa={bahasa} /> <Cap jenis="diterima" label={t.disetujui} />
        </h3>
        <p className="mt-1 text-sm text-tinta-2">
          {isiTeks(t.masukSlip, { bulan: namaBulan })}{" "}
          <Link href="/app/gaji" className="inline-flex min-h-11 items-center font-semibold text-laut underline underline-offset-4">{t.bukaGaji}</Link>
        </p>
        <KepalaTabel k={k} />
        <ul className="divide-y divide-garis border-y border-garis lg:border-t-0" data-testid="daftar-kolam">
          {bagian.map((b, i) => (
            <BarisBuku key={b.orang_id} k={k} b={{ orang_id: b.orang_id, nama: baris[i].nama, poin: Number(b.poin), persen: Number(b.persen), rupiah: Number(b.rupiah), alasan: b.alasan, dibanding: b.dibanding_ids.length }} />
          ))}
        </ul>
        <p className="mt-2 flex justify-between gap-3 text-sm font-semibold" data-testid="jumlah-kolam">
          <span>{isiTeks(t.jumlahOrang, { n: bagian.length })}</span>
          <Rupiah nilai={bagian.reduce((s, b) => s + Number(b.rupiah), 0)} bahasa={bahasa} />
        </p>
        {kolam.dikecualikan.length > 0 && <p className="mt-2 text-sm text-tinta-2">{isiTeks(t.nDikecualikan, { n: kolam.dikecualikan.length })}</p>}
        <div className="mt-4"><UnduhCsvKolam baris={baris} bulan={bulan} namaBulan={namaBulan} teks={t} /></div>
        {terkunci ? (
          <p className="mt-4 flex items-start gap-2 text-sm text-tinta-2"><LockSimpleIcon size={18} aria-hidden className="mt-0.5 shrink-0" />{isiTeks(t.terkunciTersimpan, { bulan: namaBulan })}</p>
        ) : pemilik ? <BatalKolam kolam={kolam.id} namaBulan={namaBulan} teks={t} /> : null}
      </div>
      <Keterangan k={k} />
    </section>
  );
}

export function IsianKolam(props: { bulan: string; jumlah: number | null; kecuali: Pengecualian[]; bahasa?: Bahasa }) {
  return <Isian {...props} utama={false} k={kamusKolam(props.bahasa ?? "id")} />;
}

/** Cermin staf: bagiannya sendiri dari kolam terakhir yang disetujui, tanpa jumlah kolam atau angka rekan. */
export function InsentifSaya({ k, bahasa = "id" }: { k: KolamSaya; bahasa?: Bahasa }) {
  if (!k) return null;
  const { t } = kamusKolam(bahasa);
  const nb = namaBulanDari(k.bulan ?? "", bahasa, k.nama_bulan);
  return (
    <section aria-labelledby="judul-insentif" className="mt-6 max-w-xl rounded-[var(--radius-kartu)] bg-kertas-2 p-4" data-testid="insentif-saya">
      <h2 id="judul-insentif" className="flex items-center gap-2 font-semibold"><CoinsIcon size={20} aria-hidden /> {isiTeks(t.insentifJudul, { bulan: nb })}</h2>
      <p className="mt-1">
        <Rupiah nilai={Number(k.rupiah)} className="text-xl font-semibold" bahasa={bahasa} />{" "}
        <span className="text-tinta-2">{isiTeks(t.insentifDari, { poin: teksPoinKolam(Number(k.poin), bahasa), n: k.kerja_n })}</span>
      </p>
      <p className="mt-1 text-sm text-tinta-2">{isiTeks(t.insentifKet, { bulan: nb })}</p>
    </section>
  );
}

/** Memuat: kerangka isian dan tiga baris buku kas (ANTI-SLOP S51). */
export function KerangkaKolam() {
  return (
    <div aria-hidden className="mt-6 grid gap-4" data-testid="kolam-memuat">
      <div className="h-5 w-48 animate-pulse rounded bg-kertas-2" />
      <div className="h-24 w-full animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="grid gap-2 border-b border-garis pb-3">
          <div className="h-4 w-1/3 animate-pulse rounded bg-kertas-2" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-kertas-2" />
        </div>
      ))}
    </div>
  );
}
