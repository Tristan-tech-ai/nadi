import { headers } from "next/headers";
import { ubahBukaLowongan } from "@/app/app/lowongan-actions";
import { FormLowongan } from "@/components/app/form-lowongan";
import { Cap } from "@/components/ui/cap";
import { Rupiah } from "@/components/ui/rupiah";
import { asalTautan } from "@/lib/mcp/http";
import { formatTanggal } from "@/lib/format";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import type { PeringatanBias } from "@/lib/rekrut/bias";
import { bankTalenta, pesanWa, sejakBank, tautanWa, type LamaranBank } from "@/lib/rekrut/keputusan";
import { createClient } from "@/lib/supabase/server";
import { zonaSesi } from "@/lib/zona-usaha";

type Lowongan = {
  id: string; judul: string; kode: string; buka: boolean; topi_id: string | null; peringatan: PeringatanBias[]; lamaran: { count: number }[]; biaya_iklan: number;
  perusahaan: { nama: string } | null;
};
type BarisLamaran = Omit<LamaranBank, "topi_id"> & { lowongan: { topi_id: string | null } | null };

/** Lowongan per topi dengan tautan lamar publik (P01). Pengelola saja (RLS). */
export async function KartuLowongan() {
  const dasar = asalTautan(await headers());
  const zona = await zonaSesi();
  const bahasa = await bahasaAplikasi();
  const t = ambilKamus(bahasa).lowongan;
  const isiLang = bahasa === "id" ? undefined : "id";
  const supabase = await createClient();
  // F2-05 Bank Talenta: pelamar 365 hari terakhir yang mengizinkan dihubungi lagi (RLS: usaha aktif, pengelola).
  const sejak = sejakBank();
  const [{ data: l }, { data: daftarTopi }, { data: izin }] = await Promise.all([
    supabase.from("lowongan").select("id, judul, kode, buka, topi_id, peringatan, biaya_iklan, lamaran(count), perusahaan(nama)").order("dibuat_at", { ascending: false }).limit(20),
    supabase.from("topi").select("id, nama").order("nama"),
    supabase.from("lamaran").select("id, lowongan_id, nama, telepon, tahap, boleh_dihubungi, dibuat_at, lowongan(topi_id)")
      .eq("boleh_dihubungi", true).neq("tahap", "diterima").gte("dibuat_at", sejak).order("dibuat_at", { ascending: false }).limit(500),
  ]);
  const daftar = (l ?? []) as unknown as Lowongan[];
  const bertopi = daftar.filter((x) => x.buka && x.topi_id).map((x) => x.id);
  // Nomor yang sudah melamar di lowongan itu sendiri tidak ditawarkan lagi.
  const { data: diSini } = bertopi.length && izin?.length
    ? await supabase.from("lamaran").select("id, lowongan_id, nama, telepon, tahap, boleh_dihubungi, dibuat_at, lowongan(topi_id)").in("lowongan_id", bertopi).limit(1000)
    : { data: [] };
  const keBank = (b: BarisLamaran): LamaranBank => ({ ...b, topi_id: b.lowongan?.topi_id ?? null });
  const bank = bankTalenta(daftar, [...((izin ?? []) as unknown as BarisLamaran[]).map(keBank), ...((diSini ?? []) as unknown as BarisLamaran[]).map((b) => ({ ...keBank(b), boleh_dihubungi: false }))]);
  return (
    <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-lowongan" data-testid="kartu-lowongan">
      <h2 id="judul-lowongan" className="text-lg font-semibold">{t.judul}</h2>
      <p className="mt-1 text-sm text-tinta-2">{t.ket}</p>
      {bahasa !== "id" ? <p className="mt-1 text-sm text-tinta-2">{t.pesanWaCatatan}</p> : null}
      <FormLowongan topi={(daftarTopi ?? []) as { id: string; nama: string }[]} teks={t} />
      {daftar.length === 0 ? (
        <p className="mt-4 text-sm text-tinta-2" data-testid="lowongan-kosong">{t.kosong}</p>
      ) : (
        <ul className="mt-4 divide-y divide-garis border-y border-garis" data-testid="daftar-lowongan">
          {daftar.map((x) => {
            const tautan = `${dasar}/lamar/${x.kode}`;
            return (
              <li key={x.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold" data-pengguna>{x.judul}</p>
                  <Cap jenis={x.buka ? "diterima" : "ditolak"} label={x.buka ? t.buka : t.tutup} />
                </div>
                <p className="mt-1 break-all font-mono" data-testid="tautan-lamar">{tautan}</p>
                <p className="text-tinta-2">{isiTeks(t.lamaranMasuk, { n: x.lamaran?.[0]?.count ?? 0 })}{x.biaya_iklan ? <>{t.biayaIklan} <Rupiah nilai={x.biaya_iklan} bahasa={bahasa} /></> : null}</p>
                {x.peringatan?.length ? (
                  <div className="mt-2 rounded-[var(--radius-isian)] border border-cap/40 p-3" data-testid="peringatan-lowongan">
                    <p className="font-semibold text-cap">{isiTeks(t.periksaSyarat, { n: x.peringatan.length })}</p>
                    {bahasa !== "id" ? <p className="text-tinta-2">{t.periksaKet}</p> : null}
                    <ul className="mt-1 grid gap-2" lang={isiLang}>
                      {x.peringatan.map((p) => (
                        <li key={p.kode} data-kode={p.kode}>
                          <span className="font-mono">&ldquo;{p.kutipan}&rdquo;</span>: {p.alasan} {p.saran}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {bank.get(x.id) && (
                  <div className="mt-2 rounded-[var(--radius-isian)] bg-kertas-2 p-3" data-testid="bank-talenta">
                    <p className="font-semibold">{t.bankJudul}</p>
                    <p className="text-tinta-2">{t.bankKet}</p>
                    <ul className="mt-2 grid gap-2">
                      {bank.get(x.id)!.map((b) => {
                        const wa = tautanWa(b.telepon, pesanWa("undangan", { nama: b.nama, usaha: x.perusahaan?.nama ?? "usaha kami", lowongan: x.judul, tautan }));
                        return (
                          <li key={b.lamaran} className="flex flex-wrap items-center justify-between gap-2">
                            <span><span data-pengguna>{b.nama}</span> <span className="text-tinta-2">· {isiTeks(t.melamar, { tanggal: formatTanggal(new Date(b.dibuat_at), zona, bahasa) })}</span></span>
                            {wa && (
                              <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center rounded-[var(--radius-isian)] border border-garis-kuat px-3 font-semibold">
                                <span>{t.undang}<span className="sr-only" data-pengguna> {b.nama}</span> {t.lewatWa}</span>
                              </a>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <a href={`https://wa.me/?text=${encodeURIComponent(`Lowongan ${x.judul}. Lamar lewat HP di ${tautan}`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center rounded-[var(--radius-isian)] border border-garis-kuat px-3 font-semibold">
                    {t.kirimWa}
                  </a>
                  <form action={ubahBukaLowongan}>
                    <input type="hidden" name="id" value={x.id} />
                    <input type="hidden" name="buka" value={x.buka ? "0" : "1"} />
                    <button type="submit" className="h-10 rounded-[var(--radius-isian)] px-3 font-semibold underline-offset-4 hover:underline" aria-label={isiTeks(x.buka ? t.ariaTutup : x.peringatan?.length ? t.ariaTetap : t.ariaBuka, { judul: x.judul })}>
                      {x.buka ? t.tutupLowongan : x.peringatan?.length ? t.tetapBuka : t.bukaLagi}
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
