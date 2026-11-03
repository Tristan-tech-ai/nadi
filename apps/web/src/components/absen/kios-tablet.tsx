"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { KodeKios } from "@/app/kios/actions";
import { LayarKios } from "@/components/absen/layar-kios";
import { KUNCI_SIMPAN, tokenDariHash, tokenSah } from "@/lib/absen/kios";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { Kamus } from "@/lib/i18n/kamus";

const baca = () => {
  try {
    return localStorage.getItem(KUNCI_SIMPAN);
  } catch {
    return null;
  }
};
const simpan = (t: string | null) => {
  try {
    if (t) localStorage.setItem(KUNCI_SIMPAN, t);
    else localStorage.removeItem(KUNCI_SIMPAN);
  } catch {}
};

/** Token tablet: dari fragmen tautan (lalu disimpan dan fragmen dihapus), atau yang sudah tersimpan di perangkat. */
function bacaToken(): string | null {
  const dariTautan = tokenDariHash(window.location.hash);
  if (dariTautan) {
    simpan(dariTautan);
    history.replaceState(null, "", window.location.pathname);
  }
  const t = baca();
  return tokenSah(t) ? t : null;
}
const langganan = (ubah: () => void) => {
  window.addEventListener("storage", ubah);
  return () => window.removeEventListener("storage", ubah);
};

/** Tablet kios tanpa akun: token dari tautan pemilik disimpan di perangkat ini; hanya bisa meminta kode absen. */
export function KiosTablet({ teks: t }: { teks: Kamus["absen"] }) {
  // undefined saat prerender (belum tahu isi perangkat), lalu token atau null di peramban.
  const token = useSyncExternalStore<string | null | undefined>(langganan, bacaToken, () => undefined);

  const ambil = useCallback(async (): Promise<KodeKios> => {
    const { data, error } = await createBrowserSupabase().rpc("kode_absen_kios", { p_token: token });
    if (error) {
      if (error.code === "28000") {
        simpan(null);
        return { galat: t.tabletDicabut };
      }
      return { galat: t.kodeGagal };
    }
    const d = data as { tempat: string; kode: string; sisa_detik: number };
    return { tempat: d.tempat, kode: d.kode, sisa: d.sisa_detik };
  }, [token, t]);

  if (token === undefined) return <div className="mx-auto aspect-square w-full max-w-md animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />;
  if (!token) {
    return (
      <p role="alert" className="max-w-md text-center text-lg text-tinta-2" data-testid="tablet-tanpa-tautan">
        {t.tabletBelum}
      </p>
    );
  }
  return <LayarKios ambil={ambil} teks={t} />;
}
