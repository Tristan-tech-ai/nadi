import { BatalkanKeputusan } from "@/components/app/batalkan-keputusan";
import { Cap } from "@/components/ui/cap";
import { formatJam, formatTanggal } from "@/lib/format";
import { bisaDibatalkan, labelKeputusan } from "@/lib/keputusan";
import { bacaSesi } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { zonaSesi } from "@/lib/zona-usaha";

type Ringkas = { jenis: string; tingkat: string; jumlah: number; dibatalkan: number; p50_ms: number | null; p95_ms: number | null };
type Keputusan = { id: string; jenis: string; tingkat: string; pilihan: string; yakin: number | null; alasan: string; latensi_ms: number; dibuat_at: string; dibatalkan_at: string | null; alasan_batal: string | null };

const JENIS: Record<string, string> = { "izin.otopilot": "Izin disetujui otomatis", "usulan.rute": "Rute usulan di Feed" };
const ms = (x: number | null) => (x === null ? "-" : x < 10 ? `${x.toFixed(1).replace(".", ",")} ms` : `${Math.round(x)} ms`);

/** Jejak keputusan otomatis 30 hari: berapa banyak, seberapa cepat, alasannya, dan tombol batal. Khusus pemilik/admin. */
export async function KeputusanOtomatis() {
  const sesi = await bacaSesi();
  if (sesi?.peran !== "pemilik" && sesi?.peran !== "admin") return null;
  const supabase = await createClient();
  const [{ data: r }, { data: d }, zona] = await Promise.all([
    supabase.rpc("ringkasan_keputusan", { p_hari: 30 }),
    supabase.from("keputusan").select("id, jenis, tingkat, pilihan, yakin, alasan, latensi_ms, dibuat_at, dibatalkan_at, alasan_batal").neq("tingkat", "manusia").order("dibuat_at", { ascending: false }).limit(10),
    zonaSesi(),
  ]);
  const ringkas = ((r ?? []) as Ringkas[]).filter((x) => x.tingkat !== "manusia");
  const keManusia = ((r ?? []) as Ringkas[]).filter((x) => x.tingkat === "manusia").reduce((n, x) => n + Number(x.jumlah), 0);
  const daftar = (d ?? []) as Keputusan[];
  return (
    <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-keputusan" data-testid="keputusan-otomatis">
      <h2 id="judul-keputusan" className="text-lg font-semibold">Keputusan otomatis</h2>
      <p className="mt-1 text-sm text-tinta-2">Yang diputuskan Nadi sendiri dalam 30 hari terakhir, dengan alasannya. Kamu bisa membatalkan dan Nadi mengembalikannya ke Feed.</p>
      {ringkas.length === 0 ? (
        <p className="mt-4 text-sm text-tinta-2" data-testid="keputusan-kosong">Belum ada keputusan otomatis. Atur aturan izin di atas agar Nadi bisa menyetujui yang jelas-jelas sesuai.</p>
      ) : (
        <dl className="mt-4 grid grid-cols-2 gap-3">
          {ringkas.map((x) => (
            <div key={x.jenis + x.tingkat} className="rounded-[var(--radius-kartu)] bg-kertas-2 p-4">
              <dt className="text-sm text-tinta-2">{JENIS[x.jenis] ?? x.jenis}{x.tingkat === "model" ? ", dinilai model" : ""}</dt>
              <dd className="angka mt-1 text-2xl font-semibold">{x.jumlah}</dd>
              <dd className="text-xs text-tinta-2">biasanya {ms(x.p50_ms)}, paling lambat {ms(x.p95_ms)}{x.dibatalkan ? `, ${x.dibatalkan} dibatalkan` : ""}</dd>
            </div>
          ))}
        </dl>
      )}
      {keManusia > 0 && <p className="mt-2 text-xs text-tinta-2">{keManusia} usulan belum punya aturan, jadi diserahkan ke kamu dan admin.</p>}
      {daftar.length > 0 && (
        <ul className="mt-4 divide-y divide-garis border-y border-garis" data-testid="daftar-keputusan">
          {daftar.map((k) => (
            <li key={k.id} className="py-3 text-sm" data-keputusan={k.id} data-tingkat={k.tingkat}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{JENIS[k.jenis] ?? k.jenis}</p>
                {k.dibatalkan_at ? <Cap jenis="ditolak" label="Dibatalkan" /> : <span className="text-xs text-tinta-2">{formatTanggal(new Date(k.dibuat_at), zona)}, {formatJam(new Date(k.dibuat_at), zona)}</span>}
              </div>
              {k.tingkat === "model" && <p className="mt-1 text-xs font-semibold text-laut" data-testid="label-model">{labelKeputusan(k)}</p>}
              <p className="mt-1">{k.alasan}</p>
              {k.dibatalkan_at ? <p className="mt-1 text-tinta-2">Alasan batal: {k.alasan_batal}</p> : bisaDibatalkan(k) && <BatalkanKeputusan id={k.id} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
