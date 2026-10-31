// Pesan galat auth dalam bahasa Nadi (VOICE.md: apa yang terjadi + apa yang bisa dilakukan). Kode dari Supabase Auth.
const PESAN: Record<string, string> = {
  invalid_credentials: "Email atau kata sandi tidak cocok. Periksa lagi, atau atur ulang kata sandi.",
  email_not_confirmed: "Email ini belum dikonfirmasi. Buka tautan di emailmu, lalu masuk lagi.",
  user_already_exists: "Email ini sudah terdaftar. Masuk saja dengan kata sandimu.",
  email_exists: "Email ini sudah terdaftar. Masuk saja dengan kata sandimu.",
  weak_password: "Kata sandi terlalu lemah. Pakai minimal 8 karakter, campur huruf dan angka.",
  over_email_send_rate_limit: "Pendaftaran sedang ramai dan email konfirmasi tertahan. Coba lagi sekitar satu jam lagi.",
  over_request_rate_limit: "Terlalu banyak percobaan. Tunggu sebentar, lalu coba lagi.",
  email_address_invalid: "Alamat email ini tidak bisa dipakai. Periksa penulisannya.",
  signup_disabled: "Pendaftaran baru sedang ditutup.",
};

export function pesanGalatAuth(kode: string | undefined | null): string {
  return (kode && PESAN[kode]) || "Nadi gagal memproses. Coba lagi sebentar; isianmu tidak hilang.";
}

export type HasilForm = { galat?: string; info?: string; isian?: Record<string, string> };

/** Validasi ringan sebelum menghubungi server auth. */
export function cekIsianDaftar(email: string, sandi: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return "Tulis alamat email yang lengkap, misalnya made@warungku.id.";
  if (sandi.length < 8) return "Kata sandi minimal 8 karakter.";
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
