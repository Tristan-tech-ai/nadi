import "server-only";
import { redirect } from "next/navigation";
import { usahaTamu } from "@/lib/auth/tamu";
import { createClient } from "@/lib/supabase/server";

export type Sesi = { userId: string; email: string | null; perusahaanId: string | null; peran: string | null; bahasa: string | null; tamu?: boolean };

/**
 * Pengguna masuk dari klaim JWT yang diverifikasi lokal (getClaims). Dipanggil hanya di dalam <Suspense>
 * (Cache Components: membaca cookie di luar batas Suspense adalah galat build).
 */
export async function bacaSesi(): Promise<Sesi | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const c = data?.claims;
  if (!c?.sub) return null;
  const meta = (c.app_metadata ?? {}) as { pid?: string; prn?: string };
  // Pilihan bahasa pengguna (I-02) disimpan di user_metadata dan ikut dalam JWT setelah sesi disegarkan.
  const um = (c.user_metadata ?? {}) as { bahasa?: string };
  // L-03 mode coba: sesi anonim selalu di usaha contoh sebagai pemilik, baca saja. Diturunkan dari is_anonymous (bukan app_metadata)
  // sama seperti app.pid() di database, sehingga akun yang sudah ditautkan email tidak membawa usaha contoh.
  if (c.is_anonymous === true) return { userId: c.sub, email: null, perusahaanId: await usahaTamu(), peran: "pemilik", bahasa: um.bahasa ?? null, tamu: true };
  return { userId: c.sub, email: typeof c.email === "string" ? c.email : null, perusahaanId: meta.pid ?? null, peran: meta.prn ?? null, bahasa: um.bahasa ?? null };
}

export async function wajibSesi(): Promise<Sesi> {
  const s = await bacaSesi();
  if (!s) redirect("/masuk");
  // M-21: sesi aal1 milik akun ber-2FA diarahkan ke langkah kode (database juga menutup usaha untuk sesi ini).
  const supabase = await createClient();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") redirect("/masuk/2fa");
  return s;
}

/** Sesi dengan perusahaan aktif; tanpa perusahaan diarahkan ke langkah pertama. */
export async function wajibPerusahaan(): Promise<Sesi & { perusahaanId: string; peran: string }> {
  const s = await wajibSesi();
  if (!s.perusahaanId || !s.peran) redirect("/app/mulai");
  return s as Sesi & { perusahaanId: string; peran: string };
}
