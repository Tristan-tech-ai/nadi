import { kamusId } from "@/lib/i18n/kamus/id";

// Pesan galat auth dalam bahasa Nadi (VOICE.md: apa yang terjadi + apa yang bisa dilakukan). Kode dari Supabase Auth.
// Teks di kamus authPesan; bawaan bahasa Indonesia, mode lain mengoper kamusnya.
export type TeksAuth = typeof kamusId.authPesan;
const KODE = ["invalid_credentials", "email_not_confirmed", "user_already_exists", "email_exists", "weak_password", "over_email_send_rate_limit", "over_request_rate_limit", "email_address_invalid", "signup_disabled"] as const;

export function pesanGalatAuth(kode: string | undefined | null, t: TeksAuth = kamusId.authPesan): string {
  return kode && (KODE as readonly string[]).includes(kode) ? t[kode as (typeof KODE)[number]] : t.umum;
}

export type HasilForm = { galat?: string; info?: string; isian?: Record<string, string> };

/** Validasi ringan sebelum menghubungi server auth. */
export function cekIsianDaftar(email: string, sandi: string, t: TeksAuth = kamusId.authPesan): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return t.emailSalah;
  if (sandi.length < 8) return t.sandiPendek;
  return null;
}

/**
 * Hanya izinkan pengalihan ke jalur internal (cegah open redirect). Karakter kendali dan garis miring terbalik ditolak dulu
 * karena parser URL browser membuang tab/baris baru ("/\t/evil.com" menjadi "//evil.com"); lalu hasil parse harus tetap
 * di asal yang sama (Q-01).
 */
export function jalurAman(next: string | null | undefined, cadangan = "/app"): string {
  if (!next || !next.startsWith("/") || /[\u0000-\u001f\u007f\\]/.test(next)) return cadangan;
  try {
    const u = new URL(next, "https://nadi.invalid");
    return u.origin === "https://nadi.invalid" && !next.startsWith("//") ? u.pathname + u.search + u.hash : cadangan;
  } catch {
    return cadangan;
  }
}
