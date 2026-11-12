import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowsLeftRightIcon } from "@phosphor-icons/react/dist/ssr";
import { IlustrasiPapan } from "@/components/ilustrasi";
import { BebanMingguIni, BebanSayaIni } from "@/components/app/beban";
import { CerminKpi, KembaliKeTabel, KerangkaKpi, KpiMingguIni, KpiTanpaOrang } from "@/components/app/kpi";
import { PapanStaf, TambahKerja, UbahPoin, type KerjaTampil } from "@/components/app/kerja";
import { DaftarReviewKelola, type ReviewKelola } from "@/components/app/divisi";
import { AturTim, ChecklistKerja, type Butir } from "@/components/app/kerja-tim";
import { InsentifSaya, IsianKolam, KerangkaKolam, KolamBonus, KolamDisetujui, type KolamTersimpan } from "@/components/app/kolam";
import { KerangkaPeta, PetaOrganisasi } from "@/components/app/peta";
import { bacaPengecualian, bulanKolam, rupiahIsian, type HitungKolam, type KolamSaya } from "@/lib/gaji/kolam";
import type { BebanMinggu, BebanSaya } from "@/lib/kerja/adil";
import type { KpiMinggu, KpiSaya } from "@/lib/kerja/kpi";
import { bacaPeta, type Peta } from "@/lib/kerja/peta";
import { formatJam } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus, isiTeks, type Kamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { bacaKolom, formatTenggat, ringkasStatus, STATUS_KERJA, teksPoin, teksSelesai, teksTim, type KerjaPapan, type StatusKerja } from "@/lib/kerja/poin";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { zonaUsahaIni } from "@/lib/zona-usaha";
import { KepalaHalaman } from "@/components/app/kepala-halaman";

export const metadata: Metadata = { title: "Kerja" };

function KartuKerja({ k, pengelola, aturTim = pengelola, t, bahasa, orang = [], butir = [] }: { k: KerjaTampil; pengelola: boolean; aturTim?: boolean; t: Kamus["kerja"]; bahasa: Bahasa; orang?: { id: string; nama: string }[]; butir?: Butir[] }) {
  const tim = teksTim(k.tim, bahasa === "en" ? "en" : "id");
  return (
    <li className="py-3 lg:px-3" data-testid="kartu-kerja" data-judul={k.judul}>
      <p className="font-semibold" data-pengguna>{k.judul}</p>
      <p className="mt-0.5 text-sm text-tinta-2">
        {k.topi?.nama ? <span data-pengguna>{k.topi.nama}</span> : t.tanpaTopi} · {k.pelaksana?.nama ? <span data-pengguna>{k.pelaksana.nama}</span> : t.tanpaPelaksana}
      </p>
      {k.lintas_topi && (
        <p className="mt-1 inline-flex items-center gap-1 rounded-full border border-garis-kuat px-2 py-0.5 text-xs" data-testid="lintas-topi">
          <ArrowsLeftRightIcon size={14} aria-hidden /> {t.lintasTopi}
        </p>
      )}
      {k.status !== "selesai" && (
        <p className="mt-1 text-sm">
          {k.tenggatTeks ? isiTeks(t.tenggat, { t: k.tenggatTeks }) : t.tanpaTenggat}
          {k.status === "jalan" && k.mulaiTeks && <span className="text-tinta-2">{isiTeks(t.mulai, { t: k.mulaiTeks })}</span>}
        </p>
      )}
      {k.status === "selesai" && <p className="mt-1 text-sm font-semibold" data-testid="durasi-nyata">{teksSelesai(k.aktual_menit, k.estimasi?.menit ?? null, bahasa)}</p>}
      <p className={`mt-1 text-sm ${k.estimasi ? "" : "text-cap"}`} data-testid="poin-kerja">{teksPoin(k.estimasi, bahasa)}</p>
      {k.estimasi && <p className="mt-0.5 text-xs text-tinta-2" data-testid="alasan-poin" lang={bahasa === "id" ? undefined : "id"}>{k.estimasi.alasan}</p>}
      {tim && <p className="mt-1 text-sm" data-testid="tim-kerja"><span className="text-tinta-2">{bahasa === "en" ? "Team: " : "Tim: "}</span><span data-pengguna>{tim}</span></p>}
      {(k.butir?.total ?? 0) > 0 && <p className="mt-0.5 text-xs text-tinta-2" data-testid="progres-butir">{bahasa === "en" ? "Checklist" : "Checklist"} {k.butir!.selesai}/{k.butir!.total}</p>}
      {pengelola && <UbahPoin kerja={k.id} judul={k.judul} poin={k.estimasi?.poin ?? null} teks={t} bahasa={bahasa} />}
      {k.status !== "selesai" && (
        <details className="mt-2" data-testid="tim-checklist">
          <summary className="cursor-pointer text-sm font-semibold">{bahasa === "en" ? "Team and checklist" : "Tim dan checklist"}</summary>
          <div className="mt-2 grid gap-4">
            {aturTim && <AturTim kerja={k.id} judul={k.judul} orang={orang} awal={(k.tim ?? []).map((x) => ({ id: x.id, porsi: x.porsi, pic: x.pic }))} en={bahasa === "en"} />}
            <ChecklistKerja kerja={k.id} judul={k.judul} butir={butir} en={bahasa === "en"} />
          </div>
        </details>
      )}
    </li>
  );
}

const pertama = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const ID_SAH = /^[0-9a-f-]{36}$/i;
const galatKpi = (b: Bahasa) => <p role="alert" className="mt-6 text-cap" data-testid="kpi-galat">{ambilKamus(b).kpi.gagal}</p>;

/**
 * Tab kinerja (F3-03). Staf: cermin miliknya (public.kpi_saya). Pemilik/admin/akuntan: tabel semua orang (public.kpi_minggu);
 * ?orang=<id> membuka cermin orang itu, layar yang sama dengan yang dilihat orangnya, tanpa formulir banding.
 */
async function BagianKpi({ semua, orang, bahasa }: { semua: boolean; orang: string | null; bahasa: Bahasa }) {
  const supabase = await createClient();
  if (!semua) {
    const [{ data, error }, { data: insentif }] = await Promise.all([
      supabase.rpc("kpi_saya", { p_mulai: null }),
      supabase.rpc("kolam_saya", { p_bulan: null }),
    ]);
    if (error || !data) return galatKpi(bahasa);
    const d = data as KpiSaya;
    return (
      <>
        <InsentifSaya k={(insentif ?? null) as KolamSaya} bahasa={bahasa} />
        {d.orang ? <CerminKpi k={d.orang} tim={d.rata_rata_tim} mulai={d.mulai} akhir={d.akhir} milikSendiri bahasa={bahasa} /> : <KpiTanpaOrang bahasa={bahasa} />}
      </>
    );
  }
  const { data, error } = await supabase.rpc("kpi_minggu", { p_mulai: null });
  if (error || !data) return galatKpi(bahasa);
  const d = data as KpiMinggu;
  if (!orang) return <KpiMingguIni data={d} bahasa={bahasa} />;
  const k = d.orang.find((o) => o.id === orang);
  return (
    <>
      <KembaliKeTabel bahasa={bahasa} />
      {k ? <CerminKpi k={k} tim={d.rata_rata_tim} mulai={d.mulai} akhir={d.akhir} milikSendiri={false} bahasa={bahasa} />
        : <p className="mt-4 text-tinta-2" data-testid="kpi-orang-hilang">{ambilKamus(bahasa).kpi.orangHilang}</p>}
    </>
  );
}

/**
 * Tab peta organisasi (F3-04, docs/design/peta-organisasi.md): pemilik, admin, akuntan (public.peta_organisasi, 4 minggu terakhir).
 * Tombol "Pasang topi" hanya untuk pemilik/admin; akuntan membaca.
 */
async function BagianPeta({ bolehUsul, bahasa }: { bolehUsul: boolean; bahasa: Bahasa }) {
  const t = ambilKamus(bahasa).peta;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("peta_organisasi", { p_minggu: 4 });
  if (error || !data) {
    return <p role="alert" className="mt-6 text-cap" data-testid="peta-galat">{t.gagal}</p>;
  }
  return <PetaOrganisasi p={bacaPeta(data as Peta)} bolehUsul={bolehUsul} teks={t} bahasa={bahasa} />;
}

/** Bulan berjalan (YYYY-MM) di zona usaha. */
const bulanIni = (zona: string) => new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);

/**
 * Tab kolam bonus beban (F3-05, docs/design/kolam-bonus-beban.md): pemilik dan admin. Bulan yang sudah disetujui menampilkan
 * pembagian tersimpan (public.kolam_bagian); selain itu pratinjau public.hitung_kolam dari ?bulan=&jumlah=&k=<id>~<alasan>.
 */
async function BagianKolam({ sp, pemilik, zona, bahasa }: { sp: Awaited<PageProps<"/app/kerja">["searchParams"]>; pemilik: boolean; zona: string; bahasa: Bahasa }) {
  const t = ambilKamus(bahasa).kolam;
  const bulan = bulanKolam(pertama(sp.bulan), bulanIni(zona));
  const jumlah = rupiahIsian(pertama(sp.jumlah));
  const kecualiBaru = pertama(sp.kecuali);
  const alasanBaru = pertama(sp.alasan);
  const daftarK = [...(Array.isArray(sp.k) ? sp.k : sp.k ? [sp.k] : []), ...(kecualiBaru && alasanBaru ? [`${kecualiBaru}~${alasanBaru}`] : [])];
  const kecuali = bacaPengecualian(daftarK);
  const supabase = await createClient();
  const [{ data: k, error: ek }, { data: per }] = await Promise.all([
    supabase.from("kolam_bonus")
      .select("id, jumlah, disetujui_at, dikecualikan, kolam_bagian(orang_id, poin, kerja_n, persen, rupiah, alasan, dibanding_ids, orang(nama, id_staf))")
      .eq("bulan", `${bulan}-01`).eq("status", "disetujui").maybeSingle(),
    supabase.from("periode_gaji").select("status").eq("bulan", `${bulan}-01`).maybeSingle(),
  ]);
  if (ek) return <p role="alert" className="mt-6 text-cap" data-testid="kolam-galat">{t.gagal}</p>;
  if (k) {
    const namaBulan = new Intl.DateTimeFormat(bahasa === "en" ? "en-US" : "id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${bulan}-01T00:00:00Z`));
    return <KolamDisetujui k={k as unknown as KolamTersimpan} bulan={bulan} namaBulan={namaBulan} terkunci={per?.status === "disetujui"} pemilik={pemilik} bahasa={bahasa}
      isian={<IsianKolam bulan={bulan} jumlah={jumlah} kecuali={kecuali} bahasa={bahasa} />} />;
  }
  let h: HitungKolam | null = null;
  let galat: string | null = null;
  if (pertama(sp.jumlah) !== undefined && !jumlah) galat = t.isiJumlah;
  else if (jumlah) {
    const { data, error } = await supabase.rpc("hitung_kolam", { p_bulan: `${bulan}-01`, p_jumlah: jumlah, p_dikecualikan: kecuali });
    if (error) galat = error.code === "22023" ? (bahasa === "id" ? error.message : isiTeks(ambilKamus(bahasa).kerjaPesan.galatDb, { pesan: error.message })) : error.code === "42501" ? t.hanyaPengelola : t.gagalHitung;
    else h = data as HitungKolam;
  }
  return <KolamBonus bulan={bulan} jumlah={jumlah} kecuali={kecuali} h={h} galat={galat} pemilik={pemilik} bahasa={bahasa} />;
}

async function Isi({ searchParams }: { searchParams: PageProps<"/app/kerja">["searchParams"] }) {
  const sesi = await wajibPerusahaan();
  const pengelola = sesi.peran === "pemilik" || sesi.peran === "admin";
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).kerja;
  const kepala = (
    <>
      <KepalaHalaman jalur="/app/kerja" judul={t.judul} ket={t.ket} />
    </>
  );
  const sp = await searchParams;
  const kolom = bacaKolom(sp.kolom);
  const namaTab = pertama(sp.tab);
  const tabBeban = pengelola && namaTab === "beban";
  const tabKpi = namaTab === "kpi";
  // Akuntan ikut membaca tabel kinerja (sama dengan public.kpi_minggu) dan peta organisasi; peran lain melihat cermin miliknya.
  const lihatSemua = pengelola || sesi.peran === "akuntan";
  const tabPeta = lihatSemua && namaTab === "peta";
  const tabBonus = pengelola && namaTab === "bonus";
  const daftarTab = [
    { href: "/app/kerja", label: t.tabPapan, aktif: !tabBeban && !tabKpi && !tabPeta && !tabBonus },
    ...(pengelola ? [{ href: "/app/kerja?tab=beban", label: t.tabBeban, aktif: tabBeban }] : []),
    { href: "/app/kerja?tab=kpi", label: lihatSemua ? t.tabKinerja : t.tabKerjamu, aktif: tabKpi },
    ...(lihatSemua ? [{ href: "/app/kerja?tab=peta", label: t.tabPeta, aktif: tabPeta }] : []),
    ...(pengelola ? [{ href: "/app/kerja?tab=bonus", label: t.tabBonus, aktif: tabBonus }] : []),
    { href: "/app/jadwal", label: t.tabJadwal, aktif: false },
  ];
  const tab = (
    <nav aria-label={t.tabAria} className="mt-4">
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
  if (tabBonus) {
    return (
      <>
        {kepala}
        {tab}
        <Suspense fallback={<KerangkaKolam />}>
          <BagianKolam sp={sp} pemilik={sesi.peran === "pemilik"} zona={await zonaUsahaIni(sesi.perusahaanId)} bahasa={bahasa} />
        </Suspense>
      </>
    );
  }
  if (tabPeta) {
    return (
      <>
        {kepala}
        {tab}
        <Suspense fallback={<KerangkaPeta />}>
          <BagianPeta bolehUsul={pengelola} bahasa={bahasa} />
        </Suspense>
      </>
    );
  }
  if (tabKpi) {
    const orang = pertama(sp.orang);
    return (
      <>
        {kepala}
        {tab}
        <Suspense fallback={<KerangkaKpi />}>
          <BagianKpi semua={lihatSemua} orang={lihatSemua && orang && ID_SAH.test(orang) ? orang : null} bahasa={bahasa} />
        </Suspense>
      </>
    );
  }
  const supabase = await createClient();
  const [{ data, error }, zona] = await Promise.all([supabase.rpc("papan_kerja"), zonaUsahaIni(sesi.perusahaanId)]);
  if (error) {
    return <>{kepala}<p role="alert" className="mt-6 text-cap" data-testid="kerja-galat">{t.gagalPapan}</p></>;
  }
  const sekarang = new Date();
  const daftar: KerjaTampil[] = ((data ?? []) as KerjaPapan[]).map((k) => ({
    ...k,
    tenggatTeks: k.tenggat ? formatTenggat(k.tenggat, sekarang, zona, bahasa) : null,
    mulaiTeks: k.mulai_at ? formatJam(new Date(k.mulai_at), zona, false) : null,
  }));

  // X-10 checklist: butir untuk kerja yang tampil (RLS: pengelola semua, staf hanya kerja timnya).
  const { data: dataButir } = daftar.length
    ? await supabase.from("kerja_butir").select("id, kerja_id, judul, selesai").in("kerja_id", daftar.map((k) => k.id)).eq("batal", false).order("urutan")
    : { data: [] };
  const butirPer: Record<string, Butir[]> = {};
  for (const b of (dataButir ?? []) as (Butir & { kerja_id: string })[]) (butirPer[b.kerja_id] ??= []).push({ id: b.id, judul: b.judul, selesai: b.selesai });

  // X-13B: staf atau akuntan dengan peran kustom kerja.kelola melihat papan pengelola dan formulir Tambah kerja. Nama rekan dan topi
  // datang dari RPC kelola_kerja_saya (security definer, hanya id dan nama), karena RLS orang membatasi staf ke dirinya sendiri.
  type Kelola = { kelola: boolean; orang: { id: string; nama: string }[]; topi: { id: string; nama: string }[] };
  const infoKelola = !pengelola && (sesi.peran === "staf" || sesi.peran === "akuntan") ? ((await supabase.rpc("kelola_kerja_saya")).data as Kelola | null) : null;
  const koordinator = Boolean(infoKelola?.kelola);
  if (koordinator && infoKelola) {
    // papan_kerja mengambil nama pelaksana lewat RLS orang, yang menutup nama rekan untuk staf; isi dari daftar rekan koordinator.
    const namaRekan = new Map(infoKelola.orang.map((o) => [o.id, o.nama]));
    for (const k of daftar) if (k.pelaksana && !k.pelaksana.nama) k.pelaksana = { ...k.pelaksana, nama: namaRekan.get(k.pelaksana.id) ?? k.pelaksana.nama };
  }

  if (sesi.peran === "staf" && !koordinator) {
    const [{ data: saya }, { data: review }] = await Promise.all([supabase.rpc("beban_saya", { p_mulai: null }), supabase.rpc("daftar_review_kelola")]);
    const tinjau = (review ?? []) as ReviewKelola[];
    return (
      <>
        {kepala}
        {tab}
        {saya && <BebanSayaIni data={saya as BebanSaya} bahasa={bahasa} />}
        {tinjau.length > 0 && <DaftarReviewKelola daftar={tinjau} />}
        {/* X-13: kepala divisi/koordinator ikut membaca kerja anggota lewat RLS; papan pribadi tetap hanya kerjanya sendiri. */}
        <PapanStaf daftar={daftar.filter((k) => k.saya)} teks={t} bahasa={bahasa} butir={butirPer} />
      </>
    );
  }

  const jumlah = ringkasStatus(daftar);
  let tambah = null;
  let daftarOrang: { id: string; nama: string }[] = [];
  if (koordinator && infoKelola) {
    daftarOrang = infoKelola.orang;
    tambah = <TambahKerja topi={infoKelola.topi} orang={infoKelola.orang} teks={t} bahasa={bahasa} bolehUsulan={false} />;
  } else if (pengelola) {
    const [{ data: topi }, { data: orang }] = await Promise.all([
      supabase.from("topi").select("id, nama").eq("aktif", true).order("nama"),
      supabase.from("orang").select("id, nama").eq("status", "aktif").order("nama"),
    ]);
    daftarOrang = (orang ?? []) as { id: string; nama: string }[];
    tambah = <TambahKerja topi={(topi ?? []) as { id: string; nama: string }[]} orang={(orang ?? []) as { id: string; nama: string }[]} teks={t} bahasa={bahasa} />;
  }

  if (tabBeban) {
    const { data: beban, error: eb } = await supabase.rpc("beban_minggu", { p_mulai: null });
    return (
      <>
        {kepala}
        {tab}
        <div className="mt-4">{tambah}</div>
        {eb || !beban
          ? <p role="alert" className="mt-6 text-cap" data-testid="beban-galat">{t.gagalBeban}</p>
          : <BebanMingguIni data={beban as BebanMinggu} bahasa={bahasa} />}
      </>
    );
  }

  return (
    <>
      {kepala}
      {tab}
      <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm" data-testid="ringkasan-kerja" aria-label={t.ringkasAria}>
        {STATUS_KERJA.map((s) => (
          <div key={s} className="flex gap-1">
            <dt className="text-tinta-2">{t.status[s]}</dt>
            <dd className="angka font-semibold" data-status={s}>{jumlah[s]}</dd>
          </div>
        ))}
      </dl>
      {koordinator && <ReviewKoordinator />}
      <div className="mt-4">{tambah ?? <p className="text-sm text-tinta-2">{t.ditambahPengelola}</p>}</div>

      {daftar.length === 0 ? (
        <div className="mt-6 flex flex-col items-start gap-3"><IlustrasiPapan className="w-28" /><p data-langkah='#judul-tambah-kerja' className="text-tinta-2" data-testid="kerja-kosong">{t.kosong}</p></div>
      ) : (
        <>
          <nav aria-label={t.saringKolom} className="mt-6 lg:hidden">
            <ul className="flex flex-wrap gap-2">
              {STATUS_KERJA.map((s) => (
                <li key={s}>
                  <Link
                    href={`/app/kerja?kolom=${s}`}
                    aria-current={kolom === s ? "page" : undefined}
                    className={`inline-flex min-h-11 items-center rounded-full border px-3 text-sm ${kolom === s ? "border-tinta bg-tinta font-semibold text-kertas" : "border-garis-kuat text-tinta"}`}
                  >
                    {t.status[s]} {jumlah[s]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-4 lg:mt-6 lg:grid lg:grid-cols-5 lg:divide-x lg:divide-garis lg:border-y lg:border-garis">
            {STATUS_KERJA.map((s: StatusKerja) => {
              const isi = daftar.filter((k) => k.status === s);
              return (
                <section key={s} aria-labelledby={`kolom-${s}`} data-testid={`kolom-${s}`} className={kolom === s ? "block" : "hidden lg:block"}>
                  <h2 id={`kolom-${s}`} className="border-b border-garis py-2 text-sm font-semibold lg:px-3">
                    {t.status[s]}{s === "selesai" ? t.selesaiHariIni : ""} <span className="angka text-tinta-2">({isi.length})</span>
                  </h2>
                  {isi.length ? (
                    <ul className="divide-y divide-garis">{isi.map((k) => <KartuKerja key={k.id} k={k} pengelola={pengelola} aturTim={pengelola || koordinator} t={t} bahasa={bahasa} orang={daftarOrang} butir={butirPer[k.id] ?? []} />)}</ul>
                  ) : (
                    <p className="py-3 text-sm text-tinta-2 lg:px-3">{t.tidakAda}</p>
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

/** X-13B: hasil kerja yang menunggu tinjauan koordinator (daftar yang sama dengan kepala divisi). */
async function ReviewKoordinator() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("daftar_review_kelola");
  const tinjau = (data ?? []) as ReviewKelola[];
  return tinjau.length > 0 ? <DaftarReviewKelola daftar={tinjau} /> : null;
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
      <Suspense fallback={<Kerangka />}>
        <Isi searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
