import { FormKebijakan, type Kebijakan } from "@/components/app/form-kebijakan";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { JENIS_IZIN } from "@/lib/izin";
import { bacaSesi } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";

/** Kapan izin disetujui otomatis, per jenis. Hanya untuk pemilik/admin. Tanpa kebijakan, semua pengajuan diputuskan manusia. */
export async function KebijakanIzin() {
  const sesi = await bacaSesi();
  if (sesi?.peran !== "pemilik" && sesi?.peran !== "admin") return null;
  const bahasa = await bahasaAplikasi(sesi.bahasa);
  const k = ambilKamus(bahasa);
  const t = k.kebijakanIzin;
  const supabase = await createClient();
  const { data } = await supabase.from("kebijakan_izin").select("jenis, otomatis, maks_hari_otomatis, butuh_bukti, maks_bersamaan, jatah_tahunan");
  const ada = new Map(((data ?? []) as Kebijakan[]).map((k) => [k.jenis, k]));
  return (
    <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-kebijakan-izin" data-testid="aturan-izin" lang={bahasa}>
      <h2 id="judul-kebijakan-izin" className="text-lg font-semibold">{t.judul}</h2>
      <p className="mt-1 text-sm text-tinta-2">{t.ket}</p>
      <div className="mt-4 flex flex-col gap-4">
        {JENIS_IZIN.map((j) => (
          <FormKebijakan key={j.kode} jenis={j.kode} label={k.izin.jenis[j.kode]} awal={ada.get(j.kode) ?? null} teks={t} />
        ))}
      </div>
      <p className="mt-3 text-xs text-tinta-2">{t.catatan}</p>
    </section>
  );
}
