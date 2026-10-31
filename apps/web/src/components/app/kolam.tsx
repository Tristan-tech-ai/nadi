import type { ReactNode } from "react";
import Link from "next/link";
import { CoinsIcon, LockSimpleIcon, WarningIcon } from "@phosphor-icons/react/dist/ssr";
import { BatalKolam, SetujuiKolam, UnduhCsvKolam } from "@/components/app/kolam-aksi";
import { Cap } from "@/components/ui/cap";
import { Rupiah } from "@/components/ui/rupiah";
import { Tombol } from "@/components/ui/tombol";
import { AMBANG_KERJA, cocokDenganKolam, SUMBER_INSENTIF, teksPersen, teksPoinKolam, type BarisKolam, type HitungKolam, type KolamSaya, type Pengecualian } from "@/lib/gaji/kolam";

const isian = "rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base";
const GRID = "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,3fr)]";

/** URL tab kolam dengan isian dan pengecualian (k=<id>~<alasan>), supaya pratinjau bisa dibuka ulang dan dibagikan ke admin. */
export function urlKolam(bulan: string, jumlah: number | null, kecuali: Pengecualian[]) {
  const q = new URLSearchParams({ tab: "bonus", bulan });
  if (jumlah) q.set("jumlah", String(jumlah));
  for (const k of kecuali) q.append("k", `${k.orang_id}~${k.alasan}`);
  return `/app/kerja?${q.toString()}`;
}

/** Keterangan insentif lawan bonus (PP 36/2021) dan perlakuan slip; tampil di setiap keadaan layar kolam. */
function Keterangan() {
  return (
    <div className="mt-6 max-w-3xl border-t border-garis pt-4 text-sm text-tinta-2" data-testid="keterangan-insentif">
      <p>
        <span className="font-semibold text-tinta">Dicatat sebagai insentif, bukan bonus.</span> Insentif adalah pendapatan non-upah yang ditetapkan
        sesuai kebijakan usaha ({SUMBER_INSENTIF}), jadi tidak masuk dasar pesangon (Pasal 66: upah pokok dan tunjangan tetap). Bonus atas keuntungan
        usaha (Pasal 11) diatur di perjanjian kerja, peraturan perusahaan, atau PKB; tuliskan di sana dulu bila kamu ingin membaginya sebagai bonus.
      </p>
      <p className="mt-2">
        Di slip, insentif masuk bruto PPh 21 bulan itu. Dasar iuran BPJS di Nadi tetap gaji pokok dan tunjangan tetap; aturan BPJS untuk insentif
        belum Nadi periksa ke teks resmi.
      </p>
    </div>
  );
}

function Isian({ bulan, jumlah, kecuali, utama }: { bulan: string; jumlah: number | null; kecuali: Pengecualian[]; utama: boolean }) {
  return (
    <form method="get" action="/app/kerja" className="mt-4 grid gap-3 rounded-[var(--radius-kartu)] bg-kertas-2 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-end" aria-label="Isian kolam bonus" data-testid="isian-kolam">
      <input type="hidden" name="tab" value="bonus" />
      {kecuali.map((k) => <input key={k.orang_id} type="hidden" name="k" value={`${k.orang_id}~${k.alasan}`} />)}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-tinta-2">Bulan kerja</span>
        <input type="month" name="bulan" required defaultValue={bulan} className={`h-10 ${isian}`} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-tinta-2">Jumlah kolam (Rp)</span>
        <input name="jumlah" required inputMode="numeric" autoComplete="off" placeholder="1000000" defaultValue={jumlah ?? ""} className={`h-10 ${isian}`} />
      </label>
      <Tombol type="submit" ragam={utama ? "utama" : "kedua"}>Lihat pembagian</Tombol>
    </form>
  );
}

function KepalaTabel() {
  return (
    <div className={`mt-4 hidden border-b border-garis-kuat pb-1 text-xs font-semibold text-tinta-2 lg:grid ${GRID} lg:gap-3`} aria-hidden>
      <span>Orang</span><span className="text-right">Poin</span><span className="text-right">Bagian kolam</span><span className="text-right">Rupiah</span><span>Dasarnya</span>
    </div>
  );
}

type Baris = { orang_id: string; nama: string; poin: number; persen: number; rupiah: number; alasan: string; dibanding: number };

function BarisBuku({ b, aksi }: { b: Baris; aksi?: ReactNode }) {
  return (
    <li className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 py-3 ${GRID} lg:items-baseline`} data-testid="baris-kolam" data-nama={b.nama} data-rupiah={b.rupiah}>
      <p className="font-semibold">{b.nama}</p>
      <Rupiah nilai={b.rupiah} className="text-right font-semibold lg:order-4" />
      <p className="angka text-sm text-tinta-2 lg:order-2 lg:text-right lg:text-base lg:text-tinta">{teksPoinKolam(b.poin)}</p>
      <p className="angka text-right text-sm text-tinta-2 lg:order-3 lg:text-base lg:text-tinta">{teksPersen(b.persen)}</p>
      <div className="col-span-2 text-sm text-tinta-2 lg:order-5 lg:col-span-1">
        <p data-testid="alasan-kolam">{b.alasan}</p>
        {b.dibanding > 0 && <p className="mt-1 text-xs" data-testid="sedang-dibanding">Ada kerja yang sedang dibanding; tetap dihitung sampai pemilik memutuskan.</p>}
        {aksi}
      </div>
    </li>
  );
}

function Kecualikan({ b, bulan, jumlah, kecuali }: { b: Baris; bulan: string; jumlah: number; kecuali: Pengecualian[] }) {
  return (
    <details className="mt-1">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-laut underline underline-offset-4">Kecualikan {b.nama}</summary>
      <form method="get" action="/app/kerja" className="mt-1 grid max-w-md gap-2" aria-label={`Kecualikan ${b.nama}`}>
        <input type="hidden" name="tab" value="bonus" />
        <input type="hidden" name="bulan" value={bulan} />
        <input type="hidden" name="jumlah" value={jumlah} />
        {kecuali.map((k) => <input key={k.orang_id} type="hidden" name="k" value={`${k.orang_id}~${k.alasan}`} />)}
        <input type="hidden" name="kecuali" value={b.orang_id} />
        <label className="flex flex-col gap-1">
          <span>Alasan tertulis</span>
          <input name="alasan" required minLength={3} maxLength={300} placeholder="Cuti melahirkan sepanjang bulan" className={`h-10 ${isian}`} />
        </label>
        <div><Tombol type="submit" ragam="kedua">Kecualikan dan hitung ulang</Tombol></div>
      </form>
    </details>
  );
}

/**
 * Tab "Kolam bonus" (docs/design/kolam-bonus-beban.md). Pemilik dan admin; hanya pemilik yang menyetujui. Pratinjau dari
 * public.hitung_kolam (SQL), diperiksa ulang dengan pembagian sisa terbesar di browser sebelum tombol setujui muncul. Urut nama,
 * bukan peringkat.
 */
export function KolamBonus({ bulan, jumlah, kecuali, h, galat, pemilik }: {
  bulan: string; jumlah: number | null; kecuali: Pengecualian[]; h: HitungKolam | null; galat: string | null; pemilik: boolean;
}) {
  const cocok = h ? cocokDenganKolam(Number(h.jumlah), h.bagian) : true;
  const bisaSetujui = !!h && h.cukup && !h.slip_terkunci && !h.disetujui && cocok;
  return (
    <section aria-labelledby="judul-kolam" className="mt-6" data-testid="kolam-bonus">
      <h2 id="judul-kolam" className="text-lg font-semibold">Kolam bonus beban</h2>
      <p className="mt-1 max-w-3xl text-sm text-tinta-2">
        Tentukan jumlah insentif bulan ini; Nadi membaginya menurut poin kerja yang ditandai Selesai di papan kerja bulan itu. Poin dari perkiraan
        kerja wajar, bukan lama mengerjakan, jadi yang cepat tidak dirugikan dan yang lambat tidak dihukum. Staf hanya melihat bagiannya sendiri.
      </p>
      <Isian bulan={bulan} jumlah={jumlah} kecuali={kecuali} utama={!bisaSetujui} />
      {!pemilik && <p className="mt-3 text-sm text-tinta-2" data-testid="kolam-admin">Kamu melihat pratinjau. Hanya pemilik yang bisa menyetujui pembagian.</p>}

      {galat ? (
        <p role="alert" className="mt-4 text-cap" data-testid="kolam-galat">{galat}</p>
      ) : !h ? (
        <p className="mt-6 text-tinta-2" data-testid="kolam-kosong">Isi jumlah kolam, misalnya 1000000, lalu ketuk Lihat pembagian. Belum ada yang tersimpan sampai kamu menyetujuinya.</p>
      ) : (
        <div className="mt-6" data-testid="pratinjau-kolam" data-bulan={h.bulan} data-jumlah={h.jumlah}>
          <h3 className="font-semibold">Pratinjau {h.nama_bulan}: <Rupiah nilai={Number(h.jumlah)} /></h3>
          <p className="mt-1 text-sm text-tinta-2">
            {h.kerja_n} kerja berpoin selesai, {teksPoinKolam(Number(h.total_poin))} total. Dihitung di zona usaha ({h.zona}).
          </p>
          {h.slip_terkunci && (
            <p className="mt-3 flex items-start gap-2 rounded-[var(--radius-isian)] border border-garis-kuat p-3 text-sm" data-testid="kolam-terkunci">
              <LockSimpleIcon size={18} aria-hidden className="mt-0.5 shrink-0" />
              Gaji {h.nama_bulan} sudah disetujui dan terkunci, jadi kolam bulan ini tidak bisa disetujui. Bagi kolamnya di bulan berikutnya.
            </p>
          )}
          {h.disetujui && (
            <p className="mt-3 text-sm" data-testid="kolam-sudah">
              Kolam {h.nama_bulan} sudah disetujui (<Rupiah nilai={Number(h.disetujui.jumlah)} />). Lihat pembagiannya di atas; batalkan dulu bila ingin menggantinya.
            </p>
          )}
          {!h.cukup ? (
            <p role="status" className="mt-3 rounded-[var(--radius-isian)] border border-garis-kuat p-3 text-sm" data-testid="kolam-belum-cukup">
              {h.pesan} Tandai kerja Selesai di papan kerja; minimal {AMBANG_KERJA} kerja berpoin.
            </p>
          ) : (
            <>
              {h.peringatan.map((p) => (
                <p key={p} className="mt-3 flex items-start gap-2 text-sm" data-testid="peringatan-kolam">
                  <WarningIcon size={18} aria-hidden className="mt-0.5 shrink-0" /><span className="stabilo rounded px-1">{p}</span>
                </p>
              ))}
              <KepalaTabel />
              <ul className="divide-y divide-garis border-y border-garis lg:border-t-0" data-testid="daftar-kolam">
                {h.bagian.map((b) => {
                  const baris: Baris = { ...b, poin: Number(b.poin), persen: Number(b.persen), rupiah: Number(b.rupiah), dibanding: b.dibanding_ids.length };
                  return <BarisBuku key={b.orang_id} b={baris} aksi={pemilik && !h.disetujui ? <Kecualikan b={baris} bulan={bulan} jumlah={Number(h.jumlah)} kecuali={kecuali} /> : null} />;
                })}
              </ul>
              <p className="mt-2 flex justify-between gap-3 text-sm font-semibold" data-testid="jumlah-kolam">
                <span>Jumlah {h.bagian.length} orang</span>
                <Rupiah nilai={h.bagian.reduce((s, b) => s + Number(b.rupiah), 0)} />
              </p>
              {!cocok && (
                <p role="alert" className="mt-3 text-cap" data-testid="kolam-tidak-cocok">
                  Hitungan database dan pemeriksaan ulang tidak sama. Jangan setujui dulu; muat ulang halaman ini, lalu laporkan bila tetap berbeda.
                </p>
              )}
            </>
          )}
          {h.tanpa_poin.length > 0 && (
            <p className="mt-3 text-sm text-tinta-2" data-testid="kolam-tanpa-poin">
              {h.tanpa_poin.reduce((s, x) => s + x.kerja_n, 0)} kerja selesai belum punya poin ({h.tanpa_poin.map((x) => x.nama).join(", ")}), jadi belum ikut dibagi.
              Isi poinnya lewat Ubah poin di papan kerja.
            </p>
          )}
          {h.dikecualikan.length > 0 && (
            <div className="mt-4 text-sm" data-testid="kolam-dikecualikan">
              <p className="font-semibold">Dikecualikan</p>
              <ul className="mt-1 grid gap-1">
                {h.dikecualikan.map((d) => (
                  <li key={d.orang_id}>
                    {d.nama}: {d.alasan}.{" "}
                    <Link href={urlKolam(bulan, Number(h.jumlah), kecuali.filter((k) => k.orang_id !== d.orang_id))} className="inline-flex min-h-11 items-center text-laut underline underline-offset-4">
                      Ikutkan lagi
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {h.cukup && cocok && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <UnduhCsvKolam baris={h.bagian as BarisKolam[]} bulan={bulan} namaBulan={h.nama_bulan} />
            </div>
          )}
          {pemilik && bisaSetujui && <SetujuiKolam bulan={bulan} jumlah={Number(h.jumlah)} dikecualikan={kecuali} namaBulan={h.nama_bulan} />}
        </div>
      )}
      <Keterangan />
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
export function KolamDisetujui({ k, bulan, namaBulan, terkunci, pemilik, isian }: {
  k: KolamTersimpan; bulan: string; namaBulan: string; terkunci: boolean; pemilik: boolean; isian: ReactNode;
}) {
  const bagian = [...k.kolam_bagian].sort((a, b) => (a.orang?.nama ?? "").localeCompare(b.orang?.nama ?? "", "id") || a.orang_id.localeCompare(b.orang_id));
  const baris: BarisKolam[] = bagian.map((b) => ({ orang_id: b.orang_id, nama: b.orang?.nama ?? "Orang tidak aktif", id_staf: b.orang?.id_staf ?? null, poin: Number(b.poin), persen: Number(b.persen), rupiah: Number(b.rupiah), kerja_n: b.kerja_n }));
  return (
    <section aria-labelledby="judul-kolam" className="mt-6" data-testid="kolam-bonus">
      <h2 id="judul-kolam" className="text-lg font-semibold">Kolam bonus beban</h2>
      {isian}
      <div className="mt-6" data-testid="kolam-disetujui" data-kolam={k.id}>
        <h3 className="flex flex-wrap items-center gap-2 font-semibold">
          Kolam {namaBulan}: <Rupiah nilai={Number(k.jumlah)} /> <Cap jenis="diterima" label="Disetujui" />
        </h3>
        <p className="mt-1 text-sm text-tinta-2">
          Insentif setiap orang masuk slip gaji {namaBulan}: slip draf yang sudah ada langsung diperbarui. Siapkan (ulang) gaji bulan itu di menu Gaji supaya PPh 21 ikut dihitung.{" "}
          <Link href="/app/gaji" className="inline-flex min-h-11 items-center font-semibold text-laut underline underline-offset-4">Buka Gaji</Link>
        </p>
        <KepalaTabel />
        <ul className="divide-y divide-garis border-y border-garis lg:border-t-0" data-testid="daftar-kolam">
          {bagian.map((b, i) => (
            <BarisBuku key={b.orang_id} b={{ orang_id: b.orang_id, nama: baris[i].nama, poin: Number(b.poin), persen: Number(b.persen), rupiah: Number(b.rupiah), alasan: b.alasan, dibanding: b.dibanding_ids.length }} />
          ))}
        </ul>
        <p className="mt-2 flex justify-between gap-3 text-sm font-semibold" data-testid="jumlah-kolam">
          <span>Jumlah {bagian.length} orang</span>
          <Rupiah nilai={bagian.reduce((s, b) => s + Number(b.rupiah), 0)} />
        </p>
        {k.dikecualikan.length > 0 && <p className="mt-2 text-sm text-tinta-2">{k.dikecualikan.length} orang dikecualikan dengan alasan tertulis.</p>}
        <div className="mt-4"><UnduhCsvKolam baris={baris} bulan={bulan} namaBulan={namaBulan} /></div>
        {terkunci ? (
          <p className="mt-4 flex items-start gap-2 text-sm text-tinta-2"><LockSimpleIcon size={18} aria-hidden className="mt-0.5 shrink-0" />Gaji {namaBulan} sudah disetujui; pembagian ini terkunci.</p>
        ) : pemilik ? <BatalKolam kolam={k.id} namaBulan={namaBulan} /> : null}
      </div>
      <Keterangan />
    </section>
  );
}

export function IsianKolam(props: { bulan: string; jumlah: number | null; kecuali: Pengecualian[] }) {
  return <Isian {...props} utama={false} />;
}

/** Cermin staf: bagiannya sendiri dari kolam terakhir yang disetujui, tanpa jumlah kolam atau angka rekan. */
export function InsentifSaya({ k }: { k: KolamSaya }) {
  if (!k) return null;
  return (
    <section aria-labelledby="judul-insentif" className="mt-6 max-w-xl rounded-[var(--radius-kartu)] bg-kertas-2 p-4" data-testid="insentif-saya">
      <h2 id="judul-insentif" className="flex items-center gap-2 font-semibold"><CoinsIcon size={20} aria-hidden /> Insentif beban {k.nama_bulan}</h2>
      <p className="mt-1">
        <Rupiah nilai={Number(k.rupiah)} className="text-xl font-semibold" />{" "}
        <span className="text-tinta-2">({teksPoinKolam(Number(k.poin))} dari {k.kerja_n} kerja selesai)</span>
      </p>
      <p className="mt-1 text-sm text-tinta-2">Dibagi dari kolam insentif pemilik menurut poin kerjamu yang selesai bulan itu. Masuk slip gaji {k.nama_bulan}.</p>
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
