import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { Suspense } from "react";
import { FormBuatSurvei, FormIsiSurvei, type Pertanyaan } from "@/components/app/survei";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus, isiTeks, type Kamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { KepalaHalaman } from "@/components/app/kepala-halaman";

export const metadata: Metadata = { title: "Survei" };

type Survei = { id: string; judul: string; pertanyaan: Pertanyaan[]; anonim: boolean; tutup_tanggal: string | null };
type HasilQ = { id: string; teks: string; jenis: string; dijawab: number; rata: number | null; hitung: Record<string, number> | null; teks_jawaban: string[] | null };
type Hasil = { jumlah: number; ditahan: boolean; pertanyaan: HasilQ[] };

function Ringkasan({ h, t, bahasa }: { h: Hasil; t: Kamus["survei"]; bahasa: Bahasa }) {
  if (h.ditahan) return <p className="mt-2 text-sm text-tinta-2" data-testid="hasil-ditahan">{isiTeks(t.ditahan, { n: h.jumlah })}</p>;
  const angka = new Intl.NumberFormat(bahasa === "en" ? "en-US" : "id-ID", { maximumFractionDigits: 2 });
  return (
    <div className="mt-2 text-sm" data-testid="hasil-survei">
      <p className="text-tinta-2">{isiTeks(t.jumlahJawaban, { n: h.jumlah })}</p>
      <dl className="mt-2 space-y-2">
        {h.pertanyaan.map((q) => (
          <div key={q.id}>
            <dt className="font-semibold">{q.teks}</dt>
            <dd className="text-tinta-2">
              {q.jenis === "skala" && q.rata !== null && <span className="angka">{isiTeks(t.rata, { n: angka.format(Number(q.rata)) })}</span>}
              {q.jenis === "pilihan" && q.hitung && Object.entries(q.hitung).map(([k, v]) => `${k}: ${v}`).join(", ")}
              {q.jenis === "teks" && <ul className="list-disc pl-5">{(q.teks_jawaban ?? []).map((x, i) => <li key={i} data-pengguna>{x}</li>)}</ul>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// M-11B: survei anggota usaha. Anonim: akun tidak disimpan bersama jawaban, ringkasan baru tampil setelah 3 jawaban.
async function Isi() {
  const sesi = await wajibPerusahaan();
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).survei;
  const pengelola = sesi.peran === "pemilik" || sesi.peran === "admin";
  const supabase = await createClient();
  const [{ data: sv }, { data: isi }] = await Promise.all([
    supabase.from("survei").select("id, judul, pertanyaan, anonim, tutup_tanggal").order("dibuat_at", { ascending: false }).limit(20),
    supabase.from("survei_isi").select("survei_id"),
  ]);
  const daftar = (sv ?? []) as Survei[];
  const sudah = new Set(((isi ?? []) as { survei_id: string }[]).map((x) => x.survei_id));
  const hasil = new Map<string, Hasil>();
  if (pengelola) {
    for (const s of daftar) {
      const { data } = await supabase.rpc("hasil_survei", { p_survei: s.id });
      if (data) hasil.set(s.id, data as Hasil);
    }
  }
  return (
    <div lang={bahasa}>
      <KepalaHalaman jalur="/app/survei" judul={t.judulHalaman} ket={t.ket} />
      {daftar.length === 0 ? (
        <p data-langkah='#judul-buat-survei' className="mt-6 text-tinta-2" data-testid="survei-kosong">{t.kosong}</p>
      ) : (
        <ul className="mt-6 divide-y divide-garis border-y border-garis" data-testid="daftar-survei">
          {daftar.map((s) => (
            <li key={s.id} className="py-4" data-judul={s.judul}>
              <h2 className="font-semibold" data-pengguna>{s.judul}</h2>
              <p className="text-sm text-tinta-2">{s.anonim ? t.labelAnonim : t.labelTidakAnonim}</p>
              {sudah.has(s.id) ? <p className="mt-2 text-sm text-daun">{t.sudahIsi}</p> : <FormIsiSurvei survei={s.id} judul={s.judul} pertanyaan={s.pertanyaan} anonim={s.anonim} teks={t} />}
              {pengelola && hasil.get(s.id) && <Ringkasan h={hasil.get(s.id)!} t={t} bahasa={bahasa} />}
            </li>
          ))}
        </ul>
      )}
      {pengelola && (
        <section className="mt-8" aria-labelledby="judul-buat-survei">
          <h2 id="judul-buat-survei" className="text-lg font-semibold">{t.buatJudul}</h2>
          <FormBuatSurvei kunci={randomUUID()} teks={t} />
        </section>
      )}
    </div>
  );
}

export default function HalamanSurvei() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi />
      </Suspense>
    </main>
  );
}
