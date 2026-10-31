import type { Metadata } from "next";
import { Suspense } from "react";
import { WarningIcon } from "@phosphor-icons/react/dist/ssr";
import { FormDana, FormRencana, FormSesi, FormStatus } from "@/components/app/magang";
import { Cap, type JenisCap } from "@/components/ui/cap";
import { Rupiah } from "@/components/ui/rupiah";
import { formatTanggalKalender } from "@/lib/format";
import { hariIni } from "@/lib/izin";
import { formatLamaMenit, STATUS_RENCANA, totalUangSaku, type BarisMinggu, type Peringatan, type StatusRencana, type UangSaku } from "@/lib/rekrut/magang";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { zonaUsahaIni } from "@/lib/zona-usaha";

export const metadata: Metadata = { title: "Magang" };

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const namaBulan = (b: string) => `${BULAN[Number(b.slice(5, 7)) - 1]} ${b.slice(0, 4)}`;
const tgl = formatTanggalKalender;

type Rencana = {
  id: string;
  status: StatusRencana;
  mulai: string;
  selesai: string;
  uang_saku: UangSaku;
  tujuan: string;
  minggu: BarisMinggu[];
  uji_akhir: string | null;
  nilai_akhir: number | null;
  peserta: { id: string; nama: string };
  mentor: { id: string | null; nama: string | null };
  topi: { id: string; nama: string } | null;
  saya_mentor: boolean;
  menit_mentor: number;
  sesi: { tanggal: string; menit: number; catatan: string | null }[];
  peringatan: Peringatan[];
};

type BarisLaporan = {
  jenis: "magang" | "diterima";
  id: string;
  nama: string;
  status: string;
  menit_mentor: number;
  menit_penilai: number;
  biaya_iklan_bagian: number;
  biaya_total: number;
  menit_tanpa_tarif: number;
};
type Laporan = {
  tarif_jam: number | null;
  anggaran: number | null;
  terpakai: number;
  sisa: number | null;
  menit_mentor: number;
  menit_penilai: number;
  menit_tanpa_tarif: number;
  baris: BarisLaporan[];
  total_biaya: number;
};

const CAP_STATUS: Record<StatusRencana, JenisCap> = { rencana: "menunggu", jalan: "menunggu", selesai: "diterima", batal: "ditolak" };

function DaftarPeringatan({ p }: { p: Peringatan[] }) {
  if (!p.length) return null;
  return (
    <ul className="mt-2 grid gap-2 rounded-[var(--radius-isian)] border border-cap/40 p-3 text-sm" data-testid="peringatan-magang" aria-label="Peringatan">
      {p.map((x) => (
        <li key={x.kode} data-kode={x.kode} className="flex gap-2">
          <WarningIcon size={18} className="mt-0.5 shrink-0 text-cap" aria-hidden />
          <span>
            {x.pesan}{" "}
            <span className="text-tinta-2">
              Sumber: <a href={x.url} target="_blank" rel="noopener noreferrer" className="text-laut underline underline-offset-2">{x.sumber}</a>, {x.status}.
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function KartuRencana({ r, pengelola, hari }: { r: Rencana; pengelola: boolean; hari: string }) {
  const saku = totalUangSaku(r.uang_saku);
  return (
    <li className="py-4" data-testid="rencana-magang" data-peserta={r.peserta.nama}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{r.peserta.nama}{r.topi && <span className="font-normal text-tinta-2">, menuju {r.topi.nama}</span>}</p>
        <Cap jenis={CAP_STATUS[r.status]} label={STATUS_RENCANA[r.status]} />
      </div>
      <p className="mt-1 text-sm text-tinta-2">
        Mentor {r.mentor.nama ?? "belum ada"} · {tgl(r.mulai)} sampai {tgl(r.selesai)}
      </p>
      <p className="mt-1 text-sm">{r.tujuan}</p>
      <p className="mt-1 text-sm">
        Uang saku {saku ? <><Rupiah nilai={saku} className="font-semibold" /> per bulan</> : <span className="text-cap">belum diisi</span>}
        <span className="text-tinta-2"> · Bimbingan tercatat <span className="angka font-semibold text-tinta" data-testid="menit-mentor">{formatLamaMenit(r.menit_mentor)}</span></span>
        {r.nilai_akhir != null && <span className="text-tinta-2"> · Nilai uji akhir <span className="angka font-semibold text-tinta">{r.nilai_akhir}</span></span>}
      </p>
      {(r.status === "rencana" || r.status === "jalan") && <DaftarPeringatan p={r.peringatan} />}
      {(r.minggu.length > 0 || r.uji_akhir) && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-tinta-2">Rencana per minggu ({r.minggu.length} baris)</summary>
          <ol className="mt-2 grid gap-1">
            {r.minggu.map((m, i) => (
              <li key={i}><span className="angka font-semibold">Minggu {m.minggu}</span>: {m.keahlian}{m.target && <span className="text-tinta-2">. Target: {m.target}</span>}</li>
            ))}
          </ol>
          {r.uji_akhir && <p className="mt-2">Uji akhir: {r.uji_akhir}</p>}
        </details>
      )}
      {r.sesi.length > 0 && (
        <ul className="mt-2 text-sm text-tinta-2" aria-label={`Sesi terakhir ${r.peserta.nama}`}>
          {r.sesi.map((s, i) => <li key={i}>{tgl(s.tanggal)}: {formatLamaMenit(s.menit)}{s.catatan && `, ${s.catatan}`}</li>)}
        </ul>
      )}
      {(pengelola || r.saya_mentor) && r.status !== "batal" && <FormSesi rencana={r.id} peserta={r.peserta.nama} hariIni={hari} />}
      {pengelola && <FormStatus rencana={r.id} peserta={r.peserta.nama} status={r.status} nilai={r.nilai_akhir} />}
    </li>
  );
}

function TabelBiaya({ l, bulan }: { l: Laporan; bulan: string }) {
  if (!l.baris.length) {
    return <p className="mt-3 text-sm text-tinta-2" data-testid="biaya-kosong">Belum ada magang berjalan atau pelamar diterima di {namaBulan(bulan)}.</p>;
  }
  const kanan = "px-2 py-2 text-right";
  return (
    <div className="mt-3 overflow-x-auto focus-visible:outline-2 focus-visible:outline-kunyit" tabIndex={0} role="region" aria-label={`Tabel biaya per rekrutmen ${namaBulan(bulan)}, geser ke samping bila terpotong`}>
      <table className="w-full min-w-[34rem] border-collapse text-sm" data-testid="tabel-biaya">
        <caption className="sr-only">Biaya per rekrutmen {namaBulan(bulan)}</caption>
        <thead>
          <tr className="border-b border-garis-kuat text-left text-tinta-2">
            <th scope="col" className="px-2 py-2 font-semibold">Nama</th>
            <th scope="col" className="px-2 py-2 font-semibold">Jalur</th>
            <th scope="col" className={`${kanan} font-semibold`}>Jam mentor</th>
            <th scope="col" className={`${kanan} font-semibold`}>Jam penilai</th>
            <th scope="col" className={`${kanan} font-semibold`}>Iklan</th>
            <th scope="col" className={`${kanan} font-semibold`}>Biaya</th>
          </tr>
        </thead>
        <tbody>
          {l.baris.map((b) => (
            <tr key={`${b.jenis}-${b.id}`} className="border-b border-garis" data-testid="baris-biaya" data-nama={b.nama}>
              <th scope="row" className="px-2 py-2 text-left font-normal">{b.nama}</th>
              <td className="px-2 py-2">{b.jenis === "magang" ? `Magang, ${STATUS_RENCANA[b.status as StatusRencana]?.toLowerCase() ?? b.status}` : "Diterima kerja"}</td>
              <td className={`${kanan} angka`}>{b.menit_mentor ? formatLamaMenit(b.menit_mentor) : "-"}</td>
              <td className={`${kanan} angka`}>{b.menit_penilai ? formatLamaMenit(b.menit_penilai) : "-"}</td>
              <td className={kanan}>{b.biaya_iklan_bagian ? <Rupiah nilai={b.biaya_iklan_bagian} /> : "-"}</td>
              <td className={`${kanan} font-semibold`}><Rupiah nilai={b.biaya_total} /></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={5} className="px-2 py-2 text-left">Total {l.baris.length} rekrutmen</th>
            <td className={`${kanan} font-semibold`} data-testid="total-biaya"><Rupiah nilai={l.total_biaya} /></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

async function Isi({ searchParams }: { searchParams: PageProps<"/app/magang">["searchParams"] }) {
  const sesi = await wajibPerusahaan();
  const pengelola = sesi.peran === "pemilik" || sesi.peran === "admin";
  const sp = await searchParams;
  const hari = hariIni(new Date(), await zonaUsahaIni(sesi.perusahaanId));
  const bulan = typeof sp.bulan === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.bulan) ? sp.bulan : hari.slice(0, 7);
  const supabase = await createClient();
  const { data: d, error } = await supabase.rpc("daftar_rencana_magang");
  if (error) {
    return <p role="alert" className="mt-6 text-cap" data-testid="magang-galat">Daftar magang gagal dimuat. Muat ulang halaman ini sebentar lagi.</p>;
  }
  const daftar = (d ?? []) as Rencana[];

  if (!pengelola) {
    return daftar.length ? (
      <ul className="mt-6 divide-y divide-garis border-y border-garis" data-testid="daftar-rencana">
        {daftar.map((r) => <KartuRencana key={r.id} r={r} pengelola={false} hari={hari} />)}
      </ul>
    ) : (
      <p className="mt-6 text-tinta-2" data-testid="magang-kosong">Kamu belum menjadi mentor atau peserta magang. Rencananya dibuat pemilik usaha.</p>
    );
  }

  const [{ data: lap, error: eLap }, { data: orang }, { data: topi }] = await Promise.all([
    supabase.rpc("laporan_rekrut", { p_bulan: `${bulan}-01` }),
    supabase.from("orang").select("id, nama").eq("status", "aktif").order("nama"),
    supabase.from("topi").select("id, nama").eq("aktif", true).neq("kode", "mentor").order("nama"),
  ]);
  const l = lap as Laporan | null;
  const persen = l?.anggaran ? Math.min(100, Math.round((l.terpakai / l.anggaran) * 100)) : null;

  return (
    <>
      <section className="mt-6 rounded-[var(--radius-kartu)] border border-garis bg-kertas-2 p-4" aria-labelledby="judul-dana" data-testid="dana-rekrutmen">
        <h2 id="judul-dana" className="text-lg font-semibold">Dana Rekrutmen {namaBulan(bulan)}</h2>
        {eLap || !l ? (
          <p role="alert" className="mt-2 text-sm text-cap">Angka dana gagal dimuat. Muat ulang halaman ini.</p>
        ) : (
          <>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
              <div><dt className="text-tinta-2">Tarif per jam</dt><dd className="font-semibold" data-testid="tarif-jam">{l.tarif_jam != null ? <Rupiah nilai={l.tarif_jam} /> : "Belum diisi"}</dd></div>
              <div><dt className="text-tinta-2">Anggaran bulan ini</dt><dd className="font-semibold">{l.anggaran != null ? <Rupiah nilai={l.anggaran} /> : "Belum diisi"}</dd></div>
              <div><dt className="text-tinta-2">Terpakai</dt><dd className="font-semibold" data-testid="dana-terpakai"><Rupiah nilai={l.terpakai} /></dd></div>
              <div><dt className="text-tinta-2">Sisa</dt><dd className={`font-semibold ${l.sisa != null && l.sisa < 0 ? "text-cap" : ""}`}>{l.sisa != null ? <Rupiah nilai={l.sisa} /> : "-"}</dd></div>
            </dl>
            {persen != null && (
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-kertas" role="img" aria-label={`Terpakai ${persen}% dari anggaran`}>
                <div className={`h-full ${persen >= 100 ? "bg-cap" : "bg-tinta"}`} style={{ width: `${persen}%` }} />
              </div>
            )}
            <p className="mt-2 text-xs text-tinta-2">
              Dihitung dari buku jam bulan ini: mentor {formatLamaMenit(l.menit_mentor)}, menilai pelamar {formatLamaMenit(l.menit_penilai)}.
              {l.menit_tanpa_tarif > 0 && ` ${formatLamaMenit(l.menit_tanpa_tarif)} dicatat sebelum tarif diisi dan tidak dihitung.`} Gaji orang tidak dibaca untuk laporan ini.
            </p>
            {sesi.peran === "pemilik" ? <FormDana tarif={l.tarif_jam} anggaran={l.anggaran} /> : <p className="mt-3 text-sm text-tinta-2">Tarif dan anggaran diatur pemilik.</p>}
          </>
        )}
      </section>

      <section className="mt-10" aria-labelledby="judul-rencana">
        <h2 id="judul-rencana" className="text-lg font-semibold">Rencana magang</h2>
        {daftar.length === 0 ? (
          <p className="mt-2 text-sm text-tinta-2" data-testid="magang-kosong">Belum ada rencana magang. Buat satu di bawah: siapa pesertanya, siapa mentornya, dan apa yang dilatih tiap minggu.</p>
        ) : (
          <ul className="mt-2 divide-y divide-garis border-y border-garis" data-testid="daftar-rencana">
            {daftar.map((r) => <KartuRencana key={r.id} r={r} pengelola hari={hari} />)}
          </ul>
        )}
      </section>

      <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-buat">
        <h2 id="judul-buat" className="text-lg font-semibold">Buat rencana magang</h2>
        <p className="mt-1 text-sm text-tinta-2">Bisa dicetak sebagai lampiran perjanjian pemagangan; tanda tangan tetap di luar Nadi. Peringatan dari aturan tidak memblokir penyimpanan.</p>
        <FormRencana orang={(orang ?? []) as { id: string; nama: string }[]} topi={(topi ?? []) as { id: string; nama: string }[]} hariIni={hari} />
      </section>

      <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-biaya" data-testid="biaya-rekrutmen">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="judul-biaya" className="text-lg font-semibold">Biaya per rekrutmen</h2>
          <form className="flex items-end gap-2" aria-label="Pilih bulan laporan">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-tinta-2">Bulan</span>
              <input type="month" name="bulan" defaultValue={bulan} className="h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base" />
            </label>
            <button type="submit" className="h-10 rounded-[var(--radius-isian)] border border-garis-kuat px-3 text-sm font-semibold hover:bg-kertas-2">Tampilkan</button>
          </form>
        </div>
        <p className="mt-1 text-sm text-tinta-2">Jam mentor dan jam menilai pelamar dikali tarif yang berlaku saat dicatat, ditambah bagian biaya iklan lowongan.</p>
        {l && <TabelBiaya l={l} bulan={bulan} />}
      </section>
    </>
  );
}

function Kerangka() {
  return (
    <div aria-hidden className="mt-6 grid gap-4" data-testid="magang-memuat">
      <div className="h-36 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" />
      <div className="h-5 w-40 animate-pulse rounded bg-kertas-2" />
      {[0, 1].map((i) => (
        <div key={i} className="grid gap-2 border-b border-garis pb-4">
          <div className="h-4 w-1/2 animate-pulse rounded bg-kertas-2" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-kertas-2" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-kertas-2" />
        </div>
      ))}
    </div>
  );
}

export default function Magang(props: PageProps<"/app/magang">) {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">Magang</h1>
      <p className="mt-2 text-tinta-2">Rencana tertulis per peserta, mentor yang waktunya dihitung, dan berapa biaya mendapatkan satu orang.</p>
      <Suspense fallback={<Kerangka />}>
        <Isi searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
