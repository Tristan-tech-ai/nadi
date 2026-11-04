import { headers } from "next/headers";
import { FormBuatPintu, TombolCabutPintu } from "@/components/app/pintu";
import { formatTanggal } from "@/lib/format";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { asalTautan } from "@/lib/mcp/http";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { zonaSesi } from "@/lib/zona-usaha";

type Pintu = { id: string; nama: string; batas_harian: number; dibuat_at: string; terakhir_at: string | null; dicabut_at: string | null };

const CONTOH = `curl -X POST {alamat} \\
  -H "Authorization: Bearer nmi_..." \\
  -H "Content-Type: application/json" \\
  -d '{"jenis": "penjualan", "baris": [{"tanggal": "2026-11-04", "jumlah": 54000, "metode": "qris"}]}'`;

/** Bagian Usahamu (W-08): pintu data untuk aplikasi lain dan n8n/Make. Hanya pemilik dan admin. */
export async function PintuData() {
  const sesi = await wajibPerusahaan();
  if (sesi.peran !== "pemilik" && sesi.peran !== "admin") return null;
  const bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).pintu;
  const supabase = await createClient();
  const [{ data }, zona] = await Promise.all([
    supabase.from("pintu_data").select("id, nama, batas_harian, dibuat_at, terakhir_at, dicabut_at").is("dicabut_at", null).order("dibuat_at", { ascending: false }),
    zonaSesi(),
  ]);
  const alamat = `${asalTautan(await headers())}/api/pintu`;
  const daftar = (data ?? []) as Pintu[];
  return (
    <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-pintu" lang={bahasa} data-testid="pintu-data">
      <h2 id="judul-pintu" className="text-lg font-semibold">{t.judul}</h2>
      <p className="mt-1 text-sm text-tinta-2">{t.ket}</p>
      <p className="mt-2 text-sm">{t.alamat} <span className="break-all font-mono" data-testid="alamat-pintu">{alamat}</span></p>
      {daftar.length === 0 ? (
        <p className="mt-4 text-sm text-tinta-2">{t.kosong}</p>
      ) : (
        <ul className="mt-4 divide-y divide-garis border-y border-garis">
          {daftar.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold" data-pengguna>{p.nama}</p>
                <p className="text-sm text-tinta-2">
                  {isiTeks(t.batasHari, { n: p.batas_harian })}{" "}
                  {p.terakhir_at ? isiTeks(t.terakhir, { t: formatTanggal(new Date(p.terakhir_at), zona, bahasa) }) : t.belumDipakai}
                </p>
              </div>
              <TombolCabutPintu id={p.id} nama={p.nama} teks={t} />
            </li>
          ))}
        </ul>
      )}
      <FormBuatPintu teks={t} />
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer font-semibold text-laut">{t.caraKirim}</summary>
        <p className="mt-2 text-tinta-2">{t.caraKet}</p>
        <pre className="mt-2 overflow-x-auto rounded-[var(--radius-isian)] bg-kertas-2 p-3 font-mono text-xs" lang="en">{CONTOH.replace("{alamat}", alamat)}</pre>
        <p className="mt-2 text-tinta-2">{t.alat}</p>
      </details>
    </section>
  );
}
