import { headers } from "next/headers";
import { ubahBukaLowongan } from "@/app/app/lowongan-actions";
import { FormLowongan } from "@/components/app/form-lowongan";
import { Cap } from "@/components/ui/cap";
import { asal } from "@/lib/mcp/http";
import type { PeringatanBias } from "@/lib/rekrut/bias";
import { createClient } from "@/lib/supabase/server";

type Lowongan = { id: string; judul: string; kode: string; buka: boolean; peringatan: PeringatanBias[]; lamaran: { count: number }[] };

/** Lowongan per topi dengan tautan lamar publik (P01). Pengelola saja (RLS). */
export async function KartuLowongan() {
  const supabase = await createClient();
  const [{ data: l }, { data: t }] = await Promise.all([
    supabase.from("lowongan").select("id, judul, kode, buka, peringatan, lamaran(count)").order("dibuat_at", { ascending: false }).limit(20),
    supabase.from("topi").select("id, nama").order("nama"),
  ]);
  const daftar = (l ?? []) as unknown as Lowongan[];
  const dasar = asal(await headers());
  return (
    <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-lowongan" data-testid="kartu-lowongan">
      <h2 id="judul-lowongan" className="text-lg font-semibold">Lowongan</h2>
      <p className="mt-1 text-sm text-tinta-2">Sebar tautan lamar lewat WhatsApp. Pelamar tidak perlu akun; CV-nya dibaca Nadi dan muncul sebagai usulan di Feed.</p>
      <FormLowongan topi={(t ?? []) as { id: string; nama: string }[]} />
      {daftar.length === 0 ? (
        <p className="mt-4 text-sm text-tinta-2" data-testid="lowongan-kosong">Belum ada lowongan.</p>
      ) : (
        <ul className="mt-4 divide-y divide-garis border-y border-garis" data-testid="daftar-lowongan">
          {daftar.map((x) => {
            const tautan = `${dasar}/lamar/${x.kode}`;
            return (
              <li key={x.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{x.judul}</p>
                  <Cap jenis={x.buka ? "diterima" : "ditolak"} label={x.buka ? "Buka" : "Tutup"} />
                </div>
                <p className="mt-1 break-all font-mono" data-testid="tautan-lamar">{tautan}</p>
                <p className="text-tinta-2">{x.lamaran?.[0]?.count ?? 0} lamaran masuk</p>
                {x.peringatan?.length ? (
                  <div className="mt-2 rounded-[var(--radius-isian)] border border-cap/40 p-3" data-testid="peringatan-lowongan">
                    <p className="font-semibold text-cap">Periksa {x.peringatan.length} syarat sebelum dibuka</p>
                    <ul className="mt-1 grid gap-2">
                      {x.peringatan.map((p) => (
                        <li key={p.kode} data-kode={p.kode}>
                          <span className="font-mono">&ldquo;{p.kutipan}&rdquo;</span>: {p.alasan} {p.saran}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  <a href={`https://wa.me/?text=${encodeURIComponent(`Lowongan ${x.judul}. Lamar lewat HP di ${tautan}`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center rounded-[var(--radius-isian)] border border-garis-kuat px-3 font-semibold">
                    Kirim lewat WhatsApp
                  </a>
                  <form action={ubahBukaLowongan}>
                    <input type="hidden" name="id" value={x.id} />
                    <input type="hidden" name="buka" value={x.buka ? "0" : "1"} />
                    <button type="submit" className="h-10 rounded-[var(--radius-isian)] px-3 font-semibold underline-offset-4 hover:underline" aria-label={`${x.buka ? "Tutup" : x.peringatan?.length ? "Tetap buka" : "Buka"} lowongan ${x.judul}`}>
                      {x.buka ? "Tutup lowongan" : x.peringatan?.length ? "Tetap buka" : "Buka lagi"}
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
