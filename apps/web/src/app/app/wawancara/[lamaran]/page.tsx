import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { HasilUji, type BarisUji } from "@/components/app/hasil-uji";
import { CatatKaryawan } from "@/components/app/catat-karyawan";
import { KeputusanLamaran } from "@/components/app/keputusan-lamaran";
import { TranskripJawaban } from "@/components/app/transkrip-jawaban";
import { formatDurasi } from "@/lib/wawancara/rekam";
import { ringkasanWawancara } from "@/lib/wawancara/pertanyaan";
import type { ModelTranskrip } from "@/lib/wawancara/transkrip";
import { formatTanggal } from "@/lib/format";
import { hariIni } from "@/lib/izin";
import { pesanWa, tahapSah, tampilHp, tautanWa } from "@/lib/rekrut/keputusan";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { sisip } from "@/lib/i18n/sisip";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { zonaUsahaIni } from "@/lib/zona-usaha";
import { KepalaHalaman } from "@/components/app/kepala-halaman";

export const metadata: Metadata = { title: "Wawancara dan uji pelamar" };

type Topi = { nama: string; keahlian: unknown; tanggung_jawab: unknown };
type Lamaran = {
  id: string; nama: string; dibuat_at: string; telepon: string | null; tahap: string; pesan_tahap: string | null; tahap_at: string | null; orang_id: string | null;
  boleh_dihubungi: boolean; perusahaan: { nama: string } | null; lowongan: { judul: string; topi: Topi | null } | null;
};
type Jawaban = { id: string; urutan: number; pertanyaan: string; durasi_detik: number; transkrip: string | null; berkas: { jalur: string } | null };

const ID_SAH = /^[0-9a-f-]{36}$/i;

async function Isi({ params }: { params: Promise<{ lamaran: string }> }) {
  const { lamaran: id } = await params;
  const sesi = await wajibPerusahaan();
  const bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).wawancara;
  const isiLang = bahasa === "id" ? undefined : "id";
  const kembali = <Link href="/app" className="text-sm text-laut underline underline-offset-4">{t.kembali}</Link>;
  if (sesi.peran !== "pemilik" && sesi.peran !== "admin") {
    return <div lang={bahasa}>{kembali}<p className="mt-8 text-tinta-2" data-testid="ditolak">{t.ditolak}</p></div>;
  }
  const supabase = await createClient();
  const [{ data: la }, { data: jw }, { data: konf }, { data: uji }] = await Promise.all([
    ID_SAH.test(id) ? supabase.from("lamaran").select("id, nama, dibuat_at, telepon, tahap, pesan_tahap, tahap_at, boleh_dihubungi, orang_id, perusahaan(nama), lowongan(judul, topi(nama, keahlian, tanggung_jawab))").eq("id", id).maybeSingle() : Promise.resolve({ data: null }),
    ID_SAH.test(id) ? supabase.from("jawaban_wawancara").select("id, urutan, pertanyaan, durasi_detik, transkrip, berkas(jalur)").eq("lamaran_id", id).eq("status", "masuk").order("urutan") : Promise.resolve({ data: null }),
    supabase.from("konfigurasi").select("nilai").eq("kunci", "model_transkrip").maybeSingle(),
    ID_SAH.test(id) ? supabase.from("uji_lamaran").select("jenis, topi_kode, benih, jawaban, selesai_at").eq("lamaran_id", id) : Promise.resolve({ data: null }),
  ]);
  const lamaran = la as unknown as Lamaran | null;
  if (!lamaran) return <div lang={bahasa}>{kembali}<p role="alert" className="mt-8 text-tinta-2" data-testid="lamaran-tidak-ada">{t.tidakAda}</p></div>;
  const jawaban = (jw ?? []) as unknown as Jawaban[];
  const jalur = jawaban.map((j) => j.berkas?.jalur).filter((x): x is string => !!x);
  const { data: tautan } = jalur.length ? await supabase.storage.from("berkas").createSignedUrls(jalur, 3600) : { data: [] };
  const urlDari = new Map((tautan ?? []).map((t) => [t.path, t.signedUrl]));
  const model = (konf?.nilai ?? null) as ModelTranskrip | null;
  const zona = await zonaUsahaIni(sesi.perusahaanId);
  const topi = lamaran.lowongan?.topi ?? null;
  const ringkas = topi && jawaban.some((j) => j.transkrip) ? ringkasanWawancara(topi, jawaban) : null;
  // F2-05: setelah memutuskan, teks tawaran atau penolakan yang sopan dikirim pemilik sendiri lewat wa.me.
  const tahap = tahapSah(lamaran.tahap) ? lamaran.tahap : "masuk";
  const jenisWa = tahap === "ditawari" ? "tawaran" : tahap === "ditolak" ? "penolakan" : null;
  const hrefWa = jenisWa
    ? tautanWa(lamaran.telepon, pesanWa(jenisWa, { nama: lamaran.nama, usaha: lamaran.perusahaan?.nama ?? "usaha kami", lowongan: lamaran.lowongan?.judul ?? "lowongan ini", pesan: lamaran.pesan_tahap, simpan: lamaran.boleh_dihubungi }))
    : null;

  const namaTopi = <span data-pengguna>{topi?.nama ?? t.lowonganIni}</span>;
  return (
    <div lang={bahasa}>
      {kembali}
      <div className="mt-6"><KepalaHalaman jalur="/app/rekrutmen" judul={<span data-pengguna>{lamaran.nama}</span>} ket={sisip(t.melamar, { lowongan: <span data-pengguna>{lamaran.lowongan?.judul}</span>, tanggal: formatTanggal(new Date(lamaran.dibuat_at), zona, bahasa) })} /></div>
      {bahasa !== "id" && <p className="mt-2 text-sm text-tinta-2" data-testid="khusus-indonesia">{t.khususId}</p>}

      <HasilUji baris={(uji ?? []) as BarisUji[]} teks={t} bahasa={bahasa} />

      <section className="mt-6 rounded-[var(--radius-kartu)] bg-kertas-2 p-4" data-testid="ringkasan-wawancara" aria-labelledby="judul-ringkasan">
        <h2 id="judul-ringkasan" className="font-semibold">{t.ringkasan}</h2>
        {!jawaban.length ? (
          <p className="mt-1 text-tinta-2">{t.belumJawab}</p>
        ) : !ringkas ? (
          <p className="mt-1 text-tinta-2">{sisip(t.jawabanMasuk, { n: jawaban.length, topi: namaTopi })}</p>
        ) : (
          <>
            <p className="mt-1">
              {sisip(t.rubrik, { topi: namaTopi, cocok: <span className="angka font-semibold">{ringkas.nilai.cocok.length}</span>, dari: <span className="angka">{ringkas.nilai.cocok.length + ringkas.nilai.kurang.length}</span>, skor: <span className="angka font-semibold" data-testid="skor-wawancara">{ringkas.nilai.skor}</span> })}
            </p>
            {ringkas.kutipan.length > 0 && (
              <ul className="mt-3 flex flex-col gap-2">
                {ringkas.kutipan.map((q) => (
                  <li key={q.kriteria} className="border-l-2 border-kunyit pl-3 text-sm" lang={isiLang} data-pengguna>
                    <span className="font-semibold">{q.kriteria}.</span> &ldquo;{q.kalimat}&rdquo;
                  </li>
                ))}
              </ul>
            )}
            {ringkas.nilai.kurang.length > 0 && <p className="mt-3 text-sm text-tinta-2">{sisip(t.belumTerdengar, { daftar: <span lang={isiLang} data-pengguna>{ringkas.nilai.kurang.join(", ")}</span> })}</p>}
            {ringkas.jawabanKosong > 0 && <p className="mt-1 text-sm text-tinta-2">{isiTeks(t.belumTranskripN, { n: ringkas.jawabanKosong })}</p>}
          </>
        )}
        <p className="mt-3 text-xs text-tinta-2">{t.catatanMesin}</p>
      </section>

      <KeputusanLamaran
        lamaran={lamaran.id}
        nama={lamaran.nama}
        tahap={tahap}
        tanggal={lamaran.tahap_at ? formatTanggal(new Date(lamaran.tahap_at), zona, bahasa) : null}
        pesan={lamaran.pesan_tahap}
        hp={lamaran.telepon ? tampilHp(lamaran.telepon) : null}
        wa={hrefWa ? { href: hrefWa, label: jenisWa === "tawaran" ? t.waTawaran : t.waKabar } : null}
        teks={t}
        bahasa={bahasa}
      />
      {tahap === "diterima" && (lamaran.orang_id
        ? <p className="mt-3 text-sm text-tinta-2" data-testid="sudah-karyawan">{sisip(t.sudahKaryawan, { nama: <span data-pengguna>{lamaran.nama}</span> })}</p>
        : <CatatKaryawan lamaran={lamaran.id} nama={lamaran.nama} hari={hariIni(new Date(), zona)} teks={t} />)}

      <ol className="mt-6 flex flex-col gap-4">
        {jawaban.map((j) => {
          const url = j.berkas ? urlDari.get(j.berkas.jalur) : undefined;
          return (
            <li key={j.id} className="rounded-[var(--radius-kartu)] border border-garis p-4" data-testid={`jawaban-${j.urutan}`}>
              <p className="text-sm text-tinta-2">{sisip(t.pertanyaan, { n: j.urutan + 1, durasi: <span className="angka">{formatDurasi(Number(j.durasi_detik))}</span> })}</p>
              <h3 className="font-semibold" lang={isiLang}>{j.pertanyaan}</h3>
              {url ? (
                <audio controls preload="none" src={url} className="mt-3 w-full" aria-label={isiTeks(t.klipAria, { n: j.urutan + 1 })} />
              ) : (
                <p className="mt-3 text-sm text-cap">{t.klipGagal}</p>
              )}
              {j.transkrip ? (
                <p className="mt-3 rounded-[var(--radius-isian)] bg-kertas-2 px-3 py-2 text-sm" data-testid={`teks-transkrip-${j.urutan}`} lang={isiLang} data-pengguna>{j.transkrip}</p>
              ) : (
                <p className="mt-3 text-sm text-tinta-2">{t.belumTranskrip}</p>
              )}
              {url && <div className="mt-3"><TranskripJawaban jawabanId={j.id} urutan={j.urutan} url={url} model={model} ada={!!j.transkrip} teks={t} /></div>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// Layar penilai wawancara suara (F2-03): ringkasan rubrik dari transkrip, klip asli lewat tautan bertanda 1 jam, transkrip di perangkat.
export default function Wawancara(props: { params: Promise<{ lamaran: string }> }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-6">
      <Suspense fallback={<div className="mt-8 h-96 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi params={props.params} />
      </Suspense>
    </main>
  );
}
