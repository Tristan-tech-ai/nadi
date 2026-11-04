import { FormGeofence, FormKunci } from "@/components/app/waktu";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { hariIni } from "@/lib/izin";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { zonaUsahaIni } from "@/lib/zona-usaha";

/** Bagian Usahamu (M-12): lokasi absen (geofence) tempat utama dan kunci absensi per bulan. Hanya pemilik dan admin. */
export async function AturWaktu() {
  const sesi = await wajibPerusahaan();
  if (sesi.peran !== "pemilik" && sesi.peran !== "admin") return null;
  const bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).waktu;
  const supabase = await createClient();
  const [{ data: idTempat }, zona] = await Promise.all([supabase.rpc("tempat_absen_utama"), zonaUsahaIni(sesi.perusahaanId)]);
  const [{ data: tp }, { data: kunci }] = await Promise.all([
    supabase.from("tempat").select("id, nama, lat, lng, radius_m").eq("id", idTempat as string).maybeSingle(),
    supabase.from("kunci_absensi").select("bulan, aktif").order("bulan", { ascending: false }).limit(24),
  ]);
  const hari = hariIni(new Date(), zona);
  const awal = new Date(`${hari.slice(0, 7)}-01T00:00:00Z`);
  const bulan = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(awal.getUTCFullYear(), awal.getUTCMonth() - 1 - i, 1));
    return { nilai: d.toISOString().slice(0, 7), label: new Intl.DateTimeFormat(bahasa === "en" ? "en-GB" : "id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(d) };
  });
  const terkunci = new Set(((kunci ?? []) as { bulan: string; aktif: boolean }[]).filter((k) => k.aktif).map((k) => k.bulan.slice(0, 7)));
  const tempat = tp as { id: string; nama: string; lat: number | null; lng: number | null; radius_m: number | null } | null;
  return (
    <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-atur-waktu" lang={bahasa} data-testid="atur-waktu">
      <h2 id="judul-atur-waktu" className="text-lg font-semibold">{t.judul}</h2>
      {tempat && (
        <>
          <p className="mt-1 text-sm text-tinta-2">{tempat.radius_m ? isiTeks(t.geofenceNyala, { nama: tempat.nama, radius: tempat.radius_m }) : isiTeks(t.geofenceKet, { nama: tempat.nama })}</p>
          <FormGeofence tempat={tempat.id} titik={tempat.lat !== null && tempat.lng !== null && tempat.radius_m ? `${tempat.lat}, ${tempat.lng}` : ""} radius={tempat.radius_m} teks={t} />
        </>
      )}
      <p className="mt-6 text-sm text-tinta-2">{t.kunciKet}</p>
      <p className="mt-1 text-sm" data-testid="bulan-terkunci">{terkunci.size ? isiTeks(t.daftarTerkunci, { daftar: bulan.filter((b) => terkunci.has(b.nilai)).map((b) => b.label).join(", ") || [...terkunci].join(", ") }) : t.belumTerkunci}</p>
      <FormKunci bulan={bulan} terkunci={terkunci.has(bulan[0].nilai)} teks={t} />
    </section>
  );
}
