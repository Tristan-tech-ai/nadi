import Image from "next/image";
import { masukGoogle } from "@/app/auth-actions";
import { googleAktif } from "@/lib/auth/google";
import type { Kamus } from "@/lib/i18n/kamus";

// U-07: tombol Masuk dengan Google di /masuk dan /daftar. Bila penyedia belum dinyalakan, Nadi berkata jujur, bukan tombol mati.
export async function MasukGoogle({ next, galat, teks: t }: { next?: string; galat?: boolean; teks: Kamus["auth"] }) {
  const aktif = await googleAktif();
  return (
    <div className="mt-6" data-testid="masuk-google" data-aktif={aktif ? "ya" : "tidak"}>
      <p className="flex items-center gap-3 text-xs text-tinta-2" aria-hidden><span className="h-px flex-1 bg-garis" />{t.googleAtau}<span className="h-px flex-1 bg-garis" /></p>
      {galat && <p role="alert" className="mt-3 text-sm text-cap">{t.googleGagal}</p>}
      {aktif ? (
        <form action={masukGoogle} className="mt-3">
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <button type="submit" className="flex h-12 w-full items-center justify-center gap-3 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas text-sm font-semibold hover:bg-kertas-2">
            <span className="inline-flex size-7 items-center justify-center rounded-full bg-white"><Image src="/ikon/google-g.svg" width={18} height={18} alt="" unoptimized /></span>
            {t.googleTombol}
          </button>
        </form>
      ) : <p className="mt-3 text-sm text-tinta-2">{t.googleBelum}</p>}
    </div>
  );
}
