/**
 * Masuk dengan Google lewat tombol resmi Google Identity Services + supabase.auth.signInWithIdToken (docs Supabase
 * "Sign in with Google", bagian Google pre-built dan One-tap with Next.js, dibaca 12 Nov 2026). Tanpa pengalihan ke
 * supabase.co, sehingga layar Google menyebut domain Nadi dan domain Supabase bisa dilepas dari Authorized domains
 * (syarat verifikasi branding Google). Berkas ini tanpa "server-only": dipakai di peramban dan di tes.
 */

/** SHA-256 heksadesimal huruf kecil, seperti contoh docs Supabase (hashedNonce untuk Google). */
export async function sha256Hex(teks: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(teks));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Nonce acak 32 bita (base64) untuk Supabase, dan hash SHA-256-nya untuk Google. Dibuat baru setiap kali tombol disiapkan. */
export async function buatNonce(): Promise<{ nonce: string; hash: string }> {
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
  return { nonce, hash: await sha256Hex(nonce) };
}

/**
 * Browser di dalam aplikasi (Instagram, Facebook, TikTok, LINE, WebView Android) ditolak Google untuk masuk
 * (kebijakan "disallowed_useragent"), jadi pengguna diberi petunjuk membuka di Chrome atau Safari.
 */
export function browserDalamAplikasi(ua: string): boolean {
  return /FBAN|FBAV|FB_IAB|Instagram|Line\/|TikTok|musical_ly|BytedanceWebview|; wv\)/i.test(ua);
}

export type ModeGoogle = "masuk" | "daftar";

/** Opsi tombol resmi (google.accounts.id.renderButton): teks Google sendiri, bahasa ikut halaman, lebar ikut wadah. */
export function opsiTombol(mode: ModeGoogle, bahasa: "id" | "en", lebar: number) {
  return {
    type: "standard",
    theme: "outline",
    size: "large",
    shape: "rectangular",
    logo_alignment: "left",
    text: mode === "daftar" ? "signup_with" : "signin_with",
    locale: bahasa,
    width: Math.max(200, Math.min(400, Math.round(lebar))),
  } as const;
}

/** Opsi inisialisasi (google.accounts.id.initialize): nonce yang dikirim ke Google adalah hash; FedCM menyala. */
export function opsiInisialisasi(clientId: string, hashNonce: string, mode: ModeGoogle) {
  return {
    client_id: clientId,
    nonce: hashNonce,
    context: mode === "daftar" ? "signup" : "signin",
    ux_mode: "popup",
    itp_support: true,
    use_fedcm_for_button: true,
    use_fedcm_for_prompt: true,
    auto_select: false,
  } as const;
}
