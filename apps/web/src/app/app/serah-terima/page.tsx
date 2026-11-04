import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { Suspense } from "react";
import { IlustrasiKunci } from "@/components/ilustrasi";
import { FormBatalBerhenti, FormCatatBerhenti, FormCentang, FormPengganti, FormPindahkan } from "@/components/app/serah-terima";
import { IlmuPemilik, type IlmuTampil } from "@/components/app/ilmu-pemilik";
import { TautanKeluar } from "@/components/app/wawancara-keluar";
import type { ModelTranskrip } from "@/lib/wawancara/transkrip";
import { Cap } from "@/components/ui/cap";
import { formatTanggal, formatTanggalKalender } from "@/lib/format";
import { ambilKamus, isiTeks, type Kamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { sisip } from "@/lib/i18n/sisip";
import { hariIni } from "@/lib/izin";
import { formatDurasi } from "@/lib/wawancara/rekam";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { zonaUsahaIni } from "@/lib/zona-usaha";

export const metadata: Metadata = { title: "Serah terima" };

// F3-07 (docs/design/serah-terima-layar.md): paket serah terima orang yang berhenti; akses dicabut otomatis setelah tanggal efektif.

type Keluar = { berhenti_id: string; jawaban: { membantu: string | null; berat: string | null; ubah: string | null } | null; dijawab_at: string | null };
type Berhenti = { id: string; orang_id: string; tanggal_surat: string; tanggal_efektif: string; alasan: string; peringatan: string[]; status: "disiapkan" | "selesai" | "batal"; orang: { nama: string; telepon: string | null } | null };
type Butir = { id: string; berhenti_id: string; jenis: "kerja" | "topi" | "ilmu" | "akses_otomatis" | "akses_manual"; judul: string; status: string; pengganti_id: string | null; durasi_detik: number | null;
  transkrip: string | null; langkah: string[] | null; langkah_sumber: "model" | "pemilik" | null; berkas: { jalur: string } | null };

const selisihHari = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

function Paket({ b, butir, orang, hari, t, bahasa, url, model, tIlmu, keluar, tKeluar, pemilik, zona }: { b: Berhenti; butir: Butir[]; orang: { id: string; nama: string }[]; hari: string; t: Kamus["serahTerima"]; bahasa: "id" | "en"; url: Map<string, string>; model: ModelTranskrip | null; tIlmu: Kamus["ilmuPemilik"]; keluar: Keluar | undefined; tKeluar: Kamus["wkPemilik"]; pemilik: boolean; zona: string }) {
  const ALASAN: Record<string, string> = { mundur: t.aMundur, kontrak_selesai: t.aKontrak, lainnya: t.aLain };
  const isiLang = bahasa === "id" ? undefined : "id";
  // Judul butir ditulis Nadi/pengguna dalam bahasa Indonesia; nama orang adalah data pengguna.
  const J = ({ x }: { x: Butir }) => <span lang={isiLang} data-pengguna>{x.judul}</span>;
  const tgl = (s: string) => formatTanggalKalender(s, bahasa);
  const namaPlain = b.orang?.nama ?? t.orangIni;
  const nama = <span data-pengguna>{namaPlain}</span>;
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
        <h2 id={`judul-${b.id}`} className="text-lg font-semibold">{sisip(t.judulPaket, { nama, tanggal: tgl(b.tanggal_efektif) })}</h2>
        {b.status === "selesai" ? <Cap jenis="diterima" label={t.selesai} /> : b.status === "batal" ? <Cap jenis="ditolak" label={t.batal} /> : <Cap jenis="menunggu" label={sisa > 0 ? isiTeks(t.hariLagi, { n: sisa }) : sisa === 0 ? t.hariTerakhir : t.dicabutSegera} />}
      </div>
      <p className="mt-1 text-sm text-tinta-2">{isiTeks(t.suratDiterima, { tanggal: tgl(b.tanggal_surat), alasan: ALASAN[b.alasan] ?? b.alasan })}</p>
      {b.peringatan.includes("kurang_30_hari") && aktif && (
        <p className="mt-2 rounded-[var(--radius-isian)] bg-kunyit px-3 py-2 text-sm text-[var(--stabilo-teks)]">{t.peringatan30}</p>
      )}

      <h3 className="mt-5 font-semibold">{t.kerjaTopi}</h3>
      {kerja.length + per("topi").length === 0 ? (
        <p className="mt-1 text-sm text-tinta-2">{sisip(t.tanpaKerja, { nama })}</p>
      ) : (
        <ul className="mt-2 divide-y divide-garis border-y border-garis text-sm" data-testid="butir-kerja">
          {[...per("topi"), ...kerja].map((x) => (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p>{x.jenis === "topi" ? t.topi : ""}<J x={x} /></p>
                <p className="text-tinta-2">{x.status === "selesai" ? sisip(t.sudahDipindah, { nama: <span data-pengguna>{namaOrang.get(x.pengganti_id ?? "") ?? t.pengganti}</span> }) : x.pengganti_id ? sisip(t.usulanPengganti, { nama: <span data-pengguna>{namaOrang.get(x.pengganti_id) ?? t.rekan}</span> }) : t.tanpaRekan}</p>
              </div>
              {aktif && x.status !== "selesai" && <FormPengganti butir={x.id} judul={x.judul} pengganti={x.pengganti_id} orang={calon} teks={t} />}
            </li>
          ))}
        </ul>
      )}
      {aktif && kerja.length > 0 && <FormPindahkan berhenti={b.id} jumlah={bisaPindah} teks={t} />}

      <h3 className="mt-6 font-semibold">{sisip(t.ilmu, { nama })}</h3>
      {per("ilmu").length === 0 ? (
        <p className="mt-1 text-sm text-tinta-2">{sisip(t.tanpaIlmu, { nama })}</p>
      ) : (
        <ul className="mt-2 divide-y divide-garis border-y border-garis text-sm">
          {per("ilmu").map((x) => (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <p><J x={x} />{x.status === "selesai" ? t.sudahDijelaskan : ""}<span className="text-tinta-2" data-testid="status-rekam">{x.durasi_detik ? isiTeks(t.direkam, { durasi: formatDurasi(x.durasi_detik) }) : t.belumDirekam}</span></p>
              {aktif && <FormCentang butir={x.id} judul={x.judul} selesai={x.status === "selesai"} teks={t} />}
              {x.berkas ? <IlmuPemilik bahasa={bahasa} teks={tIlmu} model={model} ilmu={{ id: x.id, judul: x.judul, url: url.get(x.berkas.jalur) ?? null, transkrip: x.transkrip, langkah: x.langkah, sumber: x.langkah_sumber } satisfies IlmuTampil} /> : null}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-xs text-tinta-2">{sisip(t.mintaJelaskan, { nama })} {sisip(t.mintaRekam, { nama })}</p>

      <h3 className="mt-6 font-semibold">{t.akses}</h3>
      <p className="mt-1 text-sm text-tinta-2">{isiTeks(t.aksesOtomatis, { tanggal: tgl(b.tanggal_efektif) })}</p>
      <ul className="mt-1 list-disc pl-5 text-sm" data-testid="akses-otomatis">
        {per("akses_otomatis").length === 0 ? <li>{sisip(t.tanpaAkun, { nama })}</li> : per("akses_otomatis").map((x) => <li key={x.id}><J x={x} />{x.status === "selesai" ? t.sudahDicabut : ""}</li>)}
      </ul>
      <p className="mt-3 text-sm text-tinta-2">{t.dicekSendiri}</p>
      <ul className="mt-1 divide-y divide-garis border-y border-garis text-sm" data-testid="akses-manual">
        {per("akses_manual").map((x) => (
          <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <p><J x={x} />{x.status === "selesai" ? t.beres : ""}</p>
            {aktif && <FormCentang butir={x.id} judul={x.judul} selesai={x.status === "selesai"} teks={t} />}
          </li>
        ))}
      </ul>
      {pemilik && (
        <section data-testid="wawancara-keluar">
          <h3 className="mt-6 font-semibold">{tKeluar.judul}</h3>
          <p className="mt-1 text-sm text-tinta-2">{sisip(tKeluar.ket, { nama })}</p>
          {keluar?.dijawab_at && keluar.jawaban ? (
            <div className="mt-2 text-sm" data-testid="jawaban-keluar">
              <p className="text-tinta-2">{isiTeks(tKeluar.dijawab, { tanggal: formatTanggal(new Date(keluar.dijawab_at), zona, bahasa) })}</p>
              <dl className="mt-2 grid gap-2">
              {(["membantu", "berat", "ubah"] as const).map((k) => keluar.jawaban?.[k] ? (
                <div key={k}><dt className="font-semibold">{tKeluar[k]}</dt><dd className="whitespace-pre-line" lang={bahasa === "id" ? undefined : "id"} data-pengguna>{keluar.jawaban[k]}</dd></div>
              ) : null)}
              </dl>
            </div>
          ) : (
            <>
              <p className="mt-1 text-sm text-tinta-2">{tKeluar.belum}</p>
              {aktif && <TautanKeluar berhenti={b.id} nama={namaPlain} hp={b.orang?.telepon ?? null} ada={!!keluar} teks={tKeluar} bahasa={bahasa} />}
            </>
          )}
        </section>
      )}
      <p className="mt-6 text-sm text-tinta-2">{t.hakKeuangan}</p>
      {aktif && <FormBatalBerhenti berhenti={b.id} teks={t} />}
    </article>
  );
}

async function Isi({ searchParams }: { searchParams: PageProps<"/app/serah-terima">["searchParams"] }) {
  const sesi = await wajibPerusahaan();
  const bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).serahTerima;
  const kepala = (
    <>
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">{t.judul}</h1>
      <p className="mt-2 text-tinta-2">{t.ket}</p>
    </>
  );
  if (sesi.peran !== "pemilik" && sesi.peran !== "admin") {
    return <div lang={bahasa}>{kepala}<p className="mt-6 text-tinta-2">{t.hanyaPeran}</p></div>;
  }
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: bh }, { data: org }, zona] = await Promise.all([
    supabase.from("berhenti").select("id, orang_id, tanggal_surat, tanggal_efektif, alasan, peringatan, status, orang:orang_id(nama, telepon)").neq("status", "batal").order("dibuat_at", { ascending: false }).limit(10),
    supabase.from("orang").select("id, nama").eq("status", "aktif").order("nama").limit(500),
    zonaUsahaIni(sesi.perusahaanId),
  ]);
  const daftar = (bh ?? []) as unknown as Berhenti[];
  const { data: bt } = daftar.length
    ? await supabase.from("serah_butir").select("id, berhenti_id, jenis, judul, status, pengganti_id, durasi_detik, transkrip, langkah, langkah_sumber, berkas:berkas_id(jalur)").in("berhenti_id", daftar.map((b) => b.id)).order("dibuat_at")
    : { data: [] };
  const butir = (bt ?? []) as unknown as Butir[];
  // F3-07C: klip Rekam Ilmu lewat tautan bertanda 1 jam; model transkrip di perangkat dari konfigurasi (pola wawancara F2-03).
  const jalur = butir.map((x) => x.berkas?.jalur).filter((j): j is string => !!j);
  const [{ data: tautan }, { data: konf }] = await Promise.all([
    jalur.length ? supabase.storage.from("berkas").createSignedUrls(jalur, 3600) : Promise.resolve({ data: [] as { path: string | null; signedUrl: string }[] }),
    supabase.from("konfigurasi").select("nilai").eq("kunci", "model_transkrip").maybeSingle(),
  ]);
  const url = new Map<string, string>((tautan ?? []).flatMap((x) => (x.path && x.signedUrl ? [[x.path, x.signedUrl] as [string, string]] : [])));
  const model = (konf?.nilai ?? null) as ModelTranskrip | null;
  const tIlmu = ambilKamus(bahasa).ilmuPemilik;
  const tKeluar = ambilKamus(bahasa).wkPemilik;
  // Jawaban wawancara keluar hanya terbaca pemilik (RLS wawancara_keluar_baca); admin mendapat daftar kosong.
  const { data: wk } = daftar.length
    ? await supabase.from("wawancara_keluar").select("berhenti_id, jawaban, dijawab_at").in("berhenti_id", daftar.map((x) => x.id))
    : { data: [] };
  const keluar = new Map(((wk ?? []) as Keluar[]).map((x) => [x.berhenti_id, x]));
  const orang = (org ?? []) as { id: string; nama: string }[];
  const hari = hariIni(new Date(), zona);
  return (
    <div lang={bahasa}>
      {kepala}
      <FormCatatBerhenti orang={orang} pilih={typeof sp.orang === "string" ? sp.orang : ""} hari={hari} kunci={randomUUID()} teks={t} />
      {daftar.length === 0
        ? <div className="mt-8 flex flex-col items-start gap-3"><IlustrasiKunci className="w-28" /><p className="text-tinta-2" data-testid="serah-kosong">{t.kosong}</p></div>
        : daftar.map((b) => <Paket key={b.id} b={b} butir={butir.filter((x) => x.berhenti_id === b.id)} orang={orang} hari={hari} t={t} bahasa={bahasa} url={url} model={model} tIlmu={tIlmu} keluar={keluar.get(b.id)} tKeluar={tKeluar} pemilik={sesi.peran === "pemilik"} zona={zona} />)}
    </div>
  );
}

export default function SerahTerima(props: PageProps<"/app/serah-terima">) {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
