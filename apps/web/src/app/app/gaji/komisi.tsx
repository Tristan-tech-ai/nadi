import { FormKomisi } from "@/components/app/komisi";
import { formatRupiah } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { isiTeks } from "@/lib/i18n/isi-teks";
import { ambilKamus } from "@/lib/i18n/kamus";
import { createClient } from "@/lib/supabase/server";

type Rekap = { orang: string; nama: string; penjualan: number; komisi: number; transaksi: number };
type Aturan = { id: string; produk_id: string | null; persen: number; nominal: number };

/** W-07C: aturan komisi dan rekap bulan berjalan di halaman Gaji (pemilik/admin). */
export async function BagianKomisi({ bahasa, bulan, namaBulan, akhir }: { bahasa: Bahasa; bulan: string; namaBulan: string; akhir: string }) {
  const t = ambilKamus(bahasa).komisi;
  const supabase = await createClient();
  const [rk, at, pr] = await Promise.all([
    supabase.rpc("commission_summary", { p_mulai: `${bulan}-01`, p_sampai: akhir }),
    supabase.from("commission_rule").select("id, produk_id, persen, nominal").eq("aktif", true),
    supabase.from("produk").select("id, nama").eq("aktif", true).order("nama").limit(500),
  ]);
  const rp = (n: number) => formatRupiah(n, { bahasa });
  const produk = (pr.data ?? []) as { id: string; nama: string }[];
  const nama = new Map(produk.map((p) => [p.id, p.nama]));
  const rekap = (rk.data ?? []) as Rekap[];
  const aturan = (at.data ?? []) as Aturan[];
  return (
    <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-komisi" data-testid="komisi">
      <h2 id="judul-komisi" className="text-lg font-semibold">{isiTeks(t.judul, { bulan: namaBulan })}</h2>
      <p className="mt-1 max-w-2xl text-sm text-tinta-2">{t.ket}</p>
      <h3 className="mt-4 font-semibold">{t.rekapJudul}</h3>
      {rekap.length === 0 ? <p className="mt-1 text-sm text-tinta-2">{t.rekapKosong}</p> : (
        <ul className="mt-1 grid gap-1 text-sm" data-testid="rekap-komisi">{rekap.map((r) => (
          <li key={r.orang} data-pengguna>{isiTeks(t.rekapBaris, { nama: r.nama, komisi: rp(r.komisi), penjualan: rp(r.penjualan), n: r.transaksi })}</li>))}</ul>
      )}
      <h3 className="mt-4 font-semibold">{t.aturanJudul}</h3>
      {aturan.length === 0 ? <p className="mt-1 text-sm text-tinta-2">{t.aturanKosong}</p> : (
        <ul className="mt-1 grid gap-1 text-sm" data-testid="aturan-komisi">{aturan.map((a) => (
          <li key={a.id}>{isiTeks(t.aturanBaris, { produk: a.produk_id ? (nama.get(a.produk_id) ?? "?") : t.semua,
            persen: String(Number(a.persen)).replace(".", bahasa === "en" ? "." : ","), nominal: rp(Number(a.nominal)) })}</li>))}</ul>
      )}
      <FormKomisi produk={produk} teks={t} />
    </section>
  );
}
