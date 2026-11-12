import { TombolGoogle } from "@/components/auth/tombol-google";
import { googleAktif } from "@/lib/auth/google";
import type { ModeGoogle } from "@/lib/auth/google-gis";
import { jalurAman } from "@/lib/auth-pesan";
import type { Kamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";

// U-07 + AUTH-GIS: Masuk dengan Google di /masuk dan /daftar memakai tombol resmi Google (tanpa pengalihan ke supabase.co).
// ID klien OAuth Google bukan rahasia dan diambil dari env NADI_GOOGLE_CLIENT_ID. Bila penyedia Google belum dinyalakan di
// Supabase atau ID klien belum diisi, Nadi berkata jujur, bukan menampilkan tombol mati.
export async function MasukGoogle({ next, galat, mode = "masuk", teks: t }: { next?: string; galat?: boolean; mode?: ModeGoogle; teks: Kamus["auth"] }) {
  const clientId = process.env.NADI_GOOGLE_CLIENT_ID?.trim() ?? "";
  const aktif = clientId !== "" && (await googleAktif());
  const bahasa = (await bahasaAplikasi()) === "en" ? "en" : "id";
  return (
    <div className="mt-6" data-testid="masuk-google" data-aktif={aktif ? "ya" : "tidak"}>
      <p className="flex items-center gap-3 text-xs text-tinta-2" aria-hidden><span className="h-px flex-1 bg-garis" />{t.googleAtau}<span className="h-px flex-1 bg-garis" /></p>
      {galat && <p role="alert" className="mt-3 text-sm text-cap">{t.googleGagal}</p>}
      {aktif
        ? <TombolGoogle clientId={clientId} mode={mode} bahasa={bahasa} next={jalurAman(next ?? null, "/app")} teks={t} />
        : <p className="mt-3 text-sm text-tinta-2">{t.googleBelum}</p>}
    </div>
  );
}
