import { Rupiah } from "@/components/ui/rupiah";
import { formatAngka, formatTanggalKalender } from "@/lib/format";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

type Biaya = { bulan: string; panggilan: number; token: number; token_cache: number; token_tanpa_harga: number; berkas: number; storage_byte: number; db_byte: number;
  usd: number; idr: number; kurs_idr: number; sumber_harga: string | null; diakses: string | null };

/** M-27: biaya nyata Nadi untuk usaha ini bulan ini (RPC nadi_cost, null untuk selain pemilik/admin). */
export async function BiayaNadi() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("nadi_cost");
  const b = data as Biaya | null;
  if (!b) return null;
  const bahasa = await bahasaAplikasi();
  const t = ambilKamus(bahasa).biayaNadi;
  const angka = (n: number) => formatAngka(n, bahasa);
  const [th, bl] = b.bulan.split("-").map(Number);
  const bulan = new Intl.DateTimeFormat(bahasa === "en" ? "en-GB" : "id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(th, bl - 1, 1)));
  const mb = (n: number) => new Intl.NumberFormat(bahasa === "en" ? "en-GB" : "id-ID", { maximumFractionDigits: 1 }).format(n / 1048576);
  const isi = [
    { k: t.token, v: angka(b.token), id: "biaya-token" },
    { k: t.berkas, v: angka(b.berkas), id: "biaya-berkas" },
    { k: t.simpan, v: isiTeks(t.mb, { n: mb(b.storage_byte + b.db_byte) }), id: "biaya-simpan" },
  ];
  return (
    <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-biaya-nadi" data-testid="biaya-nadi" lang={bahasa}>
      <h2 id="judul-biaya-nadi" className="text-lg font-semibold">{isiTeks(t.judul, { bulan })}</h2>
      <p className="mt-1 max-w-2xl text-sm text-tinta-2">{t.ket}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-[var(--radius-kartu)] bg-kertas-2 p-4">
          <dt className="text-sm text-tinta-2">{t.perkiraan}</dt>
          <dd className="mt-1 text-2xl font-semibold break-words" data-testid="biaya-rupiah"><Rupiah nilai={Number(b.idr)} bahasa={bahasa} /></dd>
        </div>
        {isi.map((x) => (
          <div key={x.id} className="rounded-[var(--radius-kartu)] bg-kertas-2 p-4">
            <dt className="text-sm text-tinta-2">{x.k}</dt>
            <dd className="angka mt-1 text-2xl font-semibold" data-testid={x.id}>{x.v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm text-tinta-2" data-testid="biaya-dasar">
        {isiTeks(t.dasar, { panggilan: angka(b.panggilan), cache: angka(b.token_cache), kurs: angka(b.kurs_idr) })}
        {b.token_tanpa_harga > 0 ? ` ${isiTeks(t.tanpaHarga, { n: angka(b.token_tanpa_harga) })}` : ""}
        {b.diakses ? ` ${isiTeks(t.sumber, { tanggal: formatTanggalKalender(b.diakses, bahasa) })}` : ""}
      </p>
    </section>
  );
}
