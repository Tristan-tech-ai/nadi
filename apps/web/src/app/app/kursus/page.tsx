import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FormKuis, FormKursus, FormSoal } from "@/components/app/kursus";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { isiTeks } from "@/lib/i18n/isi-teks";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Kursus" };

type Kursus = { id: string; judul: string; ringkasan: string | null; materi: string[]; ambang: number; sumber_butir_id: string | null };
type Soal = { id: string; course_id: string; pertanyaan: string; pilihan: string[] };
type Progres = { orang: string; nama: string; terbaik: number; coba: number; sertifikat: string | null };

async function Isi() {
  const sesi = await wajibPerusahaan();
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).kursus;
  const supabase = await createClient();
  const pengelola = sesi.peran === "pemilik" || sesi.peran === "admin";
  const { data: ang } = await supabase.from("anggota").select("orang_id").eq("perusahaan_id", sesi.perusahaanId).eq("user_id", sesi.userId).maybeSingle();
  const saya = (ang?.orang_id as string | null) ?? null;

  const [kur, soal, serti, coba, butir] = await Promise.all([
    supabase.from("course").select("id, judul, ringkasan, materi, ambang, sumber_butir_id").eq("aktif", true).order("dibuat_at", { ascending: false }).limit(30),
    // Kolom kunci tidak pernah diminta: hak bacanya memang tidak diberikan ke klien.
    supabase.from("course_question").select("id, course_id, pertanyaan, pilihan").order("urutan"),
    saya ? supabase.from("certificate").select("course_id, kode, nomor, skor").eq("orang_id", saya) : Promise.resolve({ data: [] }),
    saya ? supabase.from("course_attempt").select("course_id, skor").eq("orang_id", saya) : Promise.resolve({ data: [] }),
    pengelola ? supabase.from("serah_butir").select("id, judul").eq("jenis", "ilmu").not("langkah", "is", null).order("dibuat_at", { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
  ]);
  const daftar = (kur.data ?? []) as Kursus[];
  const soalPer = new Map<string, Soal[]>();
  for (const q of (soal.data ?? []) as Soal[]) soalPer.set(q.course_id, [...(soalPer.get(q.course_id) ?? []), q]);
  const sertiPer = new Map(((serti.data ?? []) as { course_id: string; kode: string; nomor: string; skor: number }[]).map((s) => [s.course_id, s]));
  const terbaik = new Map<string, number>();
  for (const a of (coba.data ?? []) as { course_id: string; skor: number }[]) terbaik.set(a.course_id, Math.max(terbaik.get(a.course_id) ?? 0, a.skor));
  const progres = new Map<string, Progres[]>(pengelola ? await Promise.all(daftar.slice(0, 10).map(async (c) =>
    [c.id, ((await supabase.rpc("course_progress", { p_course: c.id })).data ?? []) as Progres[]] as const)) : []);
  const sel = "border-b border-garis py-2 pr-3";

  return (
    <div lang={bahasa}>
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">{t.judul}</h1>
      <p className="mt-1 max-w-2xl text-sm text-tinta-2">{t.ket}</p>
      {!saya && !pengelola && <p className="mt-3 text-sm text-tinta-2">{t.tanpaOrang}</p>}

      {daftar.length === 0 ? <p className="mt-8 text-sm text-tinta-2">{pengelola ? t.kosongPengelola : t.kosong}</p> : (
        <div className="mt-8 grid gap-8">{daftar.map((c) => {
          const qs = soalPer.get(c.id) ?? [];
          const s = sertiPer.get(c.id);
          const pr = progres.get(c.id) ?? [];
          return (
            <section key={c.id} aria-labelledby={`k-${c.id}`} data-testid="kursus" className="min-w-0 rounded-[var(--radius-kartu)] border border-garis p-4 sm:p-6">
              <h2 id={`k-${c.id}`} className="text-lg font-semibold" data-pengguna>{c.judul}</h2>
              <p className="mt-1 text-sm text-tinta-2">
                {isiTeks(t.info, { soal: qs.length, ambang: c.ambang })}{c.sumber_butir_id ? `. ${t.dariRekam}` : ""}
                {saya && terbaik.has(c.id) ? `. ${isiTeks(t.terbaikmu, { skor: terbaik.get(c.id)! })}` : ""}
              </p>
              {c.ringkasan && <p className="mt-2" data-pengguna>{c.ringkasan}</p>}
              <h3 className="mt-4 text-sm font-semibold">{t.materiJudul}</h3>
              <ol className="mt-2 grid max-w-2xl list-decimal gap-2 pl-5">{c.materi.map((m, i) => <li key={i} data-pengguna>{m}</li>)}</ol>
              {s && <p className="mt-4 text-daun" data-testid="sertifikatku">{t.sudahLulus} <Link href={`/sertifikat/${s.kode}`} className="underline underline-offset-4">{isiTeks(t.lihatSertifikat, { nomor: s.nomor })}</Link></p>}
              {saya && qs.length > 0 && !s && <><h3 className="mt-6 text-sm font-semibold">{t.kuisJudul}</h3><FormKuis course={c.id} judul={c.judul} soal={qs} teks={t} /></>}
              {saya && qs.length === 0 && <p className="mt-4 text-sm text-tinta-2">{t.belumAdaSoal}</p>}
              {pengelola && (<>
                <h3 className="mt-6 text-sm font-semibold">{t.soalJudul}</h3>
                {qs.length > 0 && <ol className="mt-2 grid list-decimal gap-1 pl-5 text-sm">{qs.map((q) => <li key={q.id}><span data-pengguna>{q.pertanyaan}</span> <span className="text-tinta-2">({isiTeks(t.nPilihan, { n: q.pilihan.length })})</span></li>)}</ol>}
                <FormSoal course={c.id} judul={c.judul} teks={t} />
                <h3 className="mt-6 text-sm font-semibold">{t.progresJudul}</h3>
                {pr.length === 0 ? <p className="mt-1 text-sm text-tinta-2">{t.progresKosong}</p> : (
                  <div className="mt-2 overflow-x-auto" tabIndex={0} role="region" aria-label={isiTeks(t.progresDari, { judul: c.judul })}>
                    <table className="w-full min-w-[28rem] text-left text-sm">
                      <thead className="text-tinta-2"><tr><th className={sel}>{t.kolNama}</th><th className={`${sel} text-right`}>{t.kolTerbaik}</th><th className={`${sel} text-right`}>{t.kolCoba}</th><th className={sel}>{t.kolSertifikat}</th></tr></thead>
                      <tbody>{pr.map((x) => (
                        <tr key={x.orang} data-testid="progres-kursus"><td className={sel} data-pengguna>{x.nama}</td><td className={`${sel} angka text-right`}>{x.terbaik}</td><td className={`${sel} angka text-right`}>{x.coba}</td>
                          <td className={sel}>{x.sertifikat ? <Link href={`/sertifikat/${x.sertifikat}`} className="underline underline-offset-4">{t.ada}</Link> : t.belum}</td></tr>))}</tbody>
                    </table>
                  </div>
                )}
              </>)}
            </section>
          );
        })}</div>
      )}

      {pengelola && (
        <section className="mt-10" aria-labelledby="kursus-baru"><h2 id="kursus-baru" className="text-lg font-semibold">{t.kursusBaru}</h2>
          <p className="mt-1 max-w-2xl text-sm text-tinta-2">{t.kursusBaruKet}</p>
          <FormKursus butir={(butir.data ?? []) as { id: string; judul: string }[]} teks={t} />
        </section>
      )}
    </div>
  );
}

export default function HalamanKursus() {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <Suspense fallback={<div aria-hidden className="h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" />}>
        <Isi />
      </Suspense>
    </main>
  );
}
