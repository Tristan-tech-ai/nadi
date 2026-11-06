import "server-only";

/**
 * Email masuk/atur ulang/daftar memuat kode angka hanya bila templat email Supabase berisi {{ .Token }}. Templat hanya
 * bisa diubah setelah SMTP sendiri dipasang (dashboard Supabase, dicek 6 Nov 2026), jadi isian kode dinyalakan lewat env
 * NADI_KODE_EMAIL=1 setelah templat supabase/templates/*.html terpasang. Tanpa itu Nadi jujur meminta membuka tautan.
 */
export const kodeEmailAktif = () => process.env.NADI_KODE_EMAIL === "1";
