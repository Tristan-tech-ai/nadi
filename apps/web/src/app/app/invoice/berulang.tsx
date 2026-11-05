import { randomUUID } from "node:crypto";
import { AksiBerulang, FormBerulang } from "@/components/app/berulang";
import { formatRupiah, formatTanggalKalender } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { isiTeks } from "@/lib/i18n/isi-teks";
import { ambilKamus } from "@/lib/i18n/kamus";
import { createClient } from "@/lib/supabase/server";

type Jadwal = { id: string; pelanggan: string; baris: { uraian: string; harga: number; jumlah: number }[]; every_months: number; next_date: string; status: "aktif" | "jeda" | "selesai";
  runs: number; galat: string | null };

/** W-07A: bagian Tagihan berulang di halaman Invoice (sewa, SPP, langganan). */
export async function TagihanBerulang({ bahasa, hariIni }: { bahasa: Bahasa; hariIni: string }) {
  const t = ambilKamus(bahasa).berulang;
  const { data } = await (await createClient()).from("recurring_invoice").select("id, pelanggan, baris, every_months, next_date, status, runs, galat")
    .order("dibuat_at", { ascending: false }).limit(100);
  const daftar = (data ?? []) as Jadwal[];
  return (
    <section className="mt-8" aria-labelledby="judul-berulang">
      <h2 id="judul-berulang" className="text-lg font-semibold">{t.judul}</h2>
      <p className="mt-1 max-w-2xl text-sm text-tinta-2">{t.ket}</p>
      <FormBerulang kunci={randomUUID()} hariIni={hariIni} teks={t} />
      {daftar.length === 0 ? <p className="mt-3 text-sm text-tinta-2">{t.kosong}</p> : (<>
        <ul className="mt-4 divide-y divide-garis border-y border-garis text-sm" data-testid="daftar-berulang">
          {daftar.map((j) => (
            <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 py-3" data-testid="berulang" data-status={j.status}>
              <div>
                <p><span className="font-semibold" data-pengguna>{j.pelanggan}</span> <span className="text-tinta-2" data-pengguna>{j.baris[0]?.uraian}</span></p>
                <p className="text-tinta-2"><span className="angka">{formatRupiah(j.baris.reduce((s, b) => s + b.harga * b.jumlah, 0), { bahasa })}</span>
                  {" · "}{t.tiapNama[String(j.every_months) as "1" | "3" | "6" | "12"]}{" · "}{t.statusNama[j.status]}
                  {j.status === "aktif" && <>{" · "}{isiTeks(t.berikutnya, { tanggal: formatTanggalKalender(j.next_date, bahasa) })}</>}
                  {" · "}{isiTeks(t.kali, { n: j.runs })}</p>
                {j.galat && <p role="alert" className="text-cap">{isiTeks(t.galat, { pesan: j.galat })}</p>}
              </div>
              <AksiBerulang id={j.id} status={j.status} teks={t} />
            </li>
          ))}
        </ul>
        <div className="mt-3"><AksiBerulang teks={t} /></div>
      </>)}
    </section>
  );
}
