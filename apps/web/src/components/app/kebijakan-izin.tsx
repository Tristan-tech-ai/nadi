import { FormKebijakan, type Kebijakan } from "@/components/app/form-kebijakan";
import { JENIS_IZIN } from "@/lib/izin";
import { bacaSesi } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";

/** Kapan izin disetujui otomatis, per jenis. Hanya untuk pemilik/admin. Tanpa kebijakan, semua pengajuan diputuskan manusia. */
export async function KebijakanIzin() {
  const sesi = await bacaSesi();
  if (sesi?.peran !== "pemilik" && sesi?.peran !== "admin") return null;
  const supabase = await createClient();
  const { data } = await supabase.from("kebijakan_izin").select("jenis, otomatis, maks_hari_otomatis, butuh_bukti, maks_bersamaan, jatah_tahunan");
  const ada = new Map(((data ?? []) as Kebijakan[]).map((k) => [k.jenis, k]));
  return (
    <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-kebijakan-izin" data-testid="aturan-izin">
      <h2 id="judul-kebijakan-izin" className="text-lg font-semibold">Aturan izin dan cuti</h2>
      <p className="mt-1 text-sm text-tinta-2">
        Pengajuan yang memenuhi aturan ini langsung disetujui Nadi, dengan alasannya. Yang tidak memenuhi masuk Feed untuk kamu putuskan. Jenis yang belum diatur selalu masuk Feed.
      </p>
      <div className="mt-4 flex flex-col gap-4">
        {JENIS_IZIN.map((j) => (
          <FormKebijakan key={j.kode} jenis={j.kode} label={j.label} awal={ada.get(j.kode) ?? null} />
        ))}
      </div>
      <p className="mt-3 text-xs text-tinta-2">Jatah cuti tahunan diisi sendiri. Periksa aturan ketenagakerjaan yang berlaku untuk usahamu.</p>
    </section>
  );
}
